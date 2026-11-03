// Per-user data isolation. Every lead / activity / search-history / visit record stores its owner in `createdBy`.
// A normal user only ever sees their own records. The admin sees their own records PLUS legacy records that were created
// before multi-user support (they have no owner), so existing data keeps working without a migration.
const isAdmin = (user) => user?.role !== 'user'; // old accounts have no role => admin

function ownerFilter(user, field = 'createdBy') {
  if (isAdmin(user)) return { $or: [{ [field]: user._id }, { [field]: { $exists: false } }, { [field]: null }] };
  return { [field]: user._id };
}

// Combine the owner restriction with any other filter (the other filter may itself use $or).
function withOwner(user, filter = {}, field = 'createdBy') {
  const own = ownerFilter(user, field);
  return filter && Object.keys(filter).length ? { $and: [own, filter] } : own;
}

module.exports = { isAdmin, ownerFilter, withOwner };
