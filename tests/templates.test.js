const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { TEMPLATES } = require('../utils/seedData');
const { renderTemplate, findUnsupported, PLACEHOLDERS } = require('../utils/templateUtils');
const { planSeed, isEmptyPlan, sha256 } = require('../utils/templateSeedPlan');
const legacy = require('../utils/legacyTemplateHashes.json');

const CATEGORIES = ['General Business', 'School', 'College', 'Hospital', 'Clinic', 'Dental Clinic', 'Salon', 'Beauty Parlour', 'Restaurant', 'Hotel', 'Real Estate', 'E-commerce', 'Follow-up', 'Custom'];
const vars = { businessName: 'Sharma Clinic', category: 'Clinic', city: 'Etah', developerName: 'Farheed' };

test('all 14 categories have exactly five default templates, one default each', () => {
  assert.strictEqual(TEMPLATES.length, 70);
  for (const c of CATEGORIES) {
    const list = TEMPLATES.filter((t) => t.category === c);
    assert.strictEqual(list.length, 5, c);
    assert.strictEqual(list.filter((t) => t.isDefault).length, 1, `${c} default`);
    assert.strictEqual(new Set(list.map((t) => t.name)).size, 5, `${c} unique names`);
  }
  assert.strictEqual(new Set(TEMPLATES.map((t) => t.seedKey)).size, 70);
});
test('placeholders are supported and render fully; greeting uses {{businessName}}', () => {
  for (const t of TEMPLATES) {
    assert.deepStrictEqual(findUnsupported(t.body), [], t.seedKey);
    const { text, missing } = renderTemplate(t.body, vars);
    assert.ok(!/\{\{|\}\}/.test(text), `${t.seedKey} unresolved placeholder`);
    assert.deepStrictEqual(missing, [], t.seedKey);
    assert.ok(text.startsWith('Namaste Sharma Clinic,'), t.seedKey);
    assert.ok(text.includes('Regards,\nFarheed\nWeb Development & Digital Solutions'), t.seedKey);
    assert.ok(text.includes('Main Etah se hoon, mera naam Farheed hai.'), `${t.seedKey} intro`);
    assert.ok(t.body.length <= 4000);
  }
  assert.ok(PLACEHOLDERS.includes('businessName'));
});
test('templates avoid forbidden greetings and risky claims', () => {
  const banned = /\b(principal|manager|owner|sir|madam|ji)\b|guarantee|100%|assured|no\.?\s*1\b|best in|double your|more customers|zaroor badh/i;
  for (const t of TEMPLATES) assert.ok(!banned.test(t.body), `${t.seedKey}: ${(t.body.match(banned) || [])[0]}`);
});
test('every template ends with the YES / STOP question, right before the signature', () => {
  for (const t of TEMPLATES) {
    assert.match(t.body, /Agar aap interested hain, to "YES" bol dijiye\. Agar aapko is tarah ke messages nahi chahiye, to "STOP" type kar dijiye\.\n\nRegards,\nFarheed\nWeb Development & Digital Solutions$/, t.seedKey);
  }
});
test('missing placeholder values fall back to neutral text (no Sir/Madam)', () => {
  const r = renderTemplate('Namaste {{businessName}} {{ownerName}}', {});
  assert.strictEqual(r.text, 'Namaste Team Team');
});

// ---- seed plan: idempotent, preserves customisations ----
let n = 0;
const apply = (docs, plan) => {
  const next = docs.map((d) => ({ ...d }));
  plan.updates.forEach((u) => Object.assign(next.find((d) => String(d._id) === u.id), u.patch));
  plan.inserts.forEach((d) => next.push({ ...d, _id: `n${++n}`, createdAt: new Date(n), updatedAt: new Date(n) }));
  return next;
};
test('seed creates 70 templates on a fresh DB, one active default per category, and is idempotent', () => {
  const plan = planSeed([], TEMPLATES, { legacy });
  assert.strictEqual(plan.inserts.length, 70);
  const db = apply([], plan);
  for (const c of CATEGORIES) assert.strictEqual(db.filter((d) => d.category === c && d.isDefault && d.isActive).length, 1, c);
  assert.ok(isEmptyPlan(planSeed(db, TEMPLATES, { legacy })), 'second run must change nothing');
  assert.ok(isEmptyPlan(planSeed(apply(db, planSeed(db, TEMPLATES, { legacy })), TEMPLATES, { legacy })));
});
const history = require('../utils/starterTemplateHistory.json');
test('seed upgrades UNEDITED older starter text to the new text, keeps edited ones, and is idempotent afterwards', () => {
  const db = apply([], planSeed([], TEMPLATES, { legacy })).map((d, i) => ({ ...d, _id: `x${i}` }));
  const unedited = db.find((d) => d.seedKey === 'clinic-2'); unedited.body = 'OLD TEXT';
  const edited = db.find((d) => d.seedKey === 'clinic-3'); edited.body = 'ADMIN EDIT';
  // simulate an older shipped version by registering its hash
  const h = { ...history, 'clinic-2': [require('../utils/templateSeedPlan').sha256('OLD TEXT')] };
  const plan = planSeed(db, TEMPLATES, { legacy, history: h });
  assert.strictEqual(plan.report.upgraded, 1);
  assert.strictEqual(plan.updates.length, 1);
  const after = apply(db, plan);
  assert.strictEqual(after.find((d) => d.seedKey === 'clinic-2').body, TEMPLATES.find((t) => t.seedKey === 'clinic-2').body);
  assert.strictEqual(after.find((d) => d.seedKey === 'clinic-3').body, 'ADMIN EDIT');
    assert.strictEqual(planSeed(after, TEMPLATES, { legacy, history: h }).report.upgraded, 0);
  assert.strictEqual(planSeed(db, TEMPLATES, { legacy, history: h, overwrite: true }).report.upgraded, 2);
});
test('seed preserves user-created templates and edited starter templates', () => {
  const first = apply([], planSeed([], TEMPLATES, { legacy }));
  const custom = { _id: 'c1', name: 'My own pitch', category: 'School', body: 'Hello {{businessName}}', isActive: true, isDefault: false };
  const edited = first.find((d) => d.seedKey === 'school-2'); edited.body = 'EDITED BY ADMIN'; edited._id = 'e1';
  const db = [...first.map((d, i) => ({ ...d, _id: d._id || `x${i}` })), custom];
  const plan = planSeed(db, TEMPLATES, { legacy });
  assert.ok(isEmptyPlan(plan));
  assert.strictEqual(db.find((d) => d._id === 'c1').body, 'Hello {{businessName}}');
});
test('seed does not resurrect starter templates the admin deleted (unless restore)', () => {
  const first = apply([], planSeed([], TEMPLATES, { legacy })).map((d, i) => ({ ...d, _id: `x${i}` }));
  const without = first.filter((d) => d.seedKey !== 'hotel-3');
  assert.ok(isEmptyPlan(planSeed(without, TEMPLATES, { legacy, deletedKeys: ['hotel-3'] })));
  assert.strictEqual(planSeed(without, TEMPLATES, { legacy, deletedKeys: ['hotel-3'], restore: true }).inserts.length, 1);
});
test('seed repairs duplicate defaults and a missing default', () => {
  const base = apply([], planSeed([], TEMPLATES, { legacy })).map((d, i) => ({ ...d, _id: `x${i}` }));
  base.filter((d) => d.category === 'Salon').forEach((d) => { d.isDefault = true; });
  base.filter((d) => d.category === 'Hotel').forEach((d) => { d.isDefault = false; });
  const fixed = apply(base, planSeed(base, TEMPLATES, { legacy }));
  for (const c of ['Salon', 'Hotel']) assert.strictEqual(fixed.filter((d) => d.category === c && d.isDefault).length, 1, c);
});
test('legacy: unedited old starters are deactivated; edited ones and unrelated ones are kept; adoption keeps content', () => {
  const l = legacy.find((x) => x.name === 'Professional Website Introduction');
  const gen1 = require('fs').readFileSync(path.join(__dirname, '..', 'utils', 'legacyTemplateHashes.json'), 'utf8');
  assert.ok(gen1.includes(l.sha256));
  const untouched = { _id: 'l1', name: l.name, category: l.category, body: 'will not match hash', isActive: true, isDefault: true };
  const plan = planSeed([untouched], TEMPLATES, { legacy });
  assert.strictEqual(plan.report.legacyKept, 1); // body differs from original => treated as customised
  const adopt = { _id: 'a1', name: TEMPLATES[0].name, category: TEMPLATES[0].category, body: 'my version', isActive: true, isDefault: true };
  const p2 = planSeed([adopt], TEMPLATES, { legacy });
  assert.strictEqual(p2.report.adopted, 1);
  assert.ok(!p2.updates.some((u) => u.patch.body));
  assert.strictEqual(sha256(' x '), sha256('x'));
});

// ---- 10. no WhatsApp Web / QR / unofficial integrations ----
const SKIP = new Set(['node_modules', '.git', 'dist', 'tests']);
function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out); else if (/\.(jsx?|json|md|html)$/.test(f.name) && !/package-lock/.test(f.name)) out.push(p);
  }
  return out;
}
test('WhatsApp Web / QR / Baileys / browser-automation integrations are absent', () => {
  const root = path.join(__dirname, '..', '..');
  const forbidden = /whatsapp-web\.js|baileys|@whiskeysockets|venom-bot|wppconnect|puppeteer|playwright|selenium|qrcode|qr-code|web\.whatsapp\.com|api\.whatsapp\.com\/send/i;
  const hits = walk(root).filter((f) => !/README\.md$|whatsappProviders[\\/]README\.md$|\.env\.example$/.test(f)).filter((f) => forbidden.test(fs.readFileSync(f, 'utf8')));
  assert.deepStrictEqual(hits.map((h) => path.relative(root, h)), []);
});

// ---- Click-to-Chat (frontend code, imported as ESM) ----
test('frontend Click-to-Chat builds the official wa.me link and renders all seeded templates', async () => {
  const fe = await import('../../frontend/src/utils/templateUtils.js');
  const { normalizePhone } = await import('../../frontend/src/utils/phone.js');
  const n = normalizePhone('98765 43210', '91');
  const msg = fe.renderTemplate(TEMPLATES[0].body, vars).text;
  const url = fe.buildWhatsAppUrl(n.digits, msg);
  assert.ok(url.startsWith('https://wa.me/919876543210?text='));
  assert.strictEqual(decodeURIComponent(url.split('?text=')[1]), msg);
  assert.strictEqual(normalizePhone('0000000000', '91').valid, false);
  for (const t of TEMPLATES) assert.ok(!/\{\{/.test(fe.renderTemplate(t.body, vars).text));
});
test('WhatsAppModal opens wa.me only from the button handler and never records a contact by itself', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'leads', 'WhatsAppModal.jsx'), 'utf8');
  assert.ok(!/activitiesApi/.test(src), 'must not import the activity API');
  assert.ok(!/type:\s*'contacted'/.test(src) && !/(lastContactedAt|contactCount)\s*(\+?=)[^=]/.test(src) && !/(lastContactedAt|contactCount)\s*:/.test(src));
  assert.strictEqual((src.match(/window\.open\(/g) || []).length, 1);
  const openFn = src.slice(src.indexOf('const open = () =>'), src.indexOf('const recentlyContacted'));
  assert.match(openFn, /if \(!canOpen\) return;/);
  assert.match(openFn, /buildWhatsAppUrl\(phone\.digits, message\)/);
  assert.match(openFn, /templatesApi\.markUsed\(selected\._id\)/); // rotation advances on open
});
