/*
 * Idempotent seed / migration for the professional message templates (5 per category x 14 categories).
 *
 *   npm run seed:templates                     (from backend/)    - or -    npm run seed:templates  (from the project root)
 *   node scripts/seedProfessionalTemplates.js --dry-run         show what would change, write nothing
 *   node scripts/seedProfessionalTemplates.js --keep-legacy     do not deactivate superseded, unedited old starter templates
 *   node scripts/seedProfessionalTemplates.js --restore-deleted re-create starter templates you deleted earlier
 *   node scripts/seedProfessionalTemplates.js --overwrite-starters replace the text of ALL starter templates (even ones you edited)
 *
 * Safe to run any number of times: starter templates are matched by seedKey and never overwritten, user-created and edited
 * templates are preserved, exactly one active default is kept per category.
 */
const { TEMPLATES } = require('../utils/seedData');
const legacy = require('../utils/legacyTemplateHashes.json');
const history = require('../utils/starterTemplateHistory.json');
const { planSeed, isEmptyPlan } = require('../utils/templateSeedPlan');
const { ensureIndexes } = require('../utils/ensureIndexes');

function mongoRepo() {
  const MessageTemplate = require('../models/MessageTemplate'); // eslint-disable-line global-require
  const AppSetting = require('../models/AppSetting'); // eslint-disable-line global-require
  return {
    all: () => MessageTemplate.find({}).lean(),
    insert: (doc) => MessageTemplate.create(doc),
    update: (id, p) => MessageTemplate.updateOne({ _id: id }, { $set: p }),
    deletedKeys: async () => (await AppSetting.findOne({ key: 'deletedSeedTemplates' }).lean())?.value?.keys || [],
    ensureIndexes: () => ensureIndexes(MessageTemplate),
  };
}

async function seedTemplates({ repo = mongoRepo(), dryRun = false, keepLegacy = false, restore = false, overwrite = false, templates = TEMPLATES } = {}) {
  const plan = planSeed(await repo.all(), templates, { legacy, history, deletedKeys: await repo.deletedKeys(), restore, keepLegacy, overwrite });
  if (dryRun) return { ...plan.report, dryRun: true, changes: plan.inserts.length + plan.updates.length };
  // Order matters because of the "one default per category" unique index: un-default first, then insert, then set new defaults.
  const demote = plan.updates.filter((u) => u.patch.isDefault !== true);
  const promote = plan.updates.filter((u) => u.patch.isDefault === true);
  for (const u of demote) await repo.update(u.id, u.patch); // eslint-disable-line no-await-in-loop
  for (const doc of plan.inserts) await repo.insert(doc); // eslint-disable-line no-await-in-loop
  for (const u of promote) await repo.update(u.id, u.patch); // eslint-disable-line no-await-in-loop
  const idx = await repo.ensureIndexes?.();
  return { ...plan.report, droppedIndexes: idx?.dropped || [], changes: plan.inserts.length + plan.updates.length, noop: isEmptyPlan(plan) };
}

module.exports = { seedTemplates };

if (require.main === module) {
  const { validateEnv } = require('../config/env'); // eslint-disable-line global-require
  validateEnv();
  const { connectDB, disconnectDB } = require('../config/db'); // eslint-disable-line global-require
  const flag = (f) => process.argv.includes(f);
  connectDB()
    .then(() => seedTemplates({ dryRun: flag('--dry-run'), keepLegacy: flag('--keep-legacy'), restore: flag('--restore-deleted'), overwrite: flag('--overwrite-starters') }))
    .then((r) => {
      console.log(`\nTemplate seed ${r.dryRun ? '(dry run) ' : ''}finished: ${TEMPLATES.length} starter templates defined (5 x 14 categories).`);
      console.log(`  created: ${r.created} | upgraded to new text: ${r.upgraded} | adopted from older seed: ${r.adopted} | already present (untouched): ${r.unchanged}`);
      console.log(`  deleted-by-you, skipped: ${r.skippedDeleted} | old unedited starters deactivated: ${r.legacyDeactivated} | edited old starters kept: ${r.legacyKept}`);
      if (r.droppedIndexes?.length) console.log(`  replaced old index: ${r.droppedIndexes.join(', ')}`);
  console.log(`  default-template repairs: ${r.defaultsFixed}${r.noop ? ' | nothing to change' : ''}\n`);
    })
    .catch((e) => { console.error('Template seed failed:', e.message); process.exitCode = 1; })
    .finally(() => disconnectDB().catch(() => {}));
}
