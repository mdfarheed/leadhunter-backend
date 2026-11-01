const test = require('node:test');
const assert = require('node:assert');
const { normalizePhone } = require('../utils/phone');
const { renderTemplate, findUnsupported, buildWhatsAppUrl } = require('../utils/templateUtils');
const { buildLeadFilter } = require('../utils/leadFilter');

test('phone: plain 10-digit Indian mobile gets 91', () => assert.strictEqual(normalizePhone('98765 43210').digits, '919876543210'));
test('phone: +91 with formatting', () => assert.strictEqual(normalizePhone('+91 (98765)-43210').digits, '919876543210'));
test('phone: already has 91 without plus is not doubled', () => assert.strictEqual(normalizePhone('919876543210').digits, '919876543210'));
test('phone: leading 0 trunk prefix removed', () => assert.strictEqual(normalizePhone('09876543210').digits, '919876543210'));
test('phone: 0091 prefix', () => assert.strictEqual(normalizePhone('00919876543210').digits, '919876543210'));
test('phone: too short is invalid', () => assert.strictEqual(normalizePhone('12345').valid, false));
test('phone: empty is invalid', () => assert.strictEqual(normalizePhone('').valid, false));
test('phone: landline flagged not mobile', () => { const r = normalizePhone('05742234567'); assert.ok(r.valid && !r.isMobile && r.warning); });
test('phone: foreign international number kept', () => assert.strictEqual(normalizePhone('+44 7911 123456').digits, '447911123456'));

test('template: replaces placeholders', () => {
  const r = renderTemplate('Hi {{businessName}} from {{ city }}', { businessName: 'Sharma Clinic', city: 'Etah' });
  assert.strictEqual(r.text, 'Hi Sharma Clinic from Etah'); assert.deepStrictEqual(r.missing, []);
});
test('template: uses fallback and reports missing', () => {
  const r = renderTemplate('Namaste {{businessName}} ji, {{ownerName}}', { businessName: 'X' });
  assert.strictEqual(r.text, 'Namaste X ji, Sir/Madam'); assert.deepStrictEqual(r.missing, ['ownerName']);
});
test('template: unknown placeholders detected', () => assert.deepStrictEqual(findUnsupported('{{businessName}} {{foo}}'), ['foo']));
test('whatsapp url encodes message', () => {
  const u = buildWhatsAppUrl('919876543210', 'Namaste ji,\nKya hal? & more');
  assert.strictEqual(u, 'https://wa.me/919876543210?text=Namaste%20ji%2C%0AKya%20hal%3F%20%26%20more');
});
test('lead filter: builds status / phone filters and escapes regex', () => {
  const f = buildLeadFilter({ status: 'New,Interested', hasPhone: 'yes', q: 'a.b(' });
  assert.deepStrictEqual(f.status, { $in: ['New', 'Interested'] });
  assert.ok(f.$and.length === 2);
  assert.ok(f.$and[0].$or[0].businessName.test('xa.b(y')); assert.ok(!f.$and[0].$or[0].businessName.test('xaXb(y'));
});
