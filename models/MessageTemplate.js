const mongoose = require('mongoose');

const TEMPLATE_CATEGORIES = ['General Business', 'School', 'College', 'Hospital', 'Clinic', 'Dental Clinic', 'Salon', 'Beauty Parlour',
  'Restaurant', 'Hotel', 'Real Estate', 'E-commerce', 'Follow-up', 'Custom'];

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, enum: TEMPLATE_CATEGORIES, default: 'General Business', index: true },
  body: { type: String, required: true, trim: true, maxlength: 4000 },
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false }, // default template for its category
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

schema.index({ category: 1, isDefault: 1 });

module.exports = mongoose.model('MessageTemplate', schema);
module.exports.TEMPLATE_CATEGORIES = TEMPLATE_CATEGORIES;
