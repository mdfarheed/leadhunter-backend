const mongoose = require('mongoose');
const { checkPhone } = require('../utils/phone');

const { STATUSES } = require('../utils/leadConstants');

/*
 * Field provenance:
 *  - USER-ENTERED / independently sourced: businessName, phone, whatsappNumber, website, address, notes, ... (dataSource + contactSource say which)
 *  - GOOGLE REFERENCE: only `placeId` is a persistent Google reference. No other Google Places content is copied automatically;
 *    fresh details are fetched on demand via /api/places/details/:placeId.
 */
const leadSchema = new mongoose.Schema({
  businessName: { type: String, required: true, trim: true, maxlength: 200 },
  category: { type: String, trim: true, maxlength: 100, default: '' },
  ownerName: { type: String, trim: true, maxlength: 100, default: '' },
  phone: { type: String, trim: true, maxlength: 40, default: '' },
  phoneNormalized: { type: String, index: true, sparse: true },
  whatsappNumber: { type: String, trim: true, maxlength: 40, default: '' },
  // Manual note by the admin ("does this number have WhatsApp?"). Not a contact state.
  whatsappStatus: { type: String, enum: ['unknown', 'available', 'unavailable'], default: 'unknown' },

  website: { type: String, trim: true, maxlength: 300, default: '' },
  city: { type: String, trim: true, maxlength: 100, default: '' },
  state: { type: String, trim: true, maxlength: 100, default: '' },
  country: { type: String, trim: true, maxlength: 100, default: 'India' },
  address: { type: String, trim: true, maxlength: 500, default: '' },
  dataSource: { type: String, enum: ['manual', 'google_places_reference', 'imported', 'licensed'], default: 'manual' },
  contactSource: { type: String, enum: ['user_entered', 'independent', 'licensed'], default: 'user_entered' },
  placeId: { type: String, trim: true, maxlength: 300 },
  placeIdSavedAt: Date,
  status: { type: String, enum: STATUSES, default: 'New', index: true },
  notes: { type: String, maxlength: 5000, default: '' },
  lastContactedAt: Date,
  nextFollowUpAt: { type: Date, index: true },
  contactCount: { type: Number, default: 0 },
  nameKey: { type: String, index: true },
  cityKey: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Phone is mandatory for every NEW lead and whenever the phone value is changed. Legacy records that never had one stay
// readable/editable (so existing data is not broken) but can never be created again. This hook is the last line of defence:
// it runs for any code path that saves a Lead, not just the HTTP controllers.
leadSchema.pre('validate', function enforcePhone(next) {
  if (this.isNew || this.isModified('phone')) {
    const check = checkPhone(this.phone, this.$locals?.defaultCountryCode || '91');
    if (!check.ok) this.invalidate('phone', check.message, this.phone);
    else this.phoneNormalized = check.digits;
  }
  next();
});

// A Google place can be saved once PER USER (two users may both save the same business).
leadSchema.index({ createdBy: 1, placeId: 1 }, { unique: true, partialFilterExpression: { placeId: { $type: 'string' } }, name: 'uniq_owner_place' });
leadSchema.index({ createdBy: 1, createdAt: -1 });
leadSchema.index({ category: 1 });
leadSchema.index({ city: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ nameKey: 1, cityKey: 1 });

module.exports = mongoose.model('Lead', leadSchema);
module.exports.STATUSES = STATUSES;
