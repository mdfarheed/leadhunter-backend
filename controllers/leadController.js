const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPreferences } = require('../services/settingsService');
const { buildLeadFilter, buildSort } = require('../utils/leadFilter');
const { parsePagination, pageMeta } = require('../utils/pagination');

const { prepareNewLead, prepareLeadUpdate, importLeads, MAX_IMPORT } = require('../services/leadService');
const { trackNoPhone } = require('../services/settingsService');

// Phone / validation failures come back as 400 with a stable `code` and the offending field.
const validationError = (r) => new ApiError(400, r.message, [{ field: r.field, message: r.message }], r.code);

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

// The single place a new lead is written. Manual create, Google Places saves and bulk import ALL go through here.
async function createLeadFrom(input, { prefs, user, force = false }) {
  const prepared = prepareNewLead(input, prefs);
  if (!prepared.ok) return { outcome: 'rejected', error: prepared };
  const data = prepared.data;
  if (data.placeId) { data.placeIdSavedAt = new Date(); if (!input.dataSource) data.dataSource = 'google_places_reference'; }
  if (!force) {
    const duplicates = await findDuplicates(data);
    if (duplicates.length) return { outcome: 'duplicate', duplicates };
  }
  const lead = new Lead({ ...data, createdBy: user._id });
  lead.$locals.defaultCountryCode = prefs.defaultCountryCode;
  await lead.save();
  await LeadActivity.create({ lead: lead._id, type: 'created', message: `Lead created (${lead.dataSource.replace(/_/g, ' ')})`, createdBy: user._id });
  return { outcome: 'created', lead, warning: prepared.warning };
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
  const r = await createLeadFrom(req.body, { prefs, user: req.user, force: Boolean(req.body.force) });
  if (r.outcome === 'rejected') {
    if (r.error.code === 'PHONE_REQUIRED') await trackNoPhone({ rejectedSaves: 1 });
    throw validationError(r.error);
  }
  if (r.outcome === 'duplicate') return res.status(409).json({ message: 'A similar lead already exists', duplicates: r.duplicates });
  res.status(201).json({ data: r.lead, ...(r.warning ? { warning: r.warning } : {}) });
});

// Bulk save (Google Places "save selected / save all", imports). Records without a valid phone number are skipped and reported.
exports.importMany = asyncHandler(async (req, res) => {
  const prefs = await getPreferences();
  const { leads, defaults = {}, force = false } = req.body;
  if (!Array.isArray(leads) || !leads.length) throw new ApiError(400, 'Provide a non-empty "leads" array');
  if (leads.length > MAX_IMPORT) throw new ApiError(400, `Import at most ${MAX_IMPORT} leads per request`);
  const items = leads.map((l) => ({ ...defaults, ...l }));
  const out = await importLeads(items, {
    prefs, force: Boolean(force), findDuplicates,
    createLead: async (data) => {
      const r = await createLeadFrom(data, { prefs, user: req.user, force: true }); // duplicates were already checked by importLeads
      if (r.outcome !== 'created') throw new Error(r.error?.message || 'Could not save lead');
      return r.lead;
    },
  });
  await trackNoPhone({ rejectedSaves: out.summary.skippedNoPhone });
  res.json(out);
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
  const prefs = await getPreferences();
  const prepared = prepareLeadUpdate(req.body, lead, prefs);
  if (!prepared.ok) throw validationError(prepared);
  const { patch } = prepared;
  if (!req.body.force) {
    const dupes = await findDuplicates({ nameKey: patch.nameKey ?? lead.nameKey, cityKey: patch.cityKey ?? lead.cityKey, phoneNormalized: patch.phoneNormalized, placeId: patch.placeId }, lead._id);
    if (dupes.length) return res.status(409).json({ message: 'Another lead matches these details', duplicates: dupes });
  }
  const prevStatus = lead.status;
  const prevFollowUp = lead.nextFollowUpAt?.getTime();
  const acts = [];
  lead.$locals.defaultCountryCode = prefs.defaultCountryCode;
  lead.set(patch);
  await lead.save();
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
    const { status } = req.body;
    affected = (await Lead.updateMany({ _id: { $in: ids } }, { status })).modifiedCount;
    await LeadActivity.insertMany(ids.map((id) => ({ lead: id, type: 'bulk_update', message: `Status set to ${status} (bulk)`, createdBy: req.user._id })));
  } else if (action === 'followUp') {
    affected = (await Lead.updateMany({ _id: { $in: ids } }, { nextFollowUpAt: new Date(req.body.nextFollowUpAt) })).modifiedCount;
    await LeadActivity.insertMany(ids.map((id) => ({ lead: id, type: 'follow_up_set', message: `Follow-up set (bulk) for ${new Date(req.body.nextFollowUpAt).toDateString()}`, createdBy: req.user._id })));
  }
  res.json({ message: `${affected} lead(s) updated`, affected });
});
