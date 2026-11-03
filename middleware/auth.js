const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { env } = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { runWithUser } = require('../utils/requestContext');

exports.signToken = (user) => jwt.sign({ id: user._id, tv: user.tokenVersion }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

exports.protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Authentication required');
  const decoded = jwt.verify(token, env.jwtSecret);
  const user = await User.findById(decoded.id);
  if (!user || user.tokenVersion !== decoded.tv) throw new ApiError(401, 'Session expired. Please sign in again.');
  if (user.active === false) throw new ApiError(403, 'This account has been disabled. Contact the administrator.');
  req.user = user;
  runWithUser(user._id, () => next()); // lets usage counters know which user the work belongs to
});

// Only the admin may pass (creating users, editing shared templates / categories). Accounts without a role are admins.
exports.adminOnly = (req, res, next) => {
  if (req.user?.role === 'user') return next(new ApiError(403, 'Only the administrator can do this'));
  return next();
};
