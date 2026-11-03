// Creates a model's indexes; if an OLD index with the same keys but a different name/options is in the way
// (Mongo error 85/86, e.g. "Index already exists with a different name: seedKey_1"), drops that old index and retries.
// An index is dropped only if it has the same keys as an index declared in the schema AND its name is not the name of ANY
// index the schema declares (so indexes the schema wants are never touched). Data is never modified.
const sameKeys = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const defaultName = (spec) => Object.entries(spec).map(([k, v]) => `${k}_${v}`).join('_');

async function ensureIndexes(Model) {
  try {
    await Model.createIndexes();
    return { dropped: [] };
  } catch (e) {
    const conflict = [85, 86].includes(e.code) || /IndexOptionsConflict|IndexKeySpecsConflict/.test(e.codeName || '');
    if (!conflict) throw e;
    const wanted = Model.schema.indexes();                                   // [[keys, options], ...]
    const wantedNames = new Set(wanted.map(([spec, opts]) => opts?.name || defaultName(spec)));
    const existing = await Model.collection.indexes();
    const dropped = [];
    for (const idx of existing) {
      if (idx.name === '_id_' || wantedNames.has(idx.name) || dropped.includes(idx.name)) continue;
      if (wanted.some(([spec]) => sameKeys(idx.key, spec))) {
        try { await Model.collection.dropIndex(idx.name); dropped.push(idx.name); } // eslint-disable-line no-await-in-loop
        catch (err) { if (err.code !== 27) throw err; } // 27 = already gone
      }
    }
    await Model.createIndexes();
    return { dropped };
  }
}

module.exports = { ensureIndexes };
