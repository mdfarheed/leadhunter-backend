const Lead = require('../models/Lead');
const VisitContact = require('../models/VisitContact');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { checkPhone } = require('../utils/phone');
const { parsePagination, pageMeta } = require('../utils/pagination');
const { withOwner } = require('../utils/scope');
const { getPreferences } = require('../services/settingsService');
const { createLeadFrom } = require('../services/leadWriter');

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phoneError = (r) => new ApiError(400, r.message, [{ field: 'phone', message: r.message }], r.code);
const find = (req, id) => VisitContact.findOne(withOwner(req.user, { _id: id }));

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 20, 100);
  const f = {};
  if (['pending', 'visited', 'converted'].includes(req.query.status)) f.status = req.query.status;
  if (req.query.q) {
    const rx = new RegExp(esc(String(req.query.q).trim()), 'i');
    f.$or = [{ name: rx }, { phone: rx }, { phoneNormalized: rx }, { comment: rx }, { city: rx }];
  }
  const filter = withOwner(req.user, f);
  const [data, total, counts] = await Promise.all([
    VisitContact.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    VisitContact.countDocuments(filter),
    VisitContact.aggregate([{ $match: withOwner(req.user) }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  res.json({ data, pagination: pageMeta(page, limit, total), counts: Object.fromEntries(counts.map((c) => [c._id, c.count])) });
});

exports.create = asyncHandler(async (req, res) => {
  const prefs = await getPreferences(req.user);
  const phone = checkPhone(req.body.phone, prefs.defaultCountryCode);
  if (!phone.ok) throw phoneError(phone);
  const dupe = await VisitContact.findOne(withOwner(req.user, { phoneNormalized: phone.digits })).lean();
  if (dupe) throw new ApiError(409, `This number is already saved${dupe.name ? ` (${dupe.name})` : ''}.`, undefined, 'DUPLICATE');
  const v = new VisitContact({
    name: req.body.name || '', phone: phone.display, city: req.body.city || '', comment: req.body.comment || '',
    visitDate: req.body.visitDate || undefined, createdBy: req.user._id,
  });
  v.$locals.defaultCountryCode = prefs.defaultCountryCode;
  await v.save();
  res.status(201).json({ data: v });
});

exports.update = asyncHandler(async (req, res) => {
  const v = await find(req, req.params.id);
  if (!v) throw new ApiError(404, 'Entry not found');
  const prefs = await getPreferences(req.user);
  const b = req.body;
  if (b.phone !== undefined && String(b.phone).trim() !== v.phone) {
    const phone = checkPhone(b.phone, prefs.defaultCountryCode);
    if (!phone.ok) throw phoneError(phone);
    const dupe = await VisitContact.findOne(withOwner(req.user, { phoneNormalized: phone.digits, _id: { $ne: v._id } })).lean();
    if (dupe) throw new ApiError(409, 'Another entry already has this number.', undefined, 'DUPLICATE');
    v.phone = phone.display;
  }
  ['name', 'city', 'comment'].forEach((k) => { if (b[k] !== undefined) v[k] = b[k]; });
  if (b.visitDate !== undefined) v.visitDate = b.visitDate || undefined;
  if (b.status !== undefined && v.status !== 'converted') v.status = b.status; // a converted entry stays converted
  v.$locals.defaultCountryCode = prefs.defaultCountryCode;
  await v.save();
  res.json({ data: v });
});

exports.remove = asyncHandler(async (req, res) => {
  const v = await VisitContact.findOneAndDelete(withOwner(req.user, { _id: req.params.id }));
  if (!v) throw new ApiError(404, 'Entry not found');
  res.json({ message: 'Deleted' });
});

// Turns a met contact into a normal lead (goes through the same phone + duplicate rules as every other lead).
exports.convert = asyncHandler(async (req, res) => {
  const v = await find(req, req.params.id);
  if (!v) throw new ApiError(404, 'Entry not found');
  if (v.status === 'converted') throw new ApiError(400, 'Already converted to a lead');
  const prefs = await getPreferences(req.user);
  const b = req.body || {};
  const r = await createLeadFrom({
    businessName: (b.businessName || v.name || '').trim() || `Visit contact ${v.phone}`,
    phone: v.phone, city: v.city || prefs.defaultCity, category: b.category || '',
    notes: v.comment ? `Met in person. ${v.comment}` : 'Met in person.', dataSource: 'manual',
  }, { prefs, user: req.user, force: false });
  if (r.outcome === 'rejected') throw phoneError(r.error);
  if (r.outcome === 'duplicate') throw new ApiError(409, 'A lead with this number or name already exists.', r.duplicates, 'DUPLICATE');
  v.status = 'converted';
  v.convertedLeadId = r.lead._id;
  await v.save();
  res.json({ data: v, lead: r.lead });
});
