// Phone normalisation for WhatsApp click-to-chat. Returns digits in international format (no "+").
function normalizePhone(raw, defaultCc = '91') {
  const input = String(raw ?? '').trim();
  if (!input) return { valid: false, reason: 'No phone number' };
  let digits = input.replace(/\D/g, '');
  let intl = input.startsWith('+');
  if (!intl && digits.startsWith('00')) { digits = digits.slice(2); intl = true; }
  if (!digits) return { valid: false, reason: 'No digits found' };

  let cc = defaultCc;
  let national;
  if (intl) {
    if (digits.startsWith(defaultCc)) national = digits.slice(defaultCc.length);
    else {
      if (digits.length < 8 || digits.length > 15) return { valid: false, reason: 'International number must be 8-15 digits' };
      if (digits.startsWith('0')) return { valid: false, reason: 'International numbers cannot start with 0' };
      return { valid: true, digits, cc: null, national: digits, isMobile: true, display: `+${digits}`, warning: null };
    }
  } else {
    digits = digits.replace(/^0+/, '');
    if (digits.startsWith(defaultCc) && digits.length >= defaultCc.length + (defaultCc === '91' ? 10 : 7) && (defaultCc !== '91' || digits.length === 12)) {
      national = digits.slice(defaultCc.length); // already carries country code - do not add it again
    } else {
      national = digits;
    }
  }

  if (cc === '91') {
    if (!/^\d{10}$/.test(national)) return { valid: false, reason: 'Indian numbers need 10 digits after +91' };
    const isMobile = /^[6-9]\d{9}$/.test(national);
    return {
      valid: true, digits: `91${national}`, cc, national, isMobile,
      display: `+91 ${national.slice(0, 5)} ${national.slice(5)}`,
      warning: isMobile ? null : 'This looks like a landline (STD) number - WhatsApp is unlikely to work on it',
    };
  }
  if (national.length < 6 || national.length > 13) return { valid: false, reason: 'Phone number length looks wrong' };
  return { valid: true, digits: `${cc}${national}`, cc, national, isMobile: true, display: `+${cc}${national}`, warning: null };
}

// Strict check used before a lead may be SAVED. A phone number is mandatory: missing / null / blank / whitespace-only /
// malformed values are all rejected. Valid numbers come back normalised (digits for wa.me + a display string to store).
const PHONE_REQUIRED_MESSAGE = 'Phone number is required. A business without a phone number cannot be saved as a lead.';
function checkPhone(raw, defaultCc = '91') {
  const input = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : '';
  if (!input) return { ok: false, code: 'PHONE_REQUIRED', message: PHONE_REQUIRED_MESSAGE };
  const n = normalizePhone(input, defaultCc);
  if (!n.valid) return { ok: false, code: 'PHONE_INVALID', message: `Invalid phone number: ${n.reason}.`, reason: n.reason };
  return { ok: true, digits: n.digits, display: n.display, isMobile: n.isMobile, warning: n.warning || null };
}

module.exports = { normalizePhone, checkPhone, PHONE_REQUIRED_MESSAGE };
