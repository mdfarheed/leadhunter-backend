const mongoose = require('mongoose');

const TEMPLATE_CATEGORIES = ['General Business', 'School', 'College', 'Hospital', 'Clinic', 'Dental Clinic', 'Salon', 'Beauty Parlour',
  'Restaurant', 'Hotel', 'Real Estate', 'E-commerce', 'Follow-up', 'Custom'];

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, enum: TEMPLATE_CATEGORIES, default: 'General Business', index: true },
  body: { type: String, required: true, trim: true, maxlength: 4000 },
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false }, // default template for its category
  seedKey: { type: String, trim: true, maxlength: 80 }, // set on the built-in starter templates; makes the seed idempotent
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

schema.index({ category: 1, isDefault: 1 });
// At most one default template per category, enforced by the database (the seed script repairs old duplicates first).
schema.index({ category: 1 }, { unique: true, partialFilterExpression: { isDefault: true }, name: 'uniq_default_per_category' });
schema.index({ seedKey: 1 }, { unique: true, partialFilterExpression: { seedKey: { $type: 'string' } }, name: 'uniq_seed_key' });

module.exports = mongoose.model('MessageTemplate', schema);
module.exports.TEMPLATE_CATEGORIES = TEMPLATE_CATEGORIES;
