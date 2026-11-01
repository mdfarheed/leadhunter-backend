const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { normalizePhone } = require('../utils/phone');
const { getPreferences } = require('../services/settingsService');
const { buildLeadFilter, buildSort } = require('../utils/leadFilter');
const { parsePagination, pageMeta } = require('../utils/pagination');

const EDITABLE = ['businessName', 'category', 'ownerName', 'phone', 'whatsappNumber', 'whatsappStatus', 'website', 'city', 'state', 'country',
  'address', 'dataSource', 'contactSource', 'placeId', 'status', 'notes', 'lastContactedAt', 'nextFollowUpAt'];

const pick = (src) => EDITABLE.reduce((o, k) => (src[k] !== undefined ? { ...o, [k]: src[k] } : o), {});

async function derive(data, existing) {
  const out = { ...data };
  const prefs = await getPreferences();
  if (out.businessName !== undefined || out.city !== undefined) {
    out.nameKey = String(out.businessName ?? existing?.businessName ?? '').trim().toLowerCase();
    out.cityKey = String(out.city ?? existing?.city ?? '').trim().toLowerCase();
  }
  if (out.phone !== undefined) {
    const n = normalizePhone(out.phone, prefs.defaultCountryCode);
    out.phoneNormalized = n.valid ? n.digits : undefined;
  }
  if (out.website) out.website = /^https?:\/\//i.test(out.website) ? out.website : `https://${out.website}`;
  ['nextFollowUpAt', 'lastContactedAt'].forEach((k) => { if (out[k] === '') out[k] = null; });
  return out;
}

async function findDuplicates(data, excludeId) {
  const or = [];
  if (data.placeId) or.push({ placeId: data.placeId });
  if (data.phoneNormalized) or.push({ phoneNormalized: data.phoneNormalized });
  if (data.nameKey) or.push({ nameKey: data.nameKey, cityKey: data.cityKey || '' });
  if (!or.length) return [];
  const q = { $or: or };
  if (excludeId) q._id = { $ne: excludeId };
  return Lead.find(q).select('businessName phone city status placeId').limit(5).lean();
}

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 20, 200);
  const filter = buildLeadFilter(req.query);
  const [data, total] = await Promise.all([
    Lead.find(filter).sort(buildSort(req.query)).collation({ locale: 'en', strength: 2 }).skip(skip).limit(limit).lean(),
    Lead.countDocuments(filter),
  ]);
  res.json({ data, pagination: pageMeta(page, limit, total) });
});

exports.meta = asyncHandler(async (req, res) => {
  const [categories, cities] = await Promise.all([Lead.distinct('category'), Lead.distinct('city')]);
  res.json({ categories: categories.filter(Boolean).sort(), cities: cities.filter(Boolean).sort() });
});

exports.create = asyncHandler(async (req, res) => {
  const prefs = await getPreferences();
  const data = await derive({ country: prefs.defaultCountry, ...pick(req.body) });
  if (!data.placeId) delete data.placeId;
  if (data.placeId) { data.placeIdSavedAt = new Date(); if (!req.body.dataSource) data.dataSource = 'google_places_reference'; }
  if (!req.body.force) {
    const dupes = await findDuplicates(data);
    if (dupes.length) return res.status(409).json({ message: 'A similar lead already exists', duplicates: dupes });
  }
  const lead = await Lead.create({ ...data, createdBy: req.user._id });
  await LeadActivity.create({ lead: lead._id, type: 'created', message: `Lead created (${lead.dataSource.replace(/_/g, ' ')})`, createdBy: req.user._id });
  res.status(201).json({ data: lead });
});

exports.get = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id).lean();
  if (!lead) throw new ApiError(404, 'Lead not found');
  const activities = await LeadActivity.find({ lead: lead._id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ data: lead, activities });
});

exports.update = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead not found');
  const patch = await derive(pick(req.body), lead);
  if (patch.placeId === '') patch.placeId = undefined;
  if (!req.body.force) {
    const dupes = await findDuplicates({ ...patch, nameKey: patch.nameKey ?? lead.nameKey, cityKey: patch.cityKey ?? lead.cityKey, phoneNormalized: patch.phoneNormalized }, lead._id);
    if (dupes.length) return res.status(409).json({ message: 'Another lead matches these details', duplicates: dupes });
  }
  const prevStatus = lead.status;
  const prevFollowUp = lead.nextFollowUpAt?.getTime();
  lead.set(patch);
  await lead.save();
  const acts = [];
  if (patch.status && patch.status !== prevStatus) acts.push({ type: 'status_change', message: `Status changed: ${prevStatus} → ${lead.status}` });
  if (patch.nextFollowUpAt !== undefined && lead.nextFollowUpAt?.getTime() !== prevFollowUp) {
    acts.push({ type: 'follow_up_set', message: lead.nextFollowUpAt ? `Follow-up set for ${lead.nextFollowUpAt.toDateString()}` : 'Follow-up cleared' });
  }
  if (!acts.length) acts.push({ type: 'updated', message: 'Lead details updated' });
  await LeadActivity.insertMany(acts.map((a) => ({ ...a, lead: lead._id, createdBy: req.user._id })));
  res.json({ data: lead });
});

exports.remove = asyncHandler(async (req, res) => {
  const lead = await Lead.findByIdAndDelete(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead not found');
  await LeadActivity.deleteMany({ lead: lead._id });
  res.json({ message: 'Lead deleted' });
});

exports.setStatus = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead not found');
  const prev = lead.status;
  lead.status = req.body.status;
  await lead.save();
  if (prev !== lead.status) await LeadActivity.create({ lead: lead._id, type: 'status_change', message: `Status changed: ${prev} → ${lead.status}`, createdBy: req.user._id });
  res.json({ data: lead });
});

exports.bulkUpdate = asyncHandler(async (req, res) => {
  const { ids, action } = req.body;
  let affected = 0;
  if (action === 'delete') {
    affected = (await Lead.deleteMany({ _id: { $in: ids } })).deletedCount;
    await LeadActivity.deleteMany({ lead: { $in: ids } });
  } else if (action === 'status') {
    affected = (await Lead.updateMany({ _id: { $in: ids } }, { status: req.body.status })).modifiedCount;
    await LeadActivity.insertMany(ids.map((id) => ({ lead: id, type: 'bulk_update', message: `Status set to ${req.body.status} (bulk)`, createdBy: req.user._id })));
  } else if (action === 'followUp') {
    affected = (await Lead.updateMany({ _id: { $in: ids } }, { nextFollowUpAt: new Date(req.body.nextFollowUpAt) })).modifiedCount;
    await LeadActivity.insertMany(ids.map((id) => ({ lead: id, type: 'follow_up_set', message: `Follow-up set (bulk) for ${new Date(req.body.nextFollowUpAt).toDateString()}`, createdBy: req.user._id })));
  }
  res.json({ message: `${affected} lead(s) updated`, affected });
});
