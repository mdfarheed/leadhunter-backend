const { body, param, query, validationResult } = require('express-validator');
const { PLACEHOLDERS, findUnsupported } = require('../utils/templateUtils');
const { STATUSES } = require('../models/Lead');
const { TEMPLATE_CATEGORIES } = require('../models/MessageTemplate');
const { checkPhone } = require('../utils/phone');
const { MAX_IMPORT } = require('../services/leadService');

const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  return res.status(400).json({
    message: result.array()[0].msg,
    details: result.array().map((e) => ({ field: e.path, message: e.msg })),
  });
};

const mongoId = (name = 'id') => param(name).isMongoId().withMessage(`Invalid ${name}`);
const optStr = (name, max = 200) => body(name).optional({ nullable: true }).isString().withMessage(`${name} must be text`).isLength({ max }).withMessage(`${name} is too long`);

exports.validate = validate;

exports.login = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isString().notEmpty().withMessage('Password required'),
  validate,
];
exports.changePassword = [
  body('currentPassword').isString().notEmpty().withMessage('Current password required'),
  body('newPassword').isString().isLength({ min: 8, max: 100 }).withMessage('New password must be 8-100 characters')
    .matches(/[A-Za-z]/).withMessage('Password needs a letter').matches(/\d/).withMessage('Password needs a number'),
  validate,
];

const leadFields = [
  optStr('businessName'), optStr('category', 100), optStr('ownerName', 100), optStr('phone', 40), optStr('whatsappNumber', 40),
  optStr('website', 300), optStr('city', 100), optStr('state', 100), optStr('country', 100), optStr('address', 500), optStr('notes', 5000),
  optStr('placeId', 300),
  body('status').optional().isIn(STATUSES).withMessage('Invalid status'),
  body('whatsappStatus').optional().isIn(['unknown', 'available', 'unavailable']).withMessage('Invalid WhatsApp status'),
  body('dataSource').optional().isIn(['manual', 'google_places_reference', 'imported', 'licensed']).withMessage('Invalid data source'),
  body('nextFollowUpAt').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Invalid follow-up date'),
  body('lastContactedAt').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Invalid last contacted date'),
];
// A phone number is mandatory to create a lead: missing / null / blank / whitespace-only / malformed values are rejected here
// (and again in the service + model, so no route can skip it). The check is done in the controller too for the exact error code.
const phoneRequired = body('phone').custom((value) => {
  const r = checkPhone(value);
  if (!r.ok) throw new Error(r.message);
  return true;
});
exports.leadCreate = [body('businessName').isString().trim().notEmpty().withMessage('Business name is required'), phoneRequired, ...leadFields, validate];
exports.leadImport = [
  body('leads').isArray({ min: 1, max: MAX_IMPORT }).withMessage(`Send 1-${MAX_IMPORT} leads`),
  body('leads.*').isObject().withMessage('Each lead must be an object'),
  body('defaults').optional().isObject(),
  body('force').optional().isBoolean(),
  validate,
];
exports.leadUpdate = [mongoId(), ...leadFields, validate];
exports.idParam = [mongoId(), validate];
exports.leadStatus = [mongoId(), body('status').isIn(STATUSES).withMessage('Invalid status'), validate];
exports.leadBulk = [
  body('ids').isArray({ min: 1, max: 500 }).withMessage('Select 1-500 leads'),
  body('ids.*').isMongoId().withMessage('Invalid lead id'),
  body('action').isIn(['status', 'delete', 'followUp']).withMessage('Invalid bulk action'),
  body('status').if(body('action').equals('status')).isIn(STATUSES).withMessage('Invalid status'),
  body('nextFollowUpAt').if(body('action').equals('followUp')).isISO8601().withMessage('Invalid date'),
  validate,
];

const templateFields = [
  body('name').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Template name is required'),
  body('category').isIn(TEMPLATE_CATEGORIES).withMessage('Invalid template category'),
  body('body').isString().trim().isLength({ min: 5, max: 4000 }).withMessage('Message must be 5-4000 characters')
    .custom((v) => {
      const bad = findUnsupported(v);
      if (bad.length) throw new Error(`Unsupported placeholder(s): ${bad.map((b) => `{{${b}}}`).join(', ')}. Supported: ${PLACEHOLDERS.map((p) => `{{${p}}}`).join(', ')}`);
      return true;
    }),
  body('isActive').optional().isBoolean().withMessage('isActive must be true/false'),
];
exports.templateCreate = [...templateFields, validate];
exports.templateUpdate = [mongoId(), ...templateFields, validate];

exports.activityCreate = [
  body('lead').isMongoId().withMessage('Invalid lead'),
  body('type').isIn(['note', 'contacted', 'follow_up_set', 'follow_up_completed']).withMessage('Invalid activity type'),
  body('message').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  body('nextFollowUpAt').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Invalid follow-up date'),
  validate,
];

exports.searchHistoryCreate = [
  body('searchType').isIn(['text', 'nearby']), optStr('keyword'), optStr('city', 100), optStr('category', 100),
  body('resultCount').optional().isInt({ min: 0 }), validate,
];

const searchBase = [
  optStr('country', 100), optStr('state', 100), optStr('city', 100), optStr('category', 100), optStr('keyword', 200),
  body('minRating').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0, max: 5 }).withMessage('Rating must be 0-5'),
  body('pageSize').optional().isInt({ min: 1, max: 20 }),
  body('hasPhone').optional().isIn(['any', 'yes', 'no']),
  body('hasWebsite').optional().isIn(['any', 'yes', 'no']),
  body('includeContact').optional().isBoolean(), body('includeRating').optional().isBoolean(),
  optStr('pageToken', 2000),
];
exports.textSearch = [
  body().custom((b) => { if (!(b.keyword || b.category)) throw new Error('Enter a keyword or choose a category'); return true; }),
  ...searchBase, validate,
];
exports.nearbySearch = [
  body('radius').isInt({ min: 100, max: 50000 }).withMessage('Radius must be 100-50000 metres'),
  body('latitude').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -90, max: 90 }),
  body('longitude').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -180, max: 180 }),
  ...searchBase, validate,
];
exports.placeDetails = [param('placeId').matches(/^[A-Za-z0-9_-]{10,300}$/).withMessage('Invalid place id'), validate];

exports.category = [
  body('name').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Category name is required'),
  optStr('searchTerm', 150),
  body('googleTypes').optional().isArray({ max: 10 }),
  body('templateCategory').optional().isIn(TEMPLATE_CATEGORIES),
  body('isActive').optional().isBoolean(), validate,
];
exports.categoryUpdate = [mongoId(), ...exports.category.slice(0, -1), validate];

exports.settingsUpdate = [
  optStr('profile.name', 100), body('profile.email').optional().isEmail().normalizeEmail(), optStr('profile.developerName', 100), optStr('profile.city', 100),
  body('preferences.defaultCountryCode').optional().matches(/^\d{1,4}$/).withMessage('Country code must be digits'),
  optStr('preferences.defaultCountry', 100), optStr('preferences.defaultState', 100), optStr('preferences.defaultCity', 100),
  body('preferences.defaultTemplateId').optional({ nullable: true, checkFalsy: true }).isMongoId(),
  validate,
];

exports.rotationNext = [query('category').isIn(TEMPLATE_CATEGORIES).withMessage('Invalid template category'), validate];
exports.rotationUsed = [body('templateId').isMongoId().withMessage('Invalid template id'), validate];

// ---- users (admin only) ----
const newPassword = (field) => body(field).isString().isLength({ min: 8, max: 100 }).withMessage('Password must be 8-100 characters')
  .matches(/[A-Za-z]/).withMessage('Password needs a letter').matches(/\d/).withMessage('Password needs a number');
exports.userCreate = [
  body('name').isString().trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  newPassword('password'),
  body('city').isString().trim().notEmpty().withMessage('City is required').isLength({ max: 100 }),
  optStr('developerName', 100),
  validate,
];
exports.userUpdate = [
  mongoId(),
  body('name').optional().isString().trim().notEmpty().isLength({ max: 100 }),
  body('city').optional().isString().trim().notEmpty().withMessage('City cannot be empty').isLength({ max: 100 }),
  optStr('developerName', 100),
  body('active').optional().isBoolean().withMessage('active must be true/false'),
  body('newPassword').optional().custom((v) => { if (typeof v !== 'string' || v.length < 8 || !/[A-Za-z]/.test(v) || !/\d/.test(v)) throw new Error('Password must be 8+ characters with letters and numbers'); return true; }),
  validate,
];

// ---- visit personally ----
const visitFields = [
  optStr('name', 150), optStr('city', 100), optStr('comment', 1000),
  body('visitDate').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Invalid visit date'),
];
exports.visitCreate = [
  body('phone').custom((value) => { const r = checkPhone(value); if (!r.ok) throw new Error(r.message); return true; }),
  ...visitFields, validate,
];
exports.visitUpdate = [mongoId(), optStr('phone', 40), ...visitFields, body('status').optional().isIn(['pending', 'visited']).withMessage('Invalid status'), validate];
exports.visitConvert = [mongoId(), optStr('businessName', 200), optStr('category', 100), validate];
