// Drives the REAL controllers, schema hooks and routes against in-memory models (see helpers/harness.js).
const test = require('node:test');
const assert = require('node:assert');
const { install, call } = require('./helpers/harness');

const env = install();
const { Lead, LeadActivity } = env;
const leads = require('../controllers/leadController');
const activities = require('../controllers/activityController');
const templatesCtl = require('../controllers/templateController');
const { TEMPLATES } = require('../utils/seedData');
const places = require('../controllers/placesController');
const dashboard = require('../controllers/dashboardController');
const exporter = require('../controllers/exportController');
const { buildLeadFilter } = require('../utils/leadFilter');

const mk = (o = {}) => ({ businessName: 'Sharma Clinic', phone: '98765 43210', city: 'Etah', category: 'Clinic', ...o });
const reset = () => { Lead._reset(); LeadActivity._reset(); env.appSetting._rows.clear(); };
const create = (b) => call(leads.create, { body: b });

test('create: phone missing / null / blank / invalid is rejected with a clear code; nothing is stored', async () => {
  reset();
  for (const phone of [undefined, null, '', '   ', 'abc', '12345']) {
    const r = await create(mk({ phone }));
    assert.strictEqual(r.status, 400, String(phone));
    assert.match(r.error.code, /^PHONE_(REQUIRED|INVALID)$/);
    assert.strictEqual(r.error.details[0].field, 'phone');
  }
  assert.strictEqual(Lead._store.length, 0);
  assert.strictEqual((await create({ businessName: 'No phone key at all' })).error.code, 'PHONE_REQUIRED');
  assert.strictEqual((await create(mk({ phone: '', force: true }))).status, 400);
});
test('create: valid phone saves and stores the normalised phone', async () => {
  reset();
  const r = await create(mk());
  assert.strictEqual(r.status, 201);
  const l = r.body.data;
  assert.strictEqual(l.phoneNormalized, '919876543210'); assert.strictEqual(l.phone, '+91 98765 43210');
});
test('model hook: saving a Lead directly without phone fails (no controller bypass)', async () => {
  reset();
  await assert.rejects(() => Lead.create({ businessName: 'Direct', phone: '' }), (e) => e.name === 'ValidationError' && Boolean(e.errors.phone));
  await assert.rejects(() => Lead.create({ businessName: 'Direct' }), (e) => e.name === 'ValidationError');
  const ok = await Lead.create({ businessName: 'Direct', phone: '9876543210' });
  assert.strictEqual(ok.phoneNormalized, '919876543210');
});
test('duplicates: same phone / same name+city still return 409, and no phone bypass for force', async () => {
  reset();
  await create(mk());
  assert.strictEqual((await create(mk({ businessName: 'Other', phone: '+91 98765 43210' }))).status, 409);
  assert.strictEqual((await create(mk({ businessName: 'sharma clinic', phone: '9000000001' }))).status, 409);
  assert.strictEqual((await create(mk({ businessName: 'Other', phone: '9000000002' }))).status, 201);
  assert.strictEqual((await create(mk({ businessName: 'Forced', phone: '9876543210', force: true }))).status, 201);
});
test('import endpoint: skips phoneless records, reports counts, saves valid ones, detects duplicates', async () => {
  reset();
  const r = await call(leads.importMany, { body: { defaults: { city: 'Etah' }, leads: [
    { businessName: 'A', phone: '9876543210', placeId: 'ChIJ_aaaaaaaaaa' },
    { businessName: 'B', placeId: 'ChIJ_bbbbbbbbbb' },
    { businessName: 'C', phone: '  ' },
    { businessName: 'D', phone: 'xx' },
    { businessName: 'E', phone: '9876543210' },
  ] } });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.summary, { received: 5, created: 1, skippedNoPhone: 2, skippedInvalidPhone: 1, skippedDuplicate: 1, skippedInvalid: 0, failed: 0 });
  assert.strictEqual(Lead._store.length, 1);
  assert.strictEqual(Lead._store[0].dataSource, 'google_places_reference');
  const usage = await call(dashboard.stats);
  assert.strictEqual(usage.body.phones.saveAttemptsRejectedNoPhone, 2);
});
test('update: cannot clear/invalidate a phone; legacy phoneless lead remains editable', async () => {
  reset();
  const id = (await create(mk())).body.data._id;
  assert.strictEqual((await call(leads.update, { params: { id }, body: { phone: '' } })).error.code, 'PHONE_REQUIRED');
  assert.strictEqual((await call(leads.update, { params: { id }, body: { phone: '12' } })).error.code, 'PHONE_INVALID');
  Lead._store.push(Object.assign(new Lead({ businessName: 'Legacy', phone: '', city: 'X' }, false), { _id: 'legacy1', status: 'New' }));
  Lead._store.at(-1)._orig = { phone: '' };
  const legacy = await call(leads.update, { params: { id: 'legacy1' }, body: { notes: 'edited', phone: '' } });
  assert.strictEqual(legacy.status, 200);
});
// ---- WhatsApp needs no consent; Do Not Contact still blocks ----
test('a lead with no consent record can be messaged and the contact can be confirmed (WhatsApp)', async () => {
  reset();
  const id = (await create(mk())).body.data._id;
  const done = await call(activities.create, { body: { lead: id, type: 'contacted', message: 'Contacted via WhatsApp' } });
  assert.strictEqual(done.status, 201);
});
test('"Do Not Contact" status still blocks contact; the Lead has no consent / verification fields any more', async () => {
  reset();
  const id = (await create(mk())).body.data._id;
  await call(leads.setStatus, { params: { id }, body: { status: 'Do Not Contact' } });
  const r = await call(activities.create, { body: { lead: id, type: 'contacted' } });
  assert.strictEqual(r.status, 400);
  const lead = (await call(leads.get, { params: { id } })).body.data;
  for (const k of Object.keys(lead)) assert.ok(!/consent|optIn|optOut|doNotContact|verif/i.test(k), `unexpected field ${k}`);
});

// ---- contact tracking ----
test('contactCount / lastContactedAt change only when the admin confirms "contacted"', async () => {
  reset();
  const id = (await create(mk())).body.data._id;
  let l = (await call(leads.get, { params: { id } })).body.data;
  assert.ok(!l.lastContactedAt); assert.strictEqual(l.contactCount, 0); assert.strictEqual(l.status, 'New');
  const done = await call(activities.create, { body: { lead: id, type: 'contacted', message: 'Sent intro' } });
  assert.strictEqual(done.status, 201);
  l = (await call(leads.get, { params: { id } })).body.data;
  assert.strictEqual(l.contactCount, 1); assert.ok(l.lastContactedAt); assert.strictEqual(l.status, 'Contacted');
  assert.strictEqual(l.whatsappStatus, 'unknown');
});

// ---- template rotation endpoints ----
test('rotation endpoints: next template advances only after markUsed, cycles 1..5 and back to 1, per category', async () => {
  reset();
  const { MessageTemplate } = { MessageTemplate: require('../models/MessageTemplate') };
  for (const t of TEMPLATES.filter((x) => x.category === 'School' || x.category === 'Salon')) await MessageTemplate.create({ ...t, isDefault: false });
  const nextName = async (category) => (await call(templatesCtl.next, { query: { category } })).body.data;
  const seen = [];
  for (let lead = 1; lead <= 6; lead += 1) {
    const t = await nextName('School');
    assert.strictEqual((await nextName('School'))._id, t._id); // asking twice does not advance
    seen.push(t.seedKey);
    await call(templatesCtl.markUsed, { body: { templateId: t._id } });
  }
  assert.deepStrictEqual(seen, ['school-1', 'school-2', 'school-3', 'school-4', 'school-5', 'school-1']);
  assert.strictEqual((await nextName('Salon')).seedKey, 'salon-1'); // other categories rotate independently
});

// ---- Google Places ----
test('places: results without phone are flagged unsaveable with the required message; results with phone are saveable', async () => {
  reset();
  const googlePlaces = require('../services/googlePlaces');
  const list = [{ placeId: 'ChIJ_1111111111', name: 'Has Phone', phone: '098765 43210' }, { placeId: 'ChIJ_2222222222', name: 'No Phone', phone: '' }, { placeId: 'ChIJ_3333333333', name: 'Intl', phone: '', internationalPhone: '+91 98111 22233' }];
  googlePlaces.textSearch = async () => ({ places: list, nextPageToken: null });
  const r = await call(places.textSearch, { body: { keyword: 'clinic', city: 'Etah', includeContact: true } });
  assert.strictEqual(r.status, 200, r.error && r.error.stack);
  const by = Object.fromEntries(r.body.places.map((p) => [p.name, p]));
  assert.strictEqual(by['Has Phone'].canSave, true);
  assert.strictEqual(by['Intl'].canSave, true);
  assert.strictEqual(by['No Phone'].canSave, false);
  assert.strictEqual(by['No Phone'].saveBlockedReason, 'Phone number unavailable — this lead cannot be saved.');
  assert.strictEqual(r.body.noPhoneCount, 1);
  const stats = await call(dashboard.stats);
  assert.strictEqual(stats.body.phones.skippedNoPhoneDiscovery, 1);
});

// ---- filters, dashboard, export ----
test('phone filters + dashboard + export reflect real stored data', async () => {
  reset();
  for (const [n, p] of [['A', '9811111111'], ['B', '9822222222']]) await create(mk({ businessName: n, phone: p }));
  Lead._store.push(Object.assign(new Lead({ businessName: 'Legacy no phone', phone: '' }, false), { _id: 'old1', status: 'New' }));
  const count = (q) => Lead.countDocuments(buildLeadFilter(q));
  assert.strictEqual(await count({ phoneStatus: 'valid' }), 2);
  assert.strictEqual(await count({ phoneStatus: 'missing' }), 1);
  assert.strictEqual(await count({ q: '98222', phoneStatus: 'valid' }), 1);
  const s = (await call(dashboard.stats)).body;
  assert.strictEqual(s.totalLeads, 3);
  assert.deepStrictEqual([s.phones.validPhone, s.phones.noPhone], [2, 1]);
  const json = (await call(exporter.json)).body;
  assert.ok('Business Name' in json.data[0]);
});

// ---- routes ----
test('every protected route is registered behind auth and has real handler functions', () => {
  require('../routes');
  const routes = env.routes;
  const want = ['POST /leads', 'POST /leads/import', 'PUT /leads/:id', 'GET /templates', 'GET /templates/next', 'POST /templates/rotation/used', 'POST /activities', 'POST /places/text-search', 'GET /export/leads/csv'];
  for (const w of want) {
    const [m, p] = w.split(' ');
    const r = routes.find((x) => x.method === m && x.path === p);
    assert.ok(r, `missing route ${w}`);
    r.handlers.flat().forEach((h) => assert.strictEqual(typeof h, 'function', `${w} has an undefined handler`));
  }
  const useIdx = routes.findIndex((r) => r.method === 'USE'); const first = routes.findIndex((r) => r.path === '/leads');
  assert.ok(useIdx >= 0 && useIdx < first, 'protect middleware must come before lead routes');
  assert.ok(routes.findIndex((r) => r.path === '/auth/login') < useIdx, 'login is the only public route');
  const publicRoutes = routes.slice(0, useIdx).map((r) => r.path);
  assert.deepStrictEqual(publicRoutes, ['/auth/login']);
});
test('contactCount / lastContactedAt are only written by the explicit "contacted" activity', () => {
  const fs = require('fs'); const path = require('path');
  const files = ['controllers', 'services', 'utils', 'routes'].flatMap((d) => fs.readdirSync(path.join(__dirname, '..', d)).filter((f) => f.endsWith('.js')).map((f) => path.join(d, f)));
  const writers = files.filter((f) => /(contactCount\s*\+=|lastContactedAt\s*=[^=])/.test(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')));
  assert.deepStrictEqual(writers, [path.join('controllers', 'activityController.js')]);
});
