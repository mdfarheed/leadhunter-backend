const places = require('../services/googlePlaces');
const BusinessCategory = require('../models/BusinessCategory');
const SearchHistory = require('../models/SearchHistory');
const Lead = require('../models/Lead');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPreferences, getUsage, trackDiscovered, trackNoPhone } = require('../services/settingsService');
const { checkPhone } = require('../utils/phone');

// Abort the Google request if the browser cancels / disconnects.
function abortOnClose(req, res) {
  const ac = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ac.abort(); });
  return ac.signal;
}

const COUNTRY_REGION = { india: 'IN' };

async function context(b) {
  const prefs = await getPreferences();
  const city = b.city ?? prefs.defaultCity;
  const state = b.state ?? prefs.defaultState;
  const country = b.country ?? prefs.defaultCountry;
  const cat = b.category ? await BusinessCategory.findOne({ name: b.category }).lean() : null;
  return { city, state, country, cat, regionCode: COUNTRY_REGION[String(country).toLowerCase()] };
}

function applyFilters(list, b) {
  let out = list;
  if (b.minRating) out = out.filter((p) => (p.rating ?? 0) >= Number(b.minRating));
  if (b.hasPhone === 'yes') out = out.filter((p) => p.phone || p.internationalPhone);
  if (b.hasPhone === 'no') out = out.filter((p) => !p.phone && !p.internationalPhone);
  if (b.hasWebsite === 'yes') out = out.filter((p) => p.website);
  if (b.hasWebsite === 'no') out = out.filter((p) => !p.website);
  return out;
}

// A business can only become a lead if Google returned a usable phone number for it. Computed here so the UI never has to guess.
const NO_PHONE_MESSAGE = 'Phone number unavailable — this lead cannot be saved.';
function phoneInfo(p, cc) {
  const raw = p.phone || p.internationalPhone || '';
  const check = checkPhone(raw, cc);
  return check.ok
    ? { phoneAvailable: true, canSave: true, saveBlockedReason: null }
    : { phoneAvailable: Boolean(String(raw).trim()), canSave: false, saveBlockedReason: NO_PHONE_MESSAGE };
}

// Flags results that already exist as CRM leads (duplicate detection by Place ID) and whether each can be saved (phone present).
async function annotate(list, cc) {
  const ids = list.map((p) => p.placeId);
  const saved = await Lead.find({ placeId: { $in: ids } }).select('placeId').lean();
  const map = new Map(saved.map((l) => [l.placeId, String(l._id)]));
  return list.map((p) => ({ ...p, ...phoneInfo(p, cc), savedLeadId: map.get(p.placeId) || null }));
}

// Counts results without a phone (only meaningful when phone fields were requested from Google).
const countNoPhone = (list, cc, contactFetched) => (contactFetched ? list.filter((p) => !phoneInfo(p, cc).canSave).length : 0);

const wantsContact = (b) => b.includeContact !== false || b.hasPhone === 'yes' || b.hasPhone === 'no' || b.hasWebsite === 'yes' || b.hasWebsite === 'no';

async function recordHistory(req, { searchType, ctx, b, count, extra = {} }) {
  const h = await SearchHistory.create({
    keyword: b.keyword || '', city: ctx.city, state: ctx.state, category: b.category || '', searchType, resultCount: count, requestCount: 1,
    params: { country: ctx.country, minRating: b.minRating || null, hasPhone: b.hasPhone || 'any', hasWebsite: b.hasWebsite || 'any', includeContact: b.includeContact !== false, ...extra },
    createdBy: req.user._id,
  });
  return h._id;
}

exports.textSearch = asyncHandler(async (req, res) => {
  const b = req.body;
  const ctx = await context(b);
  const term = b.keyword || ctx.cat?.searchTerm || b.category;
  const query = `${term} in ${[ctx.city, ctx.state, ctx.country].filter(Boolean).join(', ')}`;
  const result = await places.textSearch({
    query, pageToken: b.pageToken, pageSize: b.pageSize || 20, minRating: b.minRating,
    includeContact: wantsContact(b), includeRating: b.includeRating !== false, regionCode: ctx.regionCode,
  }, abortOnClose(req, res));
  const prefs = await getPreferences();
  await trackDiscovered(result.places.length);
  const contactFetched = wantsContact(b);
  const noPhone = countNoPhone(result.places, prefs.defaultCountryCode, contactFetched);
  await trackNoPhone({ discovered: noPhone });
  const filtered = applyFilters(result.places, b);
  let historyId = null;
  if (!b.pageToken) historyId = await recordHistory(req, { searchType: 'text', ctx, b, count: filtered.length, extra: { query } });
  res.json({ places: await annotate(filtered, prefs.defaultCountryCode), fetchedCount: result.places.length, noPhoneCount: noPhone, contactFetched, nextPageToken: result.nextPageToken, query, historyId });
});

exports.nearbySearch = asyncHandler(async (req, res) => {
  const b = req.body;
  const ctx = await context(b);
  const signal = abortOnClose(req, res);
  let lat = Number(b.latitude);
  let lng = Number(b.longitude);
  let center = null;
  if (!lat || !lng) { center = await places.resolveCity(ctx, signal); lat = center.lat; lng = center.lng; }
  const radius = Number(b.radius);
  const types = ctx.cat?.googleTypes || [];
  let result;
  let mode = 'nearby';
  if (types.length) {
    result = await places.nearbySearch({ lat, lng, radius, includedTypes: types, includeContact: wantsContact(b), includeRating: b.includeRating !== false }, signal);
  } else {
    // No official Google place type for this category -> text search biased to the circle.
    const term = b.keyword || ctx.cat?.searchTerm || b.category;
    if (!term) throw new ApiError(400, 'Choose a category or enter a keyword');
    mode = 'text-biased';
    result = await places.textSearch({
      query: term, pageToken: b.pageToken, pageSize: b.pageSize || 20, minRating: b.minRating, includeContact: wantsContact(b),
      includeRating: b.includeRating !== false, regionCode: ctx.regionCode, bias: { lat, lng, radius },
    }, signal);
  }
  const prefs = await getPreferences();
  await trackDiscovered(result.places.length);
  const contactFetched = wantsContact(b);
  const noPhone = countNoPhone(result.places, prefs.defaultCountryCode, contactFetched);
  await trackNoPhone({ discovered: noPhone });
  const filtered = applyFilters(result.places, b);
  let historyId = null;
  if (!b.pageToken) historyId = await recordHistory(req, { searchType: 'nearby', ctx, b, count: filtered.length, extra: { radius, latitude: lat, longitude: lng, mode } });
  res.json({ places: await annotate(filtered, prefs.defaultCountryCode), fetchedCount: result.places.length, noPhoneCount: noPhone, contactFetched, nextPageToken: result.nextPageToken, center: { lat, lng, ...(center ? { name: center.name } : {}) }, mode, historyId });
});

exports.details = asyncHandler(async (req, res) => {
  const place = await places.details(req.params.placeId, {
    includeContact: req.query.contact !== 'false', includeRating: req.query.rating !== 'false',
  }, abortOnClose(req, res));
  const saved = await Lead.findOne({ placeId: place.placeId }).select('_id').lean();
  const prefs = await getPreferences();
  res.json({ place: { ...place, ...(req.query.contact !== 'false' ? phoneInfo(place, prefs.defaultCountryCode) : {}), savedLeadId: saved ? String(saved._id) : null } });
});

exports.resolveCity = asyncHandler(async (req, res) => {
  const ctx = await context(req.body);
  res.json(await places.resolveCity(ctx, abortOnClose(req, res)));
});

exports.usage = asyncHandler(async (req, res) => res.json({ configured: places.isConfigured(), usage: await getUsage() }));

exports.test = asyncHandler(async (req, res) => {
  if (!places.isConfigured()) return res.status(200).json({ ok: false, message: 'GOOGLE_PLACES_API_KEY is not set in backend/.env' });
  try {
    await places.testConnection(abortOnClose(req, res));
    res.json({ ok: true, message: 'Connected to Google Places API (New)' });
  } catch (e) {
    res.json({ ok: false, message: e.message });
  }
});
