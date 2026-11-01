const mongoose = require('mongoose');

const TYPES = ['created', 'updated', 'status_change', 'note', 'contacted', 'follow_up_set', 'follow_up_completed', 'bulk_update'];

const schema = new mongoose.Schema({
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  type: { type: String, enum: TYPES, required: true },
  message: { type: String, maxlength: 2000, default: '' },
  meta: { type: mongoose.Schema.Types.Mixed },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
schema.index({ lead: 1, createdAt: -1 });
schema.index({ createdAt: -1 });

module.exports = mongoose.model('LeadActivity', schema);
