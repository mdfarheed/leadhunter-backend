const { validateEnv } = require('../config/env');
const BusinessCategory = require('../models/BusinessCategory');
const MessageTemplate = require('../models/MessageTemplate');
const { CATEGORIES, TEMPLATES } = require('../utils/seedData');

// Idempotent: only adds what is missing, never overwrites your edits.
async function seedAll() {
  let cats = 0; let tpls = 0;
  for (const c of CATEGORIES) {
    const r = await BusinessCategory.updateOne({ name: c.name }, { $setOnInsert: c }, { upsert: true });
    if (r.upsertedCount) cats += 1;
  }
  for (const t of TEMPLATES) {
    if (await MessageTemplate.exists({ name: t.name })) continue;
    const hasDefault = await MessageTemplate.exists({ category: t.category, isDefault: true });
    await MessageTemplate.create({ ...t, isDefault: !hasDefault });
    tpls += 1;
  }
  return { categories: cats, templates: tpls };
}
module.exports = { seedAll };

if (require.main === module) {
  validateEnv();
  const { connectDB, disconnectDB } = require('../config/db');
  connectDB().then(seedAll).then((r) => { console.log(`Seeded ${r.categories} categories and ${r.templates} templates.`); return disconnectDB(); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
