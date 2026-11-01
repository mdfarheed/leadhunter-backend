const mongoose = require('mongoose');

// Metadata only. Google Places result content is never stored here.
const schema = new mongoose.Schema({
  keyword: { type: String, trim: true, default: '' },
  city: { type: String, trim: true, default: '' },
  state: { type: String, trim: true, default: '' },
  category: { type: String, trim: true, default: '' },
  searchType: { type: String, enum: ['text', 'nearby'], required: true },
  resultCount: { type: Number, default: 0 },
  requestCount: { type: Number, default: 1 },
  params: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
schema.index({ createdAt: -1 });

module.exports = mongoose.model('SearchHistory', schema);
