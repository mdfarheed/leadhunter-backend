const AppSetting = require('../models/AppSetting');

const DEFAULT_PREFERENCES = {
  defaultCountry: 'India', defaultState: 'Uttar Pradesh', defaultCity: 'Etah', defaultCountryCode: '91', defaultTemplateId: null,
};

async function getPreferences() {
  const doc = await AppSetting.findOne({ key: 'preferences' }).lean();
  return { ...DEFAULT_PREFERENCES, ...(doc?.value || {}) };
}
async function savePreferences(patch) {
  const current = await getPreferences();
  const value = { ...current, ...patch };
  await AppSetting.findOneAndUpdate({ key: 'preferences' }, { value }, { upsert: true, new: true });
  return value;
}

// API usage counters (requests, results discovered, errors, per-day) - metadata only.
async function trackUsage(type, { ok = true } = {}) {
  const day = new Date().toISOString().slice(0, 10);
  const inc = { 'value.total': 1, [`value.${type}`]: 1, [`value.byDay.${day}`]: 1 };
  if (!ok) inc['value.errors'] = 1;
  await AppSetting.findOneAndUpdate({ key: 'apiUsage' }, { $inc: inc }, { upsert: true }).catch((e) => console.error('[usage]', e.message));
}
async function trackDiscovered(count) {
  if (!count) return;
  await AppSetting.findOneAndUpdate({ key: 'apiUsage' }, { $inc: { 'value.resultsDiscovered': count } }, { upsert: true }).catch(() => {});
}
async function getUsage() {
  const doc = await AppSetting.findOne({ key: 'apiUsage' }).lean();
  const v = doc?.value || {};
  const byDay = v.byDay || {};
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const monthTotal = Object.entries(byDay).filter(([d]) => d.startsWith(month)).reduce((s, [, n]) => s + n, 0);
  return {
    total: v.total || 0, textSearch: v.textSearch || 0, nearbySearch: v.nearbySearch || 0, details: v.details || 0,
    geocode: v.geocode || 0, errors: v.errors || 0, resultsDiscovered: v.resultsDiscovered || 0,
    today: byDay[today] || 0, thisMonth: monthTotal,
    last14Days: Object.entries(byDay).sort(([a], [b]) => (a < b ? -1 : 1)).slice(-14).map(([date, count]) => ({ date, count })),
  };
}

module.exports = { getPreferences, savePreferences, trackUsage, trackDiscovered, getUsage, DEFAULT_PREFERENCES };
