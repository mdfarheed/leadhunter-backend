// Carries the signed-in user's id through async calls, so low-level code (API-usage counters) can attribute work to a user
// without every function needing a `user` argument.
const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();
const runWithUser = (userId, fn) => als.run({ userId: String(userId) }, fn);
const currentUserId = () => als.getStore()?.userId || null;

module.exports = { runWithUser, currentUserId };
