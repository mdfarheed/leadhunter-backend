const BusinessCategory = require('../models/BusinessCategory');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const pick = (b) => ({
  name: b.name, searchTerm: b.searchTerm ?? '', templateCategory: b.templateCategory || 'General Business',
  googleTypes: (b.googleTypes || []).map((t) => String(t).trim()).filter(Boolean),
  ...(b.isActive !== undefined ? { isActive: b.isActive } : {}),
});

exports.list = asyncHandler(async (req, res) => {
  const f = req.query.active === 'true' ? { isActive: true } : {};
  res.json({ data: await BusinessCategory.find(f).sort({ isCustom: 1, name: 1 }).lean() });
});
exports.create = asyncHandler(async (req, res) => res.status(201).json({ data: await BusinessCategory.create({ ...pick(req.body), isCustom: true }) }));
exports.update = asyncHandler(async (req, res) => {
  const c = await BusinessCategory.findByIdAndUpdate(req.params.id, pick(req.body), { new: true, runValidators: true });
  if (!c) throw new ApiError(404, 'Category not found');
  res.json({ data: c });
});
exports.remove = asyncHandler(async (req, res) => {
  const c = await BusinessCategory.findByIdAndDelete(req.params.id);
  if (!c) throw new ApiError(404, 'Category not found');
  res.json({ message: 'Category deleted' });
});
