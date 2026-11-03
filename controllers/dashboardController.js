const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const asyncHandler = require('../utils/asyncHandler');
const { getUsage } = require('../services/settingsService');
const { withOwner, ownerFilter } = require('../utils/scope');
const { startOfDay, endOfDay } = require('../utils/leadFilter');
const { STATUSES } = Lead;

// Every dashboard number is computed from the signed-in user's own leads only.
const scoped = (user) => ({
  countDocuments: (f = {}) => Lead.countDocuments(withOwner(user, f)),
  aggregate: (pipeline) => Lead.aggregate([{ $match: ownerFilter(user) }, ...pipeline]),
});

const groupCount = (L, field, limit = 10) => L.aggregate([
  { $match: { [field]: { $nin: ['', null] } } },
  { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  { $sort: { count: -1 } }, { $limit: limit },
]).then((rows) => rows.map((r) => ({ name: r._id, count: r.count })));

exports.stats = asyncHandler(async (req, res) => {
  const L = scoped(req.user);
  const noSite = { $or: [{ website: '' }, { website: null }] };
  const [total, saved, withPhone, withWa, noWebsite, withWebsite, statusRows, overdue, today, upcoming, usage] = await Promise.all([
    L.countDocuments(),
    L.countDocuments({ dataSource: 'google_places_reference' }),
    L.countDocuments({ phone: { $nin: ['', null] } }),
    L.countDocuments({ whatsappStatus: 'available' }),
    L.countDocuments(noSite),
    L.countDocuments({ website: { $nin: ['', null] } }),
    L.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    L.countDocuments({ nextFollowUpAt: { $lt: startOfDay() } }),
    L.countDocuments({ nextFollowUpAt: { $gte: startOfDay(), $lte: endOfDay() } }),
    L.countDocuments({ nextFollowUpAt: { $gt: endOfDay() } }),
    getUsage(req.user),
  ]);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  statusRows.forEach((r) => { byStatus[r._id] = r.count; });
  const [validPhone, invalidPhone, noPhone] = await Promise.all([
    L.countDocuments({ phoneNormalized: { $nin: ['', null] } }),
    L.countDocuments({ phone: { $nin: ['', null] }, $or: [{ phoneNormalized: { $exists: false } }, { phoneNormalized: null }, { phoneNormalized: '' }] }),
    L.countDocuments({ $or: [{ phone: '' }, { phone: null }, { phone: { $exists: false } }] }),
  ]);
  res.json({
    phones: { validPhone, invalidPhone, noPhone, skippedNoPhoneDiscovery: usage.resultsWithoutPhone, saveAttemptsRejectedNoPhone: usage.savesRejectedNoPhone },
    totalLeads: total, totalDiscovered: usage.resultsDiscovered, savedLeads: saved, withPhone, withWhatsApp: withWa,
    withoutWebsite: noWebsite, withWebsite, byStatus, followUps: { overdue, today, upcoming },
  });
});

exports.charts = asyncHandler(async (req, res) => {
  const L = scoped(req.user);
  const since = new Date(); since.setMonth(since.getMonth() - 11); since.setDate(1); since.setHours(0, 0, 0, 0);
  const [byCategory, byCity, statusRows, monthlyRows, contacted, total] = await Promise.all([
    groupCount(L, 'category'), groupCount(L, 'city'),
    L.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    L.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } }]),
    L.countDocuments({ lastContactedAt: { $ne: null } }),
    L.countDocuments(),
  ]);
  const byStatus = STATUSES.map((s) => ({ name: s, count: statusRows.find((r) => r._id === s)?.count || 0 }));
  const map = new Map(monthlyRows.map((r) => [r._id, r.count]));
  const monthly = [];
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(since); d.setMonth(since.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthly.push({ month: d.toLocaleString('en', { month: 'short', year: '2-digit' }), count: map.get(key) || 0 });
  }
  const c = (s) => byStatus.find((x) => x.name === s).count;
  const conversion = [
    { name: 'Total leads', count: total }, { name: 'Contacted at least once', count: contacted },
    { name: 'Interested', count: c('Interested') }, { name: 'Converted', count: c('Converted') },
  ];
  res.json({ byCategory, byCity, byStatus, monthly, conversion });
});

exports.recentActivity = asyncHandler(async (req, res) => {
  const data = await LeadActivity.find(ownerFilter(req.user)).sort({ createdAt: -1 }).limit(15).populate('lead', 'businessName').lean();
  res.json({ data });
});
