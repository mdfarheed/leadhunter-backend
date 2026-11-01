const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { env } = require('../config/env');
const { isConfigured } = require('../services/googlePlaces');
const { getPreferences, savePreferences, getUsage } = require('../services/settingsService');

async function payload(user) {
  return {
    profile: { name: user.name, email: user.email, developerName: user.developerName },
    preferences: await getPreferences(),
    google: { configured: isConfigured(), strictStorage: env.googleStrictStorage }, // never includes the key
    usage: await getUsage(),
  };
}

exports.get = asyncHandler(async (req, res) => res.json(await payload(req.user)));

exports.update = asyncHandler(async (req, res) => {
  const { profile, preferences } = req.body;
  if (profile) {
    if (profile.email && profile.email !== req.user.email && (await User.exists({ email: profile.email }))) throw new ApiError(409, 'Email already in use');
    ['name', 'email', 'developerName'].forEach((k) => { if (profile[k] !== undefined) req.user[k] = profile[k]; });
    await req.user.save();
  }
  if (preferences) {
    const allowed = ['defaultCountryCode', 'defaultCountry', 'defaultState', 'defaultCity', 'defaultTemplateId'];
    await savePreferences(Object.fromEntries(allowed.filter((k) => preferences[k] !== undefined).map((k) => [k, preferences[k] || (k === 'defaultTemplateId' ? null : '')])));
  }
  res.json(await payload(req.user));
});
