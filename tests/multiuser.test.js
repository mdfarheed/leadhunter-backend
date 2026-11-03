// Multi-user isolation, admin-only user management, Visit Personally, per-user rotation / settings / usage.
const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');
const { install, call } = require('./helpers/harness');

const env = install();
const { Lead, LeadActivity } = env;
const jwtFake = { verify: (t) => JSON.parse(t), sign: (p) => JSON.stringify(p) };
const prevLoad = Module._load;
Module._load = function load(request, ...rest) { return request === 'jsonwebtoken' ? jwtFake : prevLoad.call(this, request, ...rest); };

const User = require('../models/User');
const VisitContact = require('../models/VisitContact');
const MessageTemplate = require('../models/MessageTemplate');
const leads = require('../controllers/leadController');
const activities = require('../controllers/activityController');
const dashboard = require('../controllers/dashboardController');
const exporter = require('../controllers/exportController');
const users = require('../controllers/userController');
const visits = require('../controllers/visitController');
const templatesCtl = require('../controllers/templateController');
const settingsCtl = require('../controllers/settingsController');
const auth = require('../middleware/auth');
const { runWithUser } = require('../utils/requestContext');
const settingsService = require('../services/settingsService');
const { TEMPLATES } = require('../utils/seedData');

const admin = { _id: 'adm', role: 'admin', city: 'Etah' };
const legacyAdmin = { _id: 'old', city: 'Etah' }; // account created before roles existed
const A = { _id: 'ua', role: 'user', city: 'Agra' };
const B = { _id: 'ub', role: 'user', city: 'Delhi' };
const lead = (n, phone, extra = {}) => ({ businessName: n, phone, city: 'Etah', category: 'Clinic', ...extra });
const mk = (u, body) => call(leads.create, { body, user: u });
const reset = () => { Lead._reset(); LeadActivity._reset(); VisitContact._reset(); User._reset(); MessageTemplate._reset(); env.appSetting._rows.clear(); };

test('a user can only see and change their OWN leads (list, get, update, status, delete, activities, bulk, export, dashboard)', async () => {
  reset();
  const a1 = (await mk(A, lead('A Clinic', '9811111111'))).body.data;
  await mk(A, lead('A Two', '9822222222'));
  await mk(B, lead('B Clinic', '9833333333'));
  const list = async (u) => (await call(leads.list, { query: {}, user: u })).body.data.map((l) => l.businessName).sort();
  assert.deepStrictEqual(await list(A), ['A Clinic', 'A Two']);
  assert.deepStrictEqual(await list(B), ['B Clinic']);
  const id = a1._id;
  assert.strictEqual((await call(leads.get, { params: { id }, user: B })).status, 404);
  assert.strictEqual((await call(leads.update, { params: { id }, body: { notes: 'hacked' }, user: B })).status, 404);
  assert.strictEqual((await call(leads.setStatus, { params: { id }, body: { status: 'Converted' }, user: B })).status, 404);
  assert.strictEqual((await call(leads.remove, { params: { id }, user: B })).status, 404);
  assert.strictEqual((await call(activities.byLead, { params: { leadId: id }, user: B })).status, 404);
  assert.strictEqual((await call(activities.create, { body: { lead: id, type: 'note', message: 'x' }, user: B })).status, 404);
  // bulk actions with someone else's id must change nothing, and must not delete their history
  await call(activities.create, { body: { lead: id, type: 'note', message: 'mine' }, user: A });
  const bulk = await call(leads.bulkUpdate, { body: { ids: [id], action: 'delete' }, user: B });
  assert.strictEqual(bulk.body.affected, 0);
  assert.strictEqual((await call(leads.get, { params: { id }, user: A })).status, 200);
  assert.ok((await LeadActivity.find({ lead: id }).lean()).some((x) => x.message === 'mine'));
  // meta, export and dashboard only count own data
  assert.deepStrictEqual((await call(leads.meta, { user: B })).body.cities, ['Etah']);
  assert.strictEqual((await call(exporter.json, { user: B })).body.total, 1);
  assert.strictEqual((await call(dashboard.stats, { user: A })).body.totalLeads, 2);
  assert.strictEqual((await call(dashboard.stats, { user: B })).body.totalLeads, 1);
  assert.strictEqual((await call(dashboard.charts, { user: B })).body.conversion[0].count, 1);
  assert.strictEqual((await call(dashboard.recentActivity, { user: B })).body.data.length, 1);
});
test('duplicates are checked per user: two users may save the same phone / business / Google place', async () => {
  reset();
  assert.strictEqual((await mk(A, lead('Same Clinic', '9811111111', { placeId: 'ChIJ_same_place_1' }))).status, 201);
  assert.strictEqual((await mk(A, lead('Same Clinic', '9811111111', { placeId: 'ChIJ_same_place_1' }))).status, 409);
  assert.strictEqual((await mk(B, lead('Same Clinic', '9811111111', { placeId: 'ChIJ_same_place_1' }))).status, 201);
  const imp = await call(leads.importMany, { body: { leads: [lead('Same Clinic', '9811111111')] }, user: B });
  assert.strictEqual(imp.body.summary.skippedDuplicate, 1); // B's own copy
});
test('admin sees legacy leads that have no owner; normal users never do; legacy accounts without a role are admins', async () => {
  reset();
  Lead._store.push(Object.assign(new Lead(lead('Legacy', '9899999999'), false), { _id: 'leg1', status: 'New' })); // no createdBy
  const names = async (u) => (await call(leads.list, { query: {}, user: u })).body.data.map((l) => l.businessName);
  assert.deepStrictEqual(await names(admin), ['Legacy']);
  assert.deepStrictEqual(await names(legacyAdmin), ['Legacy']);
  assert.deepStrictEqual(await names(A), []);
  assert.strictEqual((await call(leads.get, { params: { id: 'leg1' }, user: A })).status, 404);
});

// ---- admin-only ----
test('adminOnly lets admins (incl. legacy accounts) through and stops normal users', async () => {
  const run = (user) => new Promise((resolve) => auth.adminOnly({ user }, {}, (e) => resolve(e)));
  assert.strictEqual(await run(admin), undefined);
  assert.strictEqual(await run(legacyAdmin), undefined);
  assert.strictEqual((await run(A)).status, 403);
});
test('protect: disabled accounts are rejected, signed-out tokens are rejected, active users pass and carry their id', async () => {
  reset();
  const act = await User.create({ name: 'Act', email: 'a@x.com', password: 'Passw0rdX', role: 'user', city: 'Agra', tokenVersion: 0 });
  const off = await User.create({ name: 'Off', email: 'o@x.com', password: 'Passw0rdX', role: 'user', city: 'Agra', tokenVersion: 0, active: false });
  const run = (u, tv = 0) => new Promise((resolve) => {
    const req = { headers: { authorization: `Bearer ${JSON.stringify({ id: u._id, tv })}` } };
    auth.protect(req, {}, (e) => resolve({ e, req }));
  });
  assert.strictEqual((await run(act)).e, undefined);
  assert.strictEqual((await run(off)).e.status, 403);
  assert.strictEqual((await run(act, 5)).e.status, 401);
});
test('route table: users/templates/categories mutations are admin-only; visits and leads are open to every signed-in user', () => {
  require('../routes');
  const find = (m, p) => env.routes.find((r) => r.method === m && r.path === p);
  for (const [m, p] of [['GET', '/users'], ['POST', '/users'], ['PATCH', '/users/:id'], ['DELETE', '/users/:id'], ['POST', '/templates'], ['PUT', '/templates/:id'],
    ['DELETE', '/templates/:id'], ['PATCH', '/templates/:id/default'], ['POST', '/categories'], ['PUT', '/categories/:id'], ['DELETE', '/categories/:id']]) {
    const r = find(m, p); assert.ok(r, `${m} ${p}`);
    assert.ok(r.handlers.flat().includes(auth.adminOnly), `${m} ${p} must be admin-only`);
  }
  for (const [m, p] of [['GET', '/visits'], ['POST', '/visits'], ['PUT', '/visits/:id'], ['DELETE', '/visits/:id'], ['POST', '/visits/:id/convert'], ['GET', '/templates'], ['POST', '/leads']]) {
    const r = find(m, p); assert.ok(r, `${m} ${p}`);
    assert.ok(!r.handlers.flat().includes(auth.adminOnly), `${m} ${p} must not be admin-only`);
  }
  assert.ok(!env.routes.some((r) => /register|signup/i.test(r.path)), 'no public registration route');
});

// ---- user management ----
test('admin creates users: role is forced to "user", weak/duplicate input rejected, password never returned', async () => {
  reset();
  const body = { name: 'Rahul', email: 'rahul@x.com', password: 'Secret123', city: 'Agra' };
  const r = await call(users.create, { body: { ...body, role: 'admin' }, user: admin });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.body.data.role, 'user'); assert.strictEqual(r.body.data.city, 'Agra'); assert.strictEqual(r.body.data.developerName, 'Rahul');
  assert.ok(!JSON.stringify(r.body).includes('Secret123'));
  assert.strictEqual((await call(users.create, { body: { ...body, email: 'b@x.com', password: 'short' }, user: admin })).status, 400);
  assert.strictEqual((await call(users.create, { body: { ...body, email: 'b@x.com', password: 'nodigitshere' }, user: admin })).status, 400);
  assert.strictEqual((await call(users.create, { body, user: admin })).status, 409);
});
test('admin can disable, reset password, and delete a user (deleting removes only that user\'s data); admin accounts are protected', async () => {
  reset();
  const u = (await call(users.create, { body: { name: 'U', email: 'u@x.com', password: 'Secret123', city: 'Agra' }, user: admin })).body.data;
  const other = (await call(users.create, { body: { name: 'V', email: 'v@x.com', password: 'Secret123', city: 'Delhi' }, user: admin })).body.data;
  const stored = User._store.find((x) => String(x._id) === String(u.id));
  const adminRow = await User.create({ name: 'Boss', email: 'boss@x.com', password: 'Secret123' }); // legacy-style admin, no role stored
  await mk({ _id: u.id, role: 'user' }, lead('U Lead', '9811111111'));
  await mk({ _id: other.id, role: 'user' }, lead('V Lead', '9822222222'));
  await call(visits.create, { body: { phone: '9855555555' }, user: { _id: u.id, role: 'user' } });
  const off = await call(users.update, { params: { id: u.id }, body: { active: false }, user: admin });
  assert.strictEqual(off.body.data.active, false); assert.strictEqual(stored.tokenVersion, 1);
  const pw = await call(users.update, { params: { id: u.id }, body: { newPassword: 'NewPass456' }, user: admin });
  assert.strictEqual(pw.status, 200); assert.strictEqual(stored.password, 'NewPass456'); assert.strictEqual(stored.tokenVersion, 2);
  assert.strictEqual((await call(users.update, { params: { id: u.id }, body: { newPassword: 'weak' }, user: admin })).status, 400);
  assert.strictEqual((await call(users.update, { params: { id: String(adminRow._id) }, body: { active: false }, user: admin })).status, 403);
  assert.strictEqual((await call(users.remove, { params: { id: String(adminRow._id) }, user: admin })).status, 403);
  const del = await call(users.remove, { params: { id: u.id }, user: admin });
  assert.strictEqual(del.status, 200);
  assert.deepStrictEqual(Lead._store.map((l) => l.businessName), ['V Lead']);
  assert.strictEqual(VisitContact._store.length, 0);
  assert.ok(!User._store.some((x) => String(x._id) === String(u.id)));
  const list = (await call(users.list, { user: admin })).body.data;
  assert.strictEqual(list.find((x) => x.id === other.id).leadCount, 1);
});

// ---- Visit Personally ----
const V = (u, body) => call(visits.create, { body, user: u });
test('visit personally: number required + validated, duplicates refused, comment/date kept, scoped per user', async () => {
  reset();
  for (const phone of [undefined, '', '   ', 'abc', '123']) assert.strictEqual((await V(A, { name: 'X', phone })).status, 400, String(phone));
  const ok = await V(A, { name: 'Sharma ji', phone: '98765 43210', comment: 'Sunday ko milenge', city: 'Etah', visitDate: '2030-01-05' });
  assert.strictEqual(ok.status, 201);
  assert.strictEqual(ok.body.data.phone, '+91 98765 43210'); assert.strictEqual(ok.body.data.status, 'pending'); assert.strictEqual(ok.body.data.comment, 'Sunday ko milenge');
  assert.strictEqual((await V(A, { phone: '+91 9876543210' })).status, 409);
  assert.strictEqual((await V(B, { phone: '9876543210' })).status, 201); // different user: allowed
  const listA = await call(visits.list, { query: {}, user: A });
  assert.strictEqual(listA.body.data.length, 1); assert.deepStrictEqual(listA.body.counts, { pending: 1 });
  const id = ok.body.data._id;
  assert.strictEqual((await call(visits.update, { params: { id }, body: { comment: 'x' }, user: B })).status, 404);
  assert.strictEqual((await call(visits.remove, { params: { id }, user: B })).status, 404);
  assert.strictEqual((await call(visits.convert, { params: { id }, body: {}, user: B })).status, 404);
  assert.strictEqual((await call(visits.list, { query: { q: 'sunday' }, user: A })).body.data.length, 1);
  assert.strictEqual((await call(visits.list, { query: { q: 'sunday', status: 'visited' }, user: A })).body.data.length, 0);
});
test('visit personally: edit, mark visited, convert to a normal lead (once), delete', async () => {
  reset();
  const id = (await V(A, { name: 'Gupta Store', phone: '9811111111', comment: 'Kal aayenge' })).body.data._id;
  assert.strictEqual((await call(visits.update, { params: { id }, body: { phone: '12' }, user: A })).status, 400);
  const up = await call(visits.update, { params: { id }, body: { status: 'visited', comment: 'Mil liye, interested' }, user: A });
  assert.strictEqual(up.body.data.status, 'visited');
  const conv = await call(visits.convert, { params: { id }, body: { category: 'Retail' }, user: A });
  assert.strictEqual(conv.status, 200);
  assert.strictEqual(conv.body.lead.businessName, 'Gupta Store'); assert.strictEqual(conv.body.lead.phoneNormalized, '919811111111');
  assert.match(conv.body.lead.notes, /Mil liye, interested/); assert.strictEqual(String(conv.body.lead.createdBy), 'ua');
  assert.strictEqual(conv.body.data.status, 'converted');
  assert.strictEqual((await call(visits.convert, { params: { id }, body: {}, user: A })).status, 400);
  assert.strictEqual((await call(visits.update, { params: { id }, body: { status: 'pending' }, user: A })).body.data.status, 'converted'); // stays converted
  // a second contact with the same number as an existing lead cannot be converted twice
  const id2 = (await V(A, { name: 'Dup', phone: '9811111112' })).body.data._id;
  await mk(A, lead('Dup', '9000000000', { city: 'Agra' })); // same name + city (A's default city) as the visit contact
  assert.strictEqual((await call(visits.convert, { params: { id: id2 }, body: {}, user: A })).status, 409);
  assert.strictEqual((await call(visits.remove, { params: { id: id2 }, user: A })).status, 200);
});
test('visit entry without a name still converts (named after the number)', async () => {
  reset();
  const id = (await V(A, { phone: '9811111111' })).body.data._id;
  const conv = await call(visits.convert, { params: { id }, body: {}, user: A });
  assert.match(conv.body.lead.businessName, /^Visit contact \+91 98111 11111$/);
});

// ---- per-user settings, rotation, usage ----
test('template rotation is kept separately for each user', async () => {
  reset();
  for (const t of TEMPLATES.filter((x) => x.category === 'School')) await MessageTemplate.create({ ...t, isDefault: false });
  const next = async (u) => (await call(templatesCtl.next, { query: { category: 'School' }, user: u })).body.data.seedKey;
  const used = async (u) => { const t = (await call(templatesCtl.next, { query: { category: 'School' }, user: u })).body.data; await call(templatesCtl.markUsed, { body: { templateId: t._id }, user: u }); };
  await used(A); await used(A); await used(A);
  assert.strictEqual(await next(A), 'school-4');
  assert.strictEqual(await next(B), 'school-1'); // B starts from the beginning
});
test('preferences are per user (new users default to their own city); admin keeps the original shared preferences', async () => {
  reset();
  assert.strictEqual((await settingsService.getPreferences(A)).defaultCity, 'Agra');
  await settingsService.savePreferences(A, { defaultCity: 'Mathura' });
  assert.strictEqual((await settingsService.getPreferences(A)).defaultCity, 'Mathura');
  assert.strictEqual((await settingsService.getPreferences(B)).defaultCity, 'Delhi');
  env.appSetting._rows.set('preferences', { defaultCity: 'Kasganj', defaultCountryCode: '91' }); // the old shared document
  assert.strictEqual((await settingsService.getPreferences(admin)).defaultCity, 'Kasganj');
  assert.strictEqual((await settingsService.getPreferences(B)).defaultCity, 'Delhi'); // users never inherit it
});
test('API usage is counted per user, the admin sees the total, a user sees only their own', async () => {
  reset();
  await runWithUser('ua', async () => { await settingsService.trackUsage('textSearch'); await settingsService.trackDiscovered(10); });
  await runWithUser('ub', async () => { await settingsService.trackUsage('textSearch'); await settingsService.trackNoPhone({ discovered: 3 }); });
  assert.deepStrictEqual([(await settingsService.getUsage(A)).total, (await settingsService.getUsage(A)).resultsDiscovered], [1, 10]);
  assert.deepStrictEqual([(await settingsService.getUsage(B)).total, (await settingsService.getUsage(B)).resultsWithoutPhone], [1, 3]);
  assert.strictEqual((await settingsService.getUsage(admin)).total, 2);
});
test('settings: profile exposes sender city + name; a user can set them; role is not editable', async () => {
  reset();
  const u = await User.create({ name: 'Rahul', email: 'r@x.com', password: 'Secret123', role: 'user', city: 'Agra' });
  const r = await call(settingsCtl.get, { user: u });
  assert.strictEqual(r.body.profile.city, 'Agra'); assert.strictEqual(r.body.profile.developerName, 'Rahul');
  await call(settingsCtl.update, { body: { profile: { city: 'Mathura', developerName: 'Rahul K', role: 'admin' } }, user: u });
  assert.strictEqual(u.city, 'Mathura'); assert.strictEqual(u.developerName, 'Rahul K'); assert.strictEqual(u.role, 'user');
});
