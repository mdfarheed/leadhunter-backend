// Pure planning logic for seeding the starter templates (no database): given what exists, decide what to insert / patch.
// Re-running with the result already applied yields an EMPTY plan, which is what makes the seed idempotent.
const crypto = require('crypto');

const sha256 = (text) => crypto.createHash('sha256').update(String(text ?? '').trim()).digest('hex');
const slug = (c) => c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const ts = (d) => (d ? new Date(d).getTime() : 0);

/**
 * existing: array of plain template objects (with _id). templates: starter data. legacy: [{name, category, sha256}] of earlier seeds.
 * Rules:
 *  - a starter template is matched by `seedKey`; if present it is left untouched, except that an UNEDITED older version (known hash)
 *    is upgraded to the new text. Edited starters are never overwritten unless `overwrite` is set
 *  - a template with the same name+category but no seedKey (from an older seed) is adopted: gets a seedKey, content kept
 *  - otherwise the starter template is inserted (unless the admin deleted it earlier, unless restore is set)
 *  - an older seeded template that is still byte-for-byte the original is deactivated (superseded); an edited one is kept as-is
 *  - user-created templates are never modified except to repair "more than one default in a category"
 *  - afterwards every category has exactly one active default
 */
function planSeed(existing, templates, { legacy = [], deletedKeys = [], restore = false, keepLegacy = false, history = {}, overwrite = false } = {}) {
  const docs = existing.map((d) => ({ ...d }));
  const inserts = [];
  const updates = new Map();
  const report = { upgraded: 0, created: 0, adopted: 0, unchanged: 0, skippedDeleted: 0, legacyDeactivated: 0, legacyKept: 0, defaultsFixed: 0 };
  const deleted = new Set(deletedKeys);

  const patch = (doc, p) => {
    Object.assign(doc, p);
    if (doc._id != null) updates.set(String(doc._id), { ...(updates.get(String(doc._id)) || {}), ...p });
  };

  for (const t of templates) {
    if (!restore && deleted.has(t.seedKey)) { report.skippedDeleted += 1; continue; }
    const present = docs.find((d) => d.seedKey === t.seedKey);
    if (present) {
      // Upgrade only starters that are still exactly an earlier shipped version (i.e. never edited), unless overwrite is requested.
      const untouched = (history[t.seedKey] || []).includes(sha256(present.body));
      if (present.body !== t.body && (overwrite || untouched)) { patch(present, { body: t.body }); report.upgraded += 1; } else report.unchanged += 1;
      continue;
    }
    const sameName = docs.find((d) => !d.seedKey && d.name === t.name && d.category === t.category);
    if (sameName) { patch(sameName, { seedKey: t.seedKey }); report.adopted += 1; continue; }
    const doc = { seedKey: t.seedKey, name: t.name, category: t.category, body: t.body, isActive: true, isDefault: false };
    docs.push(doc); inserts.push(doc); report.created += 1;
  }

  if (!keepLegacy) {
    for (const l of legacy) {
      for (const d of docs) {
        if (d.seedKey || d._id == null || d.name !== l.name || d.category !== l.category) continue;
        if (sha256(d.body) !== l.sha256) { report.legacyKept += 1; continue; } // customised by the admin: theirs now
        if (d.isActive || d.isDefault) { patch(d, { isActive: false, isDefault: false }); report.legacyDeactivated += 1; }
      }
    }
  }

  const categories = [...new Set([...templates.map((t) => t.category), ...docs.map((d) => d.category)])];
  for (const category of categories) {
    const inCat = docs.filter((d) => d.category === category);
    inCat.filter((d) => d.isDefault && !d.isActive).forEach((d) => patch(d, { isDefault: false }));
    const active = inCat.filter((d) => d.isDefault && d.isActive).sort((a, b) => ts(b.updatedAt) - ts(a.updatedAt));
    if (active.length > 1) { active.slice(1).forEach((d) => patch(d, { isDefault: false })); report.defaultsFixed += 1; }
    if (active.length === 0) {
      const pick = inCat.find((d) => d.seedKey === `${slug(category)}-1` && d.isActive) || inCat.filter((d) => d.isActive).sort((a, b) => ts(a.createdAt) - ts(b.createdAt))[0];
      if (pick) { patch(pick, { isDefault: true }); report.defaultsFixed += 1; }
    }
  }
  return { inserts, updates: [...updates].map(([id, p]) => ({ id, patch: p })), report };
}

const isEmptyPlan = (plan) => plan.inserts.length === 0 && plan.updates.length === 0;

module.exports = { planSeed, isEmptyPlan, sha256, slug };
