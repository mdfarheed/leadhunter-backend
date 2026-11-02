const PLACEHOLDERS = ['businessName', 'category', 'city', 'ownerName', 'developerName'];
const FALLBACKS = {
  businessName: 'Team',
  category: 'business',
  city: 'aapka shehar',
  ownerName: 'Team',
  developerName: '[Your Name]',
};

// Replaces supported {{placeholders}}; unknown placeholders are left untouched. Reports which values were missing.
function renderTemplate(body, vars = {}) {
  const missing = new Set();
  const text = String(body ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    if (!PLACEHOLDERS.includes(key)) return match;
    const value = String(vars[key] ?? '').trim();
    if (value) return value;
    missing.add(key);
    return FALLBACKS[key];
  });
  return { text, missing: [...missing] };
}

function findUnsupported(body) {
  const bad = new Set();
  String(body ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) => { if (!PLACEHOLDERS.includes(key)) bad.add(key); return m; });
  return [...bad];
}

function buildWhatsAppUrl(digits, message) {
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

module.exports = { PLACEHOLDERS, FALLBACKS, renderTemplate, findUnsupported, buildWhatsAppUrl };
