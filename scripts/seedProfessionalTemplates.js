const { validateEnv } = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const MessageTemplate = require('../models/MessageTemplate');
const { TEMPLATES } = require('../utils/seedData');

async function seedProfessionalTemplates() {
  let created = 0;
  let updated = 0;

  console.log('\nStarting professional WhatsApp template seed...\n');

  // Update existing templates or create missing templates.
  for (const template of TEMPLATES) {
    const existing = await MessageTemplate.findOne({
      name: template.name,
    });

    if (existing) {
      existing.category = template.category;
      existing.body = template.body;
      existing.isActive = true;
      existing.isDefault = false;

      await existing.save();
      updated++;

      console.log(`UPDATED: ${template.name}`);
    } else {
      await MessageTemplate.create({
        name: template.name,
        category: template.category,
        body: template.body,
        isActive: true,
        isDefault: false,
      });

      created++;

      console.log(`CREATED: ${template.name}`);
    }
  }

  // Set exactly one default template per category.
  const defaultTemplates = TEMPLATES.filter(
    (template) => template.isDefault
  );

  const categories = [
    ...new Set(defaultTemplates.map((template) => template.category)),
  ];

  for (const category of categories) {
    await MessageTemplate.updateMany(
      { category },
      { $set: { isDefault: false } }
    );

    const defaultTemplate = defaultTemplates.find(
      (template) => template.category === category
    );

    await MessageTemplate.updateOne(
      {
        name: defaultTemplate.name,
        category: defaultTemplate.category,
      },
      {
        $set: {
          isActive: true,
          isDefault: true,
        },
      }
    );

    console.log(`DEFAULT SET: ${category} -> ${defaultTemplate.name}`);
  }

  console.log('\n------------------------------------');
  console.log('Professional template seed completed');
  console.log('------------------------------------');
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Total processed: ${TEMPLATES.length}`);
  console.log('------------------------------------\n');
}

async function run() {
  try {
    validateEnv();

    await connectDB();

    await seedProfessionalTemplates();
  } catch (error) {
    console.error('\nTemplate seed failed:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

run();