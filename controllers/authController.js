const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../middleware/auth');

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12); // keeps timing similar when the email is unknown

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  const ok = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
  if (!user || !ok) throw new ApiError(401, 'Invalid email or password');
  if (user.active === false) throw new ApiError(403, 'This account has been disabled. Contact the administrator.');
  res.json({ token: signToken(user), user: user.toPublic() });
});

exports.me = asyncHandler(async (req, res) => res.json({ user: req.user.toPublic() }));

exports.logout = asyncHandler(async (req, res) => {
  req.user.tokenVersion += 1; // invalidates every token issued before now
  await req.user.save();
  res.json({ message: 'Signed out' });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.currentPassword))) throw new ApiError(400, 'Current password is incorrect');
  if (req.body.currentPassword === req.body.newPassword) throw new ApiError(400, 'New password must be different');
  user.password = req.body.newPassword;
  user.tokenVersion += 1;
  await user.save();
  res.json({ message: 'Password changed', token: signToken(user) });
});
