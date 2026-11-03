/*
 * One-off, idempotent migration to multi-user mode.   npm run migrate:users      (add --dry-run to only report)
 *   - existing accounts get role "admin", active=true and city "Etah" (if they have none)
 *   - leads / activities / search history created before multi-user support are stamped with the admin as owner
 *   - drops the old GLOBAL unique index on Lead.placeId (the per-user index replaces it)
 * Nothing is deleted. Safe to run repeatedly. (The app also works without it: ownerless records are treated as the admin's.)
 */
const { validateEnv } = require('../config/env');

async function migrate({ dryRun = false } = {}) {
  const User = require('../models/User'); // eslint-disable-line global-require
  const Lead = require('../models/Lead'); // eslint-disable-line global-require
  const LeadActivity = require('../models/LeadActivity'); // eslint-disable-line global-require
  const SearchHistory = require('../models/SearchHistory'); // eslint-disable-line global-require
  const { dropLegacyLeadIndexes } = require('../utils/legacyIndexes'); // eslint-disable-line global-require
  const out = { rolesSet: 0, citySet: 0, ownerStamped: 0, droppedIndexes: [] };
  const run = async (Model, filter, set) => (dryRun ? Model.countDocuments(filter) : (await Model.updateMany(filter, { $set: set })).modifiedCount);
  out.rolesSet = await run(User, { role: { $exists: false } }, { role: 'admin' });
  await run(User, { active: { $exists: false } }, { active: true });
  out.citySet = await run(User, { city: { $exists: false } }, { city: 'Etah' });
  const admin = await User.findOne({ role: { $ne: 'user' } }).sort({ createdAt: 1 }).lean();
  if (admin) {
    for (const M of [Lead, LeadActivity, SearchHistory]) out.ownerStamped += await run(M, { createdBy: { $exists: false } }, { createdBy: admin._id }); // eslint-disable-line no-await-in-loop
  }
  if (!dryRun) { out.droppedIndexes = await dropLegacyLeadIndexes(Lead); await Lead.createIndexes(); }
  return out;
}
module.exports = { migrate };

if (require.main === module) {
  validateEnv();
  const { connectDB, disconnectDB } = require('../config/db'); // eslint-disable-line global-require
  const dryRun = process.argv.includes('--dry-run');
  connectDB().then(() => migrate({ dryRun })).then((r) => {
    console.log(`\nMulti-user migration ${dryRun ? '(dry run) ' : ''}done: roles set: ${r.rolesSet} | city set: ${r.citySet} | records stamped with admin owner: ${r.ownerStamped}`);
    if (r.droppedIndexes.length) console.log(`  dropped old index: ${r.droppedIndexes.join(', ')}`);
    console.log('');
  }).catch((e) => { console.error('Migration failed:', e.message); process.exitCode = 1; }).finally(() => disconnectDB().catch(() => {}));
}
