const mongoose = require('mongoose');

const STATUSES = ['New', 'Contacted', 'Interested', 'Follow-up', 'Converted', 'Not Interested', 'Do Not Contact'];

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

leadSchema.index({ placeId: 1 }, { unique: true, partialFilterExpression: { placeId: { $type: 'string' } } });
leadSchema.index({ category: 1 });
leadSchema.index({ city: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ nameKey: 1, cityKey: 1 });

module.exports = mongoose.model('Lead', leadSchema);
module.exports.STATUSES = STATUSES;
