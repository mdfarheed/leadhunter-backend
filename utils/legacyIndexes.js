// Before multi-user support Lead had a GLOBAL unique index on placeId, which would stop a second user from saving a business
// the first user already saved. This drops that old index (only that one); the per-user index replaces it. Idempotent.
async function dropLegacyLeadIndexes(Lead) {
  let existing;
  try { existing = await Lead.collection.indexes(); } catch (e) { return []; } // collection does not exist yet
  const dropped = [];
  for (const idx of existing) {
    const onlyPlaceId = Object.keys(idx.key || {}).length === 1 && idx.key.placeId === 1;
    if (onlyPlaceId && idx.unique) {
      await Lead.collection.dropIndex(idx.name);
      dropped.push(idx.name);
    }
  }
  return dropped;
}
module.exports = { dropLegacyLeadIndexes };
