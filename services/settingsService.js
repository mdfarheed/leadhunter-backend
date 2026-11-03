const AppSetting = require('../models/AppSetting');
const { currentUserId } = require('../utils/requestContext');

const DEFAULT_PREFERENCES = {
  defaultCountry: 'India', defaultState: 'Uttar Pradesh', defaultCity: 'Etah', defaultCountryCode: '91', defaultTemplateId: null,
};

// Preferences are per user (key "preferences:<userId>"). The admin falls back to the original shared "preferences" document,
// so an existing install keeps its settings. New users start with their own city as the default search city.
const prefKey = (user) => `preferences:${user._id}`;
async function getPreferences(user) {
  const base = { ...DEFAULT_PREFERENCES, ...(user?.city ? { defaultCity: user.city } : {}) };
  if (!user) return base;
  const own = await AppSetting.findOne({ key: prefKey(user) }).lean();
  if (own) return { ...base, ...own.value };
  if (user.role !== 'user') { const legacy = await AppSetting.findOne({ key: 'preferences' }).lean(); if (legacy) return { ...base, ...legacy.value }; }
  return base;
}
async function savePreferences(user, patch) {
  const value = { ...(await getPreferences(user)), ...patch };
  await AppSetting.findOneAndUpdate({ key: prefKey(user) }, { value }, { upsert: true, new: true });
  return value;
}

// API usage counters (requests, results discovered, errors, per-day) - metadata only. Every counter is kept twice: once globally
// ("apiUsage", what the admin sees - the Google key is shared) and once per user ("apiUsage:<id>", what each user sees).
async function bump(inc) {
  const uid = currentUserId();
  const keys = ['apiUsage', ...(uid ? [`apiUsage:${uid}`] : [])];
  await Promise.all(keys.map((key) => AppSetting.findOneAndUpdate({ key }, { $inc: inc }, { upsert: true }).catch((e) => console.error('[usage]', e.message))));
}
async function trackUsage(type, { ok = true } = {}) {
  const day = new Date().toISOString().slice(0, 10);
  const inc = { 'value.total': 1, [`value.${type}`]: 1, [`value.byDay.${day}`]: 1 };
  if (!ok) inc['value.errors'] = 1;
  await bump(inc);
}
async function trackDiscovered(count) {
  if (!count) return;
  await bump({ 'value.resultsDiscovered': count });
}
// Discovery results that had no phone number (they cannot be saved as leads) and save attempts rejected for the same reason.
async function trackNoPhone({ discovered = 0, rejectedSaves = 0 } = {}) {
  const inc = {};
  if (discovered) inc['value.resultsWithoutPhone'] = discovered;
  if (rejectedSaves) inc['value.savesRejectedNoPhone'] = rejectedSaves;
  if (!Object.keys(inc).length) return;
  await bump(inc);
}
// Admin: totals across all users. Normal user: only their own usage.
async function getUsage(user) {
  const key = !user || user.role !== 'user' ? 'apiUsage' : `apiUsage:${user._id}`;
  const doc = await AppSetting.findOne({ key }).lean();
  const v = doc?.value || {};
  const byDay = v.byDay || {};
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const monthTotal = Object.entries(byDay).filter(([d]) => d.startsWith(month)).reduce((s, [, n]) => s + n, 0);
  return {
    total: v.total || 0, textSearch: v.textSearch || 0, nearbySearch: v.nearbySearch || 0, details: v.details || 0,
    geocode: v.geocode || 0, errors: v.errors || 0, resultsDiscovered: v.resultsDiscovered || 0,
    resultsWithoutPhone: v.resultsWithoutPhone || 0, savesRejectedNoPhone: v.savesRejectedNoPhone || 0,
    today: byDay[today] || 0, thisMonth: monthTotal,
    last14Days: Object.entries(byDay).sort(([a], [b]) => (a < b ? -1 : 1)).slice(-14).map(([date, count]) => ({ date, count })),
  };
}

module.exports = { getPreferences, savePreferences, trackUsage, trackDiscovered, trackNoPhone, getUsage, DEFAULT_PREFERENCES };
