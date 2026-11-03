const MessageTemplate = require('../models/MessageTemplate');
const AppSetting = require('../models/AppSetting');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { nextInRotation } = require('../utils/templateRotation');

const pick = (b) => ({ name: b.name, category: b.category, body: b.body, ...(b.isActive !== undefined ? { isActive: b.isActive } : {}) });

exports.list = asyncHandler(async (req, res) => {
  const f = {};
  if (req.query.category) f.category = req.query.category;
  if (req.query.active === 'true') f.isActive = true;
  const data = await MessageTemplate.find(f).sort({ category: 1, isDefault: -1, name: 1 }).lean();
  res.json({ data });
});

exports.create = asyncHandler(async (req, res) => {
  const hasDefault = await MessageTemplate.exists({ category: req.body.category, isDefault: true });
  const t = await MessageTemplate.create({ ...pick(req.body), isDefault: !hasDefault, createdBy: req.user._id });
  res.status(201).json({ data: t });
});

exports.update = asyncHandler(async (req, res) => {
  const t = await MessageTemplate.findById(req.params.id);
  if (!t) throw new ApiError(404, 'Template not found');
  t.set(pick(req.body));
  if (!t.isActive) t.isDefault = false; // an inactive template cannot be the default
  await t.save();
  res.json({ data: t });
});

exports.remove = asyncHandler(async (req, res) => {
  const t = await MessageTemplate.findByIdAndDelete(req.params.id);
  if (!t) throw new ApiError(404, 'Template not found');
  const prefs = await AppSetting.findOne({ key: 'preferences' });
  if (prefs?.value?.defaultTemplateId === String(t._id)) {
    prefs.value = { ...prefs.value, defaultTemplateId: null };
    prefs.markModified('value');
    await prefs.save();
  }
  if (t.seedKey) { // remember that a built-in starter template was removed on purpose; the seed will not recreate it
    await AppSetting.findOneAndUpdate({ key: 'deletedSeedTemplates' }, { $addToSet: { 'value.keys': t.seedKey } }, { upsert: true });
  }
  if (t.isDefault) { // promote another active template of the same category
    const next = await MessageTemplate.findOne({ category: t.category, isActive: true }).sort({ createdAt: 1 });
    if (next) { next.isDefault = true; await next.save(); }
  }
  res.json({ message: 'Template deleted' });
});

exports.setDefault = asyncHandler(async (req, res) => {
  const t = await MessageTemplate.findById(req.params.id);
  if (!t) throw new ApiError(404, 'Template not found');
  if (!t.isActive) throw new ApiError(400, 'Activate the template before making it the default');
  await MessageTemplate.updateMany({ category: t.category, _id: { $ne: t._id } }, { isDefault: false });
  t.isDefault = true;
  await t.save();
  res.json({ data: t });
});

// ---- Rotation: which template is next for this category? (read-only; nothing advances until a message is opened) ----
// Rotation is kept per user, so each user's leads cycle through the templates independently.
const rotationKey = (req) => `templateRotation:${req.user._id}`;
const rotationState = async (req) => (await AppSetting.findOne({ key: rotationKey(req) }).lean())?.value || {};

exports.next = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const list = await MessageTemplate.find({ category, isActive: true }).lean();
  const state = await rotationState(req);
  const next = nextInRotation(list, state[category]);
  res.json({ data: next ? next.template : null, position: next?.position || 0, total: next?.total || 0 });
});

// Called when the admin opens WhatsApp with a template: the following lead will then get the next template.
exports.markUsed = asyncHandler(async (req, res) => {
  const t = await MessageTemplate.findById(req.body.templateId).lean();
  if (!t) throw new ApiError(404, 'Template not found');
  await AppSetting.findOneAndUpdate({ key: rotationKey(req) }, { $set: { [`value.${t.category}`]: String(t._id) } }, { upsert: true });
  res.json({ ok: true });
});
