const MessageTemplate = require('../models/MessageTemplate');
const AppSetting = require('../models/AppSetting');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

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
