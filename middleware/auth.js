const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { env } = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

exports.signToken = (user) => jwt.sign({ id: user._id, tv: user.tokenVersion }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

exports.protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Authentication required');
  const decoded = jwt.verify(token, env.jwtSecret);
  const user = await User.findById(decoded.id);
  if (!user || user.tokenVersion !== decoded.tv) throw new ApiError(401, 'Session expired. Please sign in again.');
  req.user = user;
  next();
});
