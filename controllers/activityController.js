const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination, pageMeta } = require('../utils/pagination');

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 25);
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.lead && /^[a-f\d]{24}$/i.test(req.query.lead)) filter.lead = req.query.lead;
  const [data, total] = await Promise.all([
    LeadActivity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('lead', 'businessName status').lean(),
    LeadActivity.countDocuments(filter),
  ]);
  res.json({ data, pagination: pageMeta(page, limit, total) });
});

exports.byLead = asyncHandler(async (req, res) => {
  const data = await LeadActivity.find({ lead: req.params.leadId }).sort({ createdAt: -1 }).limit(200).lean();
  res.json({ data });
});

// Side effects happen ONLY here, when the user explicitly records an action (e.g. confirms they contacted the business).
exports.create = asyncHandler(async (req, res) => {
  const { lead: leadId, type, message = '', nextFollowUpAt } = req.body;
  const lead = await Lead.findById(leadId);
  if (!lead) throw new ApiError(404, 'Lead not found');
  let text = message.trim();

  if (type === 'contacted') {
    if (lead.status === 'Do Not Contact') throw new ApiError(400, 'This lead is marked Do Not Contact');
    lead.lastContactedAt = new Date();
    lead.contactCount += 1;
    if (lead.status === 'New') lead.status = 'Contacted';
    if (nextFollowUpAt) lead.nextFollowUpAt = new Date(nextFollowUpAt);
    text = text || 'Marked as contacted';
  } else if (type === 'follow_up_set') {
    lead.nextFollowUpAt = nextFollowUpAt ? new Date(nextFollowUpAt) : null;
    text = text || (lead.nextFollowUpAt ? `Follow-up set for ${lead.nextFollowUpAt.toDateString()}` : 'Follow-up cleared');
  } else if (type === 'follow_up_completed') {
    lead.nextFollowUpAt = nextFollowUpAt ? new Date(nextFollowUpAt) : null;
    text = text || 'Follow-up completed';
  } else if (!text) {
    throw new ApiError(400, 'Note text is required');
  }
  await lead.save();
  const activity = await LeadActivity.create({ lead: lead._id, type, message: text, createdBy: req.user._id });
  res.status(201).json({ data: activity, lead });
});
