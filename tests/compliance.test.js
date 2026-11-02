const test = require('node:test');
const assert = require('node:assert');
const { checkPhone } = require('../utils/phone');
const { prepareNewLead, prepareLeadUpdate, importLeads } = require('../services/leadService');
const { buildLeadFilter } = require('../utils/leadFilter');
const { nextInRotation, orderTemplates } = require('../utils/templateRotation');

const GOOD = '98765 43210';

// ---- 1-3. phone is mandatory ----
test('phone: missing / null / empty / whitespace / garbage are all rejected', () => {
  for (const v of [undefined, null, '', '   ', '\t\n', {}, [], 'abc', '12345', '0000000000']) assert.strictEqual(checkPhone(v).ok, false, `value ${JSON.stringify(v)}`);
  assert.strictEqual(checkPhone(undefined).code, 'PHONE_REQUIRED');
  assert.strictEqual(checkPhone('   ').code, 'PHONE_REQUIRED');
  assert.strictEqual(checkPhone('12345').code, 'PHONE_INVALID');
});
test('phone: valid numbers are normalised', () => {
  const r = checkPhone('098765-43210');
  assert.ok(r.ok); assert.strictEqual(r.digits, '919876543210'); assert.strictEqual(r.display, '+91 98765 43210');
});
test('new lead without phone fails; invalid fails; valid works', () => {
  assert.strictEqual(prepareNewLead({ businessName: 'A' }).code, 'PHONE_REQUIRED');
  assert.strictEqual(prepareNewLead({ businessName: 'A', phone: null }).code, 'PHONE_REQUIRED');
  assert.strictEqual(prepareNewLead({ businessName: 'A', phone: '   ' }).code, 'PHONE_REQUIRED');
  assert.strictEqual(prepareNewLead({ businessName: 'A', phone: '123' }).code, 'PHONE_INVALID');
  const ok = prepareNewLead({ businessName: 'A', phone: GOOD, city: 'Etah' });
  assert.ok(ok.ok); assert.strictEqual(ok.data.phoneNormalized, '919876543210'); assert.strictEqual(ok.data.cityKey, 'etah');
});
test('`force` cannot bypass phone validation', () => {
  assert.strictEqual(prepareNewLead({ businessName: 'A', force: true }).ok, false);
});
test('create input can never carry consent / DNC / verification fields', () => {
  const r = prepareNewLead({ businessName: 'A', phone: GOOD, whatsappConsentStatus: 'opted_in', whatsappOptIn: true, optInSource: 'other', optInEvidence: 'x'.repeat(20), doNotContact: false, whatsappVerificationStatus: 'whatsapp_registered' });
  for (const k of ['whatsappConsentStatus', 'whatsappOptIn', 'optInSource', 'optInEvidence', 'doNotContact', 'whatsappVerificationStatus']) assert.ok(!(k in r.data), k);
});

// ---- edits ----
test('edit: legacy lead without phone stays editable; changing/clearing phone is validated', () => {
  assert.ok(prepareLeadUpdate({ phone: '', notes: 'x' }, { phone: '' }).ok);
  assert.strictEqual(prepareLeadUpdate({ phone: '' }, { phone: '+91 98765 43210' }).code, 'PHONE_REQUIRED');
  assert.strictEqual(prepareLeadUpdate({ phone: '12' }, { phone: '+91 98765 43210' }).code, 'PHONE_INVALID');
  const r = prepareLeadUpdate({ phone: '9123456789' }, { phone: '+91 98765 43210' });
  assert.ok(r.ok && r.phoneChanged && r.patch.phoneNormalized === '919123456789');
  assert.ok(prepareLeadUpdate({ phone: '+91 98765 43210' }, { phone: '+91 98765 43210', phoneNormalized: '919876543210' }).ok);
});

// ---- 4-6. bulk import / duplicates ----
test('bulk import skips records without a valid phone, counts them, and detects duplicates', async () => {
  const saved = [];
  const findDuplicates = async (d) => saved.filter((s) => s.phoneNormalized === d.phoneNormalized || (s.nameKey === d.nameKey && s.cityKey === d.cityKey)).map((s) => ({ _id: s._id }));
  const createLead = async (d) => { const l = { ...d, _id: `id${saved.length}` }; saved.push(l); return l; };
  const items = [
    { businessName: 'Good One', phone: '9876543210', city: 'Etah' },
    { businessName: 'No Phone', city: 'Etah', placeId: 'p2' },
    { businessName: 'Blank Phone', phone: '  ' },
    { businessName: 'Bad Phone', phone: '12-34' },
    { businessName: 'Same Phone Other Name', phone: '+91 98765 43210' },
    { businessName: 'good one', phone: '9000000001', city: 'ETAH' },
    { businessName: 'Second Good', phone: '9811111111' },
  ];
  const { summary, results } = await importLeads(items, { prefs: {}, findDuplicates, createLead });
  assert.deepStrictEqual(summary, { received: 7, created: 2, skippedNoPhone: 2, skippedInvalidPhone: 1, skippedDuplicate: 2, skippedInvalid: 0, failed: 0 });
  assert.strictEqual(saved.length, 2);
  assert.ok(results.find((r) => r.businessName === 'No Phone').outcome === 'skipped');
});
test('bulk import never saves a record that has no phone even when force is on', async () => {
  const saved = [];
  await importLeads([{ businessName: 'X' }], { prefs: {}, force: true, findDuplicates: async () => [], createLead: async (d) => { saved.push(d); return { _id: 1 }; } });
  assert.strictEqual(saved.length, 0);
});

// ---- 7. filters ----
test('lead filters: phone status composes with search and other filters', () => {
  assert.strictEqual(buildLeadFilter({ phoneStatus: 'invalid' }).$and.length, 1);
  assert.strictEqual(buildLeadFilter({ phoneStatus: 'missing' }).$and.length, 1);
  assert.strictEqual(buildLeadFilter({ q: '98765', phoneStatus: 'valid', city: 'Etah' }).$and.length >= 2, true);
});
test('create input cannot carry unknown / internal fields', () => {
  const r = prepareNewLead({ businessName: 'A', phone: GOOD, phoneNormalized: '1', nameKey: 'x', whatsappConsentStatus: 'opted_in' });
  assert.strictEqual(r.data.phoneNormalized, '919876543210'); // derived from the phone, not taken from the request
  assert.ok(!('whatsappConsentStatus' in r.data));
});

// ---- template rotation ----
const tpl = (n, extra = {}) => ({ _id: `t${n}`, seedKey: `school-${n}`, createdAt: new Date(n), ...extra });
test('rotation: lead 1 -> template 1, lead 2 -> template 2 ... 5 -> template 5, then back to 1', () => {
  const list = [5, 3, 1, 4, 2].map((n) => tpl(n)); // unordered on purpose
  assert.deepStrictEqual(orderTemplates(list).map((t) => t._id), ['t1', 't2', 't3', 't4', 't5']);
  let last; const used = [];
  for (let lead = 1; lead <= 7; lead += 1) { const n = nextInRotation(list, last); used.push(n.template._id); last = n.template._id; }
  assert.deepStrictEqual(used, ['t1', 't2', 't3', 't4', 't5', 't1', 't2']);
  assert.deepStrictEqual([nextInRotation(list, undefined).position, nextInRotation(list, 't5').position, nextInRotation(list, 't5').total], [1, 1, 5]);
});
test('rotation: deleted last-used template restarts at 1; admin-added templates join the cycle; empty list is null', () => {
  const list = [1, 2, 3].map((n) => tpl(n));
  assert.strictEqual(nextInRotation(list, 'gone').template._id, 't1');
  const extra = [...list, { _id: 'mine', createdAt: new Date(99) }];
  assert.strictEqual(nextInRotation(extra, 't3').template._id, 'mine');
  assert.strictEqual(nextInRotation(extra, 'mine').template._id, 't1');
  assert.strictEqual(nextInRotation([], 'x'), null);
});
