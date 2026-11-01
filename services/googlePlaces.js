const { env } = require('../config/env');
const ApiError = require('../utils/ApiError');
const { trackUsage } = require('./settingsService');

const BASE = 'https://places.googleapis.com/v1';
const MAX_RETRIES = 3;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isConfigured = () => Boolean(env.googleKey);

// Field masks. Phone / website / rating are Enterprise-tier fields (higher price) so they are opt-in.
function fieldMask({ includeContact = true, includeRating = true, prefix = 'places.', token = false } = {}) {
  const f = ['id', 'displayName', 'formattedAddress', 'types', 'googleMapsUri', 'location'];
  if (includeContact) f.push('nationalPhoneNumber', 'internationalPhoneNumber', 'websiteUri');
  if (includeRating) f.push('rating', 'userRatingCount');
  const mask = f.map((x) => `${prefix}${x}`);
  if (token) mask.push('nextPageToken');
  return mask.join(',');
}

async function request({ method = 'POST', path, body, mask, signal, usageType }) {
  if (!isConfigured()) throw new ApiError(503, 'Google Places API key is not configured on the server (GOOGLE_PLACES_API_KEY).');
  let attempt = 0;
  for (;;) {
    let res;
    try {
      res = await fetch(BASE + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env.googleKey, 'X-Goog-FieldMask': mask },
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') throw new ApiError(499, 'Request cancelled');
      await trackUsage(usageType, { ok: false });
      if (attempt < MAX_RETRIES) { attempt += 1; await sleep(400 * 2 ** attempt); continue; }
      throw new ApiError(502, `Could not reach Google Places API: ${err.message}`);
    }

    if (res.ok) {
      await trackUsage(usageType, { ok: true });
      return res.json();
    }
    await trackUsage(usageType, { ok: false });
    if (RETRYABLE.has(res.status) && attempt < MAX_RETRIES) { attempt += 1; await sleep(400 * 2 ** attempt); continue; }

    const data = await res.json().catch(() => ({}));
    const g = data.error?.message || res.statusText;
    if (res.status === 400) throw new ApiError(400, `Google rejected the request: ${g}`);
    if (res.status === 401 || res.status === 403) throw new ApiError(502, `Google denied access (check that "Places API (New)" is enabled, billing is on, and key restrictions allow this server): ${g}`);
    if (res.status === 404) throw new ApiError(404, 'Place not found (the Place ID may have expired - search again to get a fresh one)');
    if (res.status === 429) throw new ApiError(429, 'Google Places quota/rate limit reached. Try again shortly.');
    throw new ApiError(502, `Google Places error (${res.status}): ${g}`);
  }
}

const TEMP_TTL_MS = 30 * 60 * 1000;
function normalizePlace(p) {
  const now = Date.now();
  return {
    placeId: p.id,
    name: p.displayName?.text || '',
    address: p.formattedAddress || '',
    types: p.types || [],
    mapsUri: p.googleMapsUri || '',
    rating: p.rating ?? null,
    ratingCount: p.userRatingCount ?? null,
    phone: p.nationalPhoneNumber || '',
    internationalPhone: p.internationalPhoneNumber || '',
    website: p.websiteUri || '',
    location: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null,
    source: 'google_places',
    retrievedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TEMP_TTL_MS).toISOString(), // UI treats this as temporary content
  };
}

async function textSearch(opts, signal) {
  const { query, pageToken, pageSize = 20, minRating, includeContact, includeRating, regionCode, bias } = opts;
  const body = { textQuery: query, pageSize: Math.min(pageSize, 20), languageCode: 'en' };
  if (regionCode) body.regionCode = regionCode;
  if (minRating) body.minRating = Number(minRating);
  if (pageToken) body.pageToken = pageToken;
  if (bias) body.locationBias = { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: Math.min(bias.radius, 50000) } };
  const data = await request({ path: '/places:searchText', body, mask: fieldMask({ includeContact, includeRating, token: true }), signal, usageType: 'textSearch' });
  return { places: (data.places || []).map(normalizePlace), nextPageToken: data.nextPageToken || null };
}

// Nearby Search (New) has no pagination (max 20 results per call).
async function nearbySearch({ lat, lng, radius, includedTypes, max = 20, includeContact, includeRating }, signal) {
  const body = {
    maxResultCount: Math.min(max, 20), languageCode: 'en', rankPreference: 'POPULARITY',
    includedTypes,
    locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(radius, 50000) } },
  };
  const data = await request({ path: '/places:searchNearby', body, mask: fieldMask({ includeContact, includeRating }), signal, usageType: 'nearbySearch' });
  return { places: (data.places || []).map(normalizePlace), nextPageToken: null };
}

async function details(placeId, { includeContact = true, includeRating = true } = {}, signal) {
  const data = await request({
    method: 'GET', path: `/places/${encodeURIComponent(placeId)}`,
    mask: fieldMask({ includeContact, includeRating, prefix: '' }), signal, usageType: 'details',
  });
  return normalizePlace(data);
}

async function resolveCity({ city, state, country }, signal) {
  const query = [city, state, country].filter(Boolean).join(', ');
  const data = await request({
    path: '/places:searchText', body: { textQuery: query, pageSize: 1 },
    mask: 'places.id,places.displayName,places.formattedAddress,places.location', signal, usageType: 'geocode',
  });
  const p = data.places?.[0];
  if (!p?.location) throw new ApiError(404, `Could not find coordinates for "${query}"`);
  return { name: p.displayName?.text || city, address: p.formattedAddress, lat: p.location.latitude, lng: p.location.longitude };
}

async function testConnection(signal) {
  const data = await request({ path: '/places:searchText', body: { textQuery: 'Taj Mahal Agra', pageSize: 1 }, mask: 'places.id', signal, usageType: 'textSearch' });
  return { ok: true, sampleResults: (data.places || []).length };
}

module.exports = { isConfigured, textSearch, nearbySearch, details, resolveCity, testConnection };
