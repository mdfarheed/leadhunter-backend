// Lead input preparation + bulk import orchestration. No database access here: callers inject what they need, which keeps the
// phone rules in ONE place for manual create, Google Places saves, bulk import and edits (and makes them unit-testable).
const { checkPhone } = require('../utils/phone');
const { STATUSES: STATUS_LIST } = require('../utils/leadConstants');

// Fields an API client may set on a lead.
const EDITABLE = ['businessName', 'category', 'ownerName', 'phone', 'whatsappNumber', 'whatsappStatus', 'website', 'city', 'state', 'country',
  'address', 'dataSource', 'contactSource', 'placeId', 'status', 'notes', 'lastContactedAt', 'nextFollowUpAt'];

const pick = (src = {}) => EDITABLE.reduce((o, k) => (src[k] !== undefined ? { ...o, [k]: src[k] } : o), {});

const fail = (code, message, field) => ({ ok: false, code, message, field });

function normaliseCommon(out) {
  if (out.website) out.website = /^https?:\/\//i.test(out.website) ? out.website : `https://${out.website}`;
  ['nextFollowUpAt', 'lastContactedAt'].forEach((k) => { if (out[k] === '') out[k] = null; });
  return out;
}

/**
 * Validates and normalises the input for a NEW lead. Returns { ok:true, data } or { ok:false, code, message, field }.
 * `force` (duplicate override) is never consulted here - it cannot bypass phone validation.
 */
function prepareNewLead(input, prefs = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const data = pick(src);
  if (typeof data.businessName !== 'string' || !data.businessName.trim()) return fail('NAME_REQUIRED', 'Business name is required', 'businessName');

  const phone = checkPhone(data.phone, prefs.defaultCountryCode || '91');
  if (!phone.ok) return fail(phone.code, phone.message, 'phone');
  data.phone = phone.display;
  data.phoneNormalized = phone.digits;

  if (String(data.whatsappNumber ?? '').trim()) {
    const wa = checkPhone(data.whatsappNumber, prefs.defaultCountryCode || '91');
    if (!wa.ok) return fail('WHATSAPP_NUMBER_INVALID', `WhatsApp number: ${wa.message}`, 'whatsappNumber');
    data.whatsappNumber = wa.display;
  } else delete data.whatsappNumber;

  data.nameKey = data.businessName.trim().toLowerCase();
  data.cityKey = String(data.city ?? '').trim().toLowerCase();
  if (!data.country && prefs.defaultCountry) data.country = prefs.defaultCountry;
  if (!data.placeId) delete data.placeId;
  if (data.status !== undefined && !STATUS_LIST.includes(data.status)) return fail('STATUS_INVALID', 'Invalid status', 'status');
  return { ok: true, data: normaliseCommon(data), warning: phone.warning };
}

/**
 * Validates an UPDATE. The phone is only re-validated when the value actually changes, so legacy leads that never had a
 * phone remain editable; but once a phone is being changed it must be a valid, non-empty number.
 */
function prepareLeadUpdate(input, existing = {}, prefs = {}) {
  const patch = pick(input);
  const cc = prefs.defaultCountryCode || '91';
  let phoneChanged = false;

  if (patch.phone !== undefined) {
    const incoming = typeof patch.phone === 'string' || typeof patch.phone === 'number' ? String(patch.phone).trim() : '';
    const current = String(existing.phone ?? '').trim();
    if (incoming === current && !incoming) delete patch.phone; // legacy lead with no phone, still none -> leave alone
    else if (incoming === current) { // unchanged: just refresh the derived value, do not reject legacy formats
      delete patch.phone;
      const c = checkPhone(current, cc);
      if (c.ok && existing.phoneNormalized !== c.digits) patch.phoneNormalized = c.digits;
    } else {
      const phone = checkPhone(patch.phone, cc);
      if (!phone.ok) return fail(phone.code, phone.message, 'phone');
      patch.phone = phone.display;
      patch.phoneNormalized = phone.digits;
      phoneChanged = true;
    }
  }
  if (patch.whatsappNumber !== undefined) {
    if (String(patch.whatsappNumber ?? '').trim()) {
      const wa = checkPhone(patch.whatsappNumber, cc);
      if (!wa.ok) return fail('WHATSAPP_NUMBER_INVALID', `WhatsApp number: ${wa.message}`, 'whatsappNumber');
      patch.whatsappNumber = wa.display;
      if (wa.digits !== existing.whatsappVerifiedNumber) phoneChanged = true;
    } else { patch.whatsappNumber = ''; phoneChanged = true; }
  }
  if (patch.businessName !== undefined && !String(patch.businessName).trim()) return fail('NAME_REQUIRED', 'Business name is required', 'businessName');
  if (patch.status !== undefined && !STATUS_LIST.includes(patch.status)) return fail('STATUS_INVALID', 'Invalid status', 'status');
  if (patch.businessName !== undefined || patch.city !== undefined) {
    patch.nameKey = String(patch.businessName ?? existing.businessName ?? '').trim().toLowerCase();
    patch.cityKey = String(patch.city ?? existing.city ?? '').trim().toLowerCase();
  }
  if (patch.placeId === '') patch.placeId = undefined;
  return { ok: true, patch: normaliseCommon(patch), phoneChanged };
}

const MAX_IMPORT = 100;

/**
 * Bulk import (Google Places "save selected / save all", file imports...). Every record goes through prepareNewLead, so a record
 * without a valid phone is SKIPPED and counted - never silently saved. Duplicates are skipped with the existing detection logic.
 * deps: { prefs, findDuplicates(data) -> array, createLead(data) -> lead, force }
 */
async function importLeads(items, deps) {
  const { prefs, findDuplicates, createLead, force = false } = deps;
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  const summary = { received: items.length, created: 0, skippedNoPhone: 0, skippedInvalidPhone: 0, skippedDuplicate: 0, skippedInvalid: 0, failed: 0 };
  const results = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const label = typeof item?.businessName === 'string' ? item.businessName : '';
    const base = { index, businessName: label, placeId: item?.placeId || null };
    const prepared = prepareNewLead(item, prefs);
    if (!prepared.ok) {
      if (prepared.code === 'PHONE_REQUIRED') summary.skippedNoPhone += 1;
      else if (prepared.code === 'PHONE_INVALID') summary.skippedInvalidPhone += 1;
      else summary.skippedInvalid += 1;
      results.push({ ...base, outcome: 'skipped', code: prepared.code, reason: prepared.message });
      continue;
    }
    try {
      if (!force) {
        const dupes = await findDuplicates(prepared.data);
        if (dupes.length) {
          summary.skippedDuplicate += 1;
          results.push({ ...base, outcome: 'duplicate', code: 'DUPLICATE', reason: 'A similar lead already exists', duplicateOf: String(dupes[0]._id || '') || null });
          continue;
        }
      }
      const lead = await createLead(prepared.data);
      summary.created += 1;
      results.push({ ...base, outcome: 'created', leadId: String(lead._id) });
    } catch (e) {
      summary.failed += 1;
      results.push({ ...base, outcome: 'failed', code: 'ERROR', reason: e.message });
    }
  }
  return { summary, results };
}

module.exports = { EDITABLE, MAX_IMPORT, pick, prepareNewLead, prepareLeadUpdate, importLeads };
