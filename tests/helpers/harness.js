/*
 * Test harness: runs the REAL schemas, schema hooks, controllers, validators wiring and routes without MongoDB / Express installed.
 *  - `mongoose` is replaced by a tiny Schema recorder; models are rebuilt as in-memory collections that execute the real
 *    pre('validate') hook, enum and required checks defined in the real schema.
 *  - express / express-validator / other third-party packages are replaced by recorders or no-op proxies.
 * It is NOT a replacement for an integration run against MongoDB, but it exercises the application code paths for real.
 */
const Module = require('module');
const path = require('path');

const backend = path.join(__dirname, '..', '..');
const proxyStub = () => {
  const fn = function stub() { return proxy; }; // eslint-disable-line no-use-before-define
  const proxy = new Proxy(fn, { get: (t, k) => (k === 'then' ? undefined : k === Symbol.toPrimitive ? () => '' : proxy), apply: () => proxy, construct: () => proxy });
  return proxy;
};

// ---------- mini mongoose ----------
class Schema {
  constructor(def, opts) { this.def = def; this.opts = opts; this.hooks = {}; this.indexes = []; this.methods = {}; }
  pre(name, fn) { (this.hooks[name] = this.hooks[name] || []).push(fn); return this; }
  index(spec, opts) { this.indexes.push({ spec, opts }); return this; }
}
Schema.Types = { ObjectId: 'ObjectId', Mixed: 'Mixed' };
const mongoose = { Schema, models: {}, Types: { ObjectId: class ObjectId {} }, model(name, schema) { const m = { modelName: name, schema }; mongoose.models[name] = m; return m; } };

// ---------- in-memory collection built from a real schema ----------
let seq = 0;
const newId = () => (++seq).toString(16).padStart(24, '0');
const clone = (o) => JSON.parse(JSON.stringify(o), (k, v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v) ? new Date(v) : v));

function matches(doc, filter) {
  return Object.entries(filter || {}).every(([key, cond]) => {
    if (key === '$or') return cond.some((c) => matches(doc, c));
    if (key === '$and') return cond.every((c) => matches(doc, c));
    if (key === '$nor') return !cond.some((c) => matches(doc, c));
    const v = doc[key];
    if (cond instanceof RegExp) return cond.test(v ?? '');
    if (cond && typeof cond === 'object' && !(cond instanceof Date) && Object.keys(cond).some((k) => k.startsWith('$'))) {
      return Object.entries(cond).every(([op, arg]) => {
        const same = (a) => (a === null ? v == null : String(a) === String(v)); // eslint-disable-line eqeqeq
        if (op === '$in') return arg.some(same);
        if (op === '$nin') return !arg.some(same);
        if (op === '$ne') return !same(arg);
        if (op === '$exists') return (v !== undefined) === arg;
        if (op === '$lt') return v != null && v < arg; // eslint-disable-line eqeqeq
        if (op === '$lte') return v != null && v <= arg; // eslint-disable-line eqeqeq
        if (op === '$gt') return v != null && v > arg; // eslint-disable-line eqeqeq
        if (op === '$gte') return v != null && v >= arg; // eslint-disable-line eqeqeq
        throw new Error(`harness: unsupported operator ${op}`);
      });
    }
    return cond === null ? v == null : String(v) === String(cond); // eslint-disable-line eqeqeq
  });
}

function makeModel(real) {
  const { schema } = real;
  const store = [];
  const fieldDefs = Object.entries(schema.def);

  class Doc {
    constructor(data = {}, isNew = true) {
      Object.defineProperty(this, '$locals', { value: {}, enumerable: false, writable: true });
      Object.defineProperty(this, 'isNew', { value: isNew, enumerable: false, writable: true });
      Object.defineProperty(this, '_orig', { value: {}, enumerable: false, writable: true });
      Object.defineProperty(this, '_invalid', { value: [], enumerable: false, writable: true });
      Object.assign(this, data);
      if (isNew) {
        fieldDefs.forEach(([k, d]) => { if (this[k] === undefined && d && d.default !== undefined) this[k] = typeof d.default === 'function' ? d.default() : d.default; });
      } else this._orig = clone({ ...this });
    }
    isModified(p) { return this.isNew ? this[p] !== undefined : JSON.stringify(this[p]) !== JSON.stringify(this._orig[p]); }
    invalidate(p, message) { this._invalid.push({ path: p, message }); }
    set(obj) { Object.entries(obj).forEach(([k, v]) => { this[k] = v; }); return this; }
    async save() {
      this._invalid.length = 0;
      for (const hook of schema.hooks.validate || []) await new Promise((res, rej) => { hook.call(this, (e) => (e ? rej(e) : res())); }); // eslint-disable-line no-await-in-loop
      fieldDefs.forEach(([k, d]) => {
        if (!d || typeof d !== 'object') return;
        const v = this[k];
        if (d.required && (v === undefined || v === '' || v === null)) this.invalidate(k, `${k} is required`);
        if (d.enum && v !== undefined && v !== null && !d.enum.includes(v)) this.invalidate(k, `${v} is not a valid enum value for ${k}`);
        if (d.maxlength && typeof v === 'string' && v.length > d.maxlength) this.invalidate(k, `${k} is too long`);
      });
      if (this._invalid.length) {
        const err = new Error('Validation failed');
        err.name = 'ValidationError';
        err.errors = Object.fromEntries(this._invalid.map((e) => [e.path, e]));
        throw err;
      }
      if (this.isNew) { this._id = newId(); this.createdAt = new Date(); this.isNew = false; store.push(this); }
      this.updatedAt = new Date();
      this._orig = clone({ ...this });
      return this;
    }
  }

  const query = (getter) => {
    const q = { _lean: false, _sel: null, then(res, rej) { return Promise.resolve(getter(this._lean)).then(res, rej); }, catch(rej) { return this.then(undefined, rej); } };
    ['select', 'limit', 'sort', 'collation', 'skip', 'populate'].forEach((m) => { q[m] = () => q; });
    q.lean = () => { q._lean = true; return q; };
    return q;
  };
  const out = (docs, lean) => (lean ? docs.map((d) => clone({ ...d })) : docs);

  class Model extends Doc {
    static find(filter) { return query((lean) => out(store.filter((d) => matches(d, filter)), lean)); }
    static findOne(filter) { return query((lean) => out(store.filter((d) => matches(d, filter)).slice(0, 1), lean)[0] || null); }
    static findById(id) { return Model.findOne({ _id: id }); }
    static async create(data) { const d = new Model(data); await d.save(); return d; }
    static async insertMany(arr) { return Promise.all(arr.map((a) => Model.create(a))); }
    static async countDocuments(filter) { return store.filter((d) => matches(d, filter)).length; }
    static async exists(filter) { return store.some((d) => matches(d, filter)) ? { _id: 1 } : null; }
    static async updateMany(filter, update) {
      const hit = store.filter((d) => matches(d, filter));
      hit.forEach((d) => Object.assign(d, update.$set || update));
      return { modifiedCount: hit.length };
    }
    static async deleteMany(filter) { const keep = store.filter((d) => !matches(d, filter)); const n = store.length - keep.length; store.splice(0, store.length, ...keep); return { deletedCount: n }; }
    static async findByIdAndDelete(id) { const d = store.find((x) => x._id === id); if (d) store.splice(store.indexOf(d), 1); return d || null; }
    static async aggregate(pipeline) { // supports the $group-by-field shapes the dashboard uses
      const g = pipeline.find((st) => st.$group).$group;
      const key = (d) => { const e = g._id; if (typeof e === 'string') return d[e.slice(1)]; return d[e.$ifNull[0].slice(1)] ?? e.$ifNull[1]; };
      const counts = new Map();
      store.forEach((d) => counts.set(key(d), (counts.get(key(d)) || 0) + 1));
      return [...counts].map(([_id, count]) => ({ _id, count }));
    }
    static async distinct(f) { return [...new Set(store.map((d) => d[f]))]; }
    static _store = store;
    static _reset() { store.length = 0; }
  }
  // hydrate: documents handed out by find()/findOne() are persisted docs (isNew false)
  const origFind = Model.findOne; const origFindMany = Model.find;
  Model.findOne = (f) => { const q = origFindMany.call(Model, f); const base = q.then.bind(q); q.then = (res, rej) => base((r) => r, rej).then((docs) => { const first = docs[0] || null; return q._lean ? (first ? clone({ ...first }) : null) : first; }).then(res, rej); return q; };
  Object.assign(Model, real);
  return Model;
}

// ---------- AppSetting fake (preferences, usage counters, deleted seed keys) ----------
function makeAppSetting() {
  const rows = new Map();
  const chain = (v) => ({ lean: async () => v, then: (r, j) => Promise.resolve(v).then(r, j) });
  return {
    findOne: ({ key }) => chain(rows.get(key) ? { key, value: rows.get(key) } : null),
    findOneAndUpdate: (filter, update) => {
      const cur = rows.get(filter.key) || {};
      Object.entries(update.$inc || {}).forEach(([p, n]) => { const k = p.replace(/^value\./, ''); cur[k] = (cur[k] || 0) + n; });
      Object.entries(update.$set || {}).forEach(([p, n]) => { const k = p.replace(/^value\./, ''); cur[k] = n; });
      Object.entries(update.$addToSet || {}).forEach(([p, n]) => { const k = p.replace(/^value\./, ''); cur[k] = [...new Set([...(cur[k] || []), n])]; });
      rows.set(filter.key, cur);
      return Promise.resolve(cur);
    },
    _rows: rows,
  };
}

// ---------- express recorders ----------
function makeExpress() {
  const routes = [];
  const Router = () => {
    const r = {};
    ['get', 'post', 'put', 'patch', 'delete'].forEach((m) => { r[m] = (p, ...h) => { routes.push({ method: m.toUpperCase(), path: p, handlers: h }); return r; }; });
    r.use = (...h) => { routes.push({ method: 'USE', path: '*', handlers: h }); return r; };
    return r;
  };
  const express = () => proxyStub();
  express.Router = Router;
  express.json = () => () => {};
  express.static = () => () => {};
  return { express, routes };
}

function install() {
  const { express, routes } = makeExpress();
  const orig = Module._load;
  const appSetting = makeAppSetting();
  Module._load = function load(request, parent, isMain) {
    if (request === 'mongoose') return mongoose;
    if (request === 'express') return express;
    if (request === 'dotenv') return { config() {} };
    if (request === 'express-rate-limit') return () => (req, res, next) => next && next();
    try { return orig.call(this, request, parent, isMain); } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND' && !request.startsWith('.') && !path.isAbsolute(request)) return proxyStub(); // uninstalled third-party package
      throw e;
    }
  };
  const abs = (rel) => require.resolve(path.join(backend, rel));
  const Lead = makeModel(require(abs('models/Lead.js')));
  const LeadActivity = makeModel(require(abs('models/LeadActivity.js')));
  require.cache[abs('models/Lead.js')].exports = Lead;
  require.cache[abs('models/LeadActivity.js')].exports = LeadActivity;
  ['SearchHistory', 'BusinessCategory', 'MessageTemplate'].forEach((n) => { const f = abs(`models/${n}.js`); require.cache[f] ? null : require(f); require.cache[f].exports = makeModel(require.cache[f].exports); }); // eslint-disable-line no-unused-expressions
  require.cache[abs('models/AppSetting.js')] = { id: abs('models/AppSetting.js'), filename: abs('models/AppSetting.js'), loaded: true, exports: appSetting };
  return { Lead, LeadActivity, appSetting, routes, uninstall: () => { Module._load = orig; } };
}

// Run an express-style async handler with a fake req/res; resolves { status, body, error }.
async function call(handler, { params = {}, body = {}, query = {}, user = { _id: 'u1' } } = {}) {
  const res = { statusCode: 200, body: undefined, writableEnded: false, on() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  let error;
  await new Promise((resolve) => {
    handler({ params, body, query, user }, res, (e) => { error = e; resolve(); });
    const t = setInterval(() => { if (res.body !== undefined) { clearInterval(t); resolve(); } }, 1);
    setTimeout(() => { clearInterval(t); resolve(); }, 2000);
  });
  return { status: error ? error.status || 500 : res.statusCode, body: res.body, error };
}

module.exports = { install, call, matches, mongoose };
