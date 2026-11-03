const mongoose = require('mongoose');
const { checkPhone } = require('../utils/phone');

const VISIT_STATUSES = ['pending', 'visited', 'converted'];

// People who said "let's meet in person": kept apart from normal leads until you actually meet and decide what to do.
const schema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 150, default: '' },
  phone: { type: String, trim: true, required: true, maxlength: 40 },
  phoneNormalized: { type: String, index: true },
  city: { type: String, trim: true, maxlength: 100, default: '' },
  comment: { type: String, trim: true, maxlength: 1000, default: '' },
  visitDate: Date,                                   // when you plan to meet (optional)
  status: { type: String, enum: VISIT_STATUSES, default: 'pending' },
  convertedLeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Same rule as leads: a number must be present and valid.
schema.pre('validate', function enforcePhone(next) {
  if (this.isNew || this.isModified('phone')) {
    const check = checkPhone(this.phone, this.$locals?.defaultCountryCode || '91');
    if (!check.ok) this.invalidate('phone', check.message, this.phone);
    else this.phoneNormalized = check.digits;
  }
  next();
});

schema.index({ createdBy: 1, status: 1, createdAt: -1 });
schema.index({ createdBy: 1, phoneNormalized: 1 });

module.exports = mongoose.model('VisitContact', schema);
module.exports.VISIT_STATUSES = VISIT_STATUSES;
