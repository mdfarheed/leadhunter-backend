const SearchHistory = require('../models/SearchHistory');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination, pageMeta } = require('../utils/pagination');

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 20);
  const [data, total] = await Promise.all([
    SearchHistory.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), SearchHistory.countDocuments(),
  ]);
  res.json({ data, pagination: pageMeta(page, limit, total) });
});
exports.create = asyncHandler(async (req, res) => {
  const { keyword, city, state, category, searchType, resultCount, params, requestCount } = req.body;
  res.status(201).json({ data: await SearchHistory.create({ keyword, city, state, category, searchType, resultCount, requestCount, params, createdBy: req.user._id }) });
});
exports.remove = asyncHandler(async (req, res) => {
  const h = await SearchHistory.findByIdAndDelete(req.params.id);
  if (!h) throw new ApiError(404, 'History entry not found');
  res.json({ message: 'Deleted' });
});
exports.clear = asyncHandler(async (req, res) => {
  const r = await SearchHistory.deleteMany({});
  res.json({ message: `${r.deletedCount} entries deleted` });
});
