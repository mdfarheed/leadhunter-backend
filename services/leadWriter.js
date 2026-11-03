// The single place a new lead is written (manual create, Google Places saves, bulk import, visit-to-lead conversion).
const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const { prepareNewLead } = require('./leadService');
const { withOwner } = require('../utils/scope');

async function findDuplicates(data, excludeId, user) {
  const or = [];
  if (data.placeId) or.push({ placeId: data.placeId });
  if (data.phoneNormalized) or.push({ phoneNormalized: data.phoneNormalized });
  if (data.nameKey) or.push({ nameKey: data.nameKey, cityKey: data.cityKey || '' });
  if (!or.length) return [];
  const q = { $or: or }; // duplicates are checked inside the user's OWN leads only
  if (excludeId) q._id = { $ne: excludeId };
  return Lead.find(withOwner(user, q)).select('businessName phone city status placeId').limit(5).lean();
}

async function createLeadFrom(input, { prefs, user, force = false }) {
  const prepared = prepareNewLead(input, prefs);
  if (!prepared.ok) return { outcome: 'rejected', error: prepared };
  const data = prepared.data;
  if (data.placeId) { data.placeIdSavedAt = new Date(); if (!input.dataSource) data.dataSource = 'google_places_reference'; }
  if (!force) {
    const duplicates = await findDuplicates(data, undefined, user);
    if (duplicates.length) return { outcome: 'duplicate', duplicates };
  }
  const lead = new Lead({ ...data, createdBy: user._id });
  lead.$locals.defaultCountryCode = prefs.defaultCountryCode;
  await lead.save();
  await LeadActivity.create({ lead: lead._id, type: 'created', message: `Lead created (${lead.dataSource.replace(/_/g, ' ')})`, createdBy: user._id });
  return { outcome: 'created', lead, warning: prepared.warning };
}

module.exports = { findDuplicates, createLeadFrom };
