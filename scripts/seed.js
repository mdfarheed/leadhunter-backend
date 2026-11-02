const { validateEnv } = require('../config/env');
const BusinessCategory = require('../models/BusinessCategory');
const { CATEGORIES } = require('../utils/seedData');
const { seedTemplates } = require('./seedProfessionalTemplates');

// Idempotent: only adds what is missing, never overwrites your edits.
async function seedAll() {
  let cats = 0;
  for (const c of CATEGORIES) {
    const r = await BusinessCategory.updateOne({ name: c.name }, { $setOnInsert: c }, { upsert: true });
    if (r.upsertedCount) cats += 1;
  }
  const t = await seedTemplates();
  return { categories: cats, templates: t.created };
}
module.exports = { seedAll };

if (require.main === module) {
  validateEnv();
  const { connectDB, disconnectDB } = require('../config/db');
  connectDB().then(seedAll).then((r) => { console.log(`Seeded ${r.categories} categories and ${r.templates} templates.`); return disconnectDB(); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
