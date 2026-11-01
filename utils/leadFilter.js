const escapeRegex = require('./escapeRegex');

const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

function buildLeadFilter(q = {}) {
  const f = {};
  const and = [];
  if (q.q) {
    const rx = new RegExp(escapeRegex(String(q.q).trim()), 'i');
    and.push({ $or: [{ businessName: rx }, { phone: rx }, { whatsappNumber: rx }, { address: rx }, { notes: rx }, { ownerName: rx }, { website: rx }] });
  }
  if (q.status) f.status = { $in: String(q.status).split(',') };
  if (q.category) f.category = { $in: String(q.category).split(',') };
  if (q.city) f.city = new RegExp(`^${escapeRegex(String(q.city).trim())}$`, 'i');
  if (q.state) f.state = new RegExp(`^${escapeRegex(String(q.state).trim())}$`, 'i');
  if (q.whatsappStatus) f.whatsappStatus = q.whatsappStatus;
  if (q.dataSource) f.dataSource = q.dataSource;
  if (q.hasPhone === 'yes' || q.hasPhone === 'true') and.push({ phone: { $nin: ['', null] } });
  if (q.hasPhone === 'no' || q.hasPhone === 'false') and.push({ $or: [{ phone: '' }, { phone: null }, { phone: { $exists: false } }] });
  if (q.hasWebsite === 'yes' || q.hasWebsite === 'true') and.push({ website: { $nin: ['', null] } });
  if (q.hasWebsite === 'no' || q.hasWebsite === 'false') and.push({ $or: [{ website: '' }, { website: null }, { website: { $exists: false } }] });
  if (q.followUp === 'overdue') f.nextFollowUpAt = { $lt: startOfDay() };
  else if (q.followUp === 'today') f.nextFollowUpAt = { $gte: startOfDay(), $lte: endOfDay() };
  else if (q.followUp === 'upcoming') f.nextFollowUpAt = { $gt: endOfDay() };
  else if (q.followUp === 'any') f.nextFollowUpAt = { $ne: null };
  if (q.ids) f._id = { $in: String(q.ids).split(',').filter((id) => /^[a-f\d]{24}$/i.test(id)) };
  if (and.length) f.$and = and;
  return f;
}

const SORTABLE = ['businessName', 'category', 'city', 'status', 'lastContactedAt', 'nextFollowUpAt', 'createdAt', 'updatedAt', 'whatsappStatus'];
function buildSort(q = {}) {
  const field = SORTABLE.includes(q.sort) ? q.sort : 'createdAt';
  const dir = q.order === 'asc' ? 1 : -1;
  return { [field]: dir, _id: -1 };
}

module.exports = { buildLeadFilter, buildSort, startOfDay, endOfDay };
