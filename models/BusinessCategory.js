const mongoose = require('mongoose');
const { TEMPLATE_CATEGORIES } = require('./MessageTemplate');

const schema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
  searchTerm: { type: String, trim: true, maxlength: 150, default: '' },       // used for Text Search
  googleTypes: { type: [String], default: [] },                                 // Table A types for Nearby Search (may be empty)
  templateCategory: { type: String, enum: TEMPLATE_CATEGORIES, default: 'General Business' },
  isActive: { type: Boolean, default: true },
  isCustom: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('BusinessCategory', schema);
