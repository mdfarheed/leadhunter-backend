// Admin-only user management. There is no self-registration: only the administrator creates accounts (always role "user").
// A user sees ONLY their own leads / follow-ups / visits / history / dashboard (see utils/scope.js).
const User = require('../models/User');
const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const SearchHistory = require('../models/SearchHistory');
const VisitContact = require('../models/VisitContact');
const AppSetting = require('../models/AppSetting');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const strongEnough = (p) => typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
const BAD_PASSWORD = 'Password must be 8+ characters with letters and numbers';

const publicUser = (u, extra = {}) => ({
  id: u._id, name: u.name, email: u.email, role: u.role || 'admin', active: u.active !== false, city: u.city, developerName: u.developerName || u.name,
  createdAt: u.createdAt, ...extra,
});

async function managedUser(id) {
  const u = await User.findById(id);
  if (!u) throw new ApiError(404, 'User not found');
  if (u.role !== 'user') throw new ApiError(403, 'Administrator accounts cannot be changed here');
  return u;
}

exports.list = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: 1 });
  const counts = await Lead.aggregate([{ $group: { _id: '$createdBy', count: { $sum: 1 } } }]);
  const byOwner = new Map(counts.map((c) => [String(c._id), c.count]));
  const legacy = counts.filter((c) => c._id == null).reduce((s, c) => s + c.count, 0); // leads from before multi-user belong to the admin
  res.json({ data: users.map((u) => publicUser(u, { leadCount: (byOwner.get(String(u._id)) || 0) + (u.role !== 'user' ? legacy : 0) })) });
});

exports.create = asyncHandler(async (req, res) => {
  const { name, email, password, city, developerName } = req.body;
  if (!strongEnough(password)) throw new ApiError(400, BAD_PASSWORD, [{ field: 'password', message: BAD_PASSWORD }]);
  if (await User.exists({ email })) throw new ApiError(409, 'A user with this email already exists', [{ field: 'email', message: 'Email already in use' }]);
  const user = await User.create({ name, email, password, city, developerName: developerName || name, role: 'user', active: true, createdBy: req.user._id });
  res.status(201).json({ data: publicUser(user) }); // the admin hands the email + password to the user; the password is never shown again
});

exports.update = asyncHandler(async (req, res) => {
  const u = await managedUser(req.params.id);
  const { name, city, developerName, active, newPassword } = req.body;
  if (name !== undefined) u.name = name;
  if (city !== undefined) u.city = city;
  if (developerName !== undefined) u.developerName = developerName;
  if (active !== undefined) { u.active = Boolean(active); if (!u.active) u.tokenVersion += 1; } // disabling signs them out everywhere
  if (newPassword !== undefined) {
    if (!strongEnough(newPassword)) throw new ApiError(400, BAD_PASSWORD, [{ field: 'newPassword', message: BAD_PASSWORD }]);
    u.password = newPassword;
    u.tokenVersion += 1;
  }
  await u.save();
  res.json({ data: publicUser(u) });
});

// Deletes the user AND everything they own.
exports.remove = asyncHandler(async (req, res) => {
  const u = await managedUser(req.params.id);
  const leadIds = (await Lead.find({ createdBy: u._id }).select('_id').lean()).map((l) => l._id);
  await Promise.all([
    LeadActivity.deleteMany({ $or: [{ lead: { $in: leadIds } }, { createdBy: u._id }] }),
    Lead.deleteMany({ createdBy: u._id }),
    SearchHistory.deleteMany({ createdBy: u._id }),
    VisitContact.deleteMany({ createdBy: u._id }),
    AppSetting.deleteMany({ key: { $in: [`preferences:${u._id}`, `apiUsage:${u._id}`, `templateRotation:${u._id}`] } }),
  ]);
  await u.deleteOne();
  res.json({ message: `User and ${leadIds.length} lead(s) deleted` });
});
