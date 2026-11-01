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

module.exports = { normalizePhone };
