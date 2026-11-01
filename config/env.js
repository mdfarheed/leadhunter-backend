require('dotenv').config();

const isPlaceholder = (v) => !v || /^YOUR_/i.test(v);

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  googleKey: isPlaceholder(process.env.GOOGLE_PLACES_API_KEY) ? null : process.env.GOOGLE_PLACES_API_KEY,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  googleStrictStorage: String(process.env.GOOGLE_STRICT_STORAGE ?? 'true') !== 'false',
  trustProxy: process.env.TRUST_PROXY === 'true',
  serveFrontend: process.env.SERVE_FRONTEND === 'true',
};

function validateEnv() {
  const problems = [];
  if (isPlaceholder(env.mongoUri)) problems.push('MONGODB_URI is missing or still a placeholder');
  if (isPlaceholder(env.jwtSecret)) problems.push('JWT_SECRET is missing or still a placeholder');
  else if (env.jwtSecret.length < 32) problems.push('JWT_SECRET must be at least 32 characters');
  if (problems.length) {
    console.error('\n[config] Cannot start. Fix backend/.env:\n - ' + problems.join('\n - ') + '\n');
    process.exit(1);
  }
  if (!env.googleKey) console.warn('[config] GOOGLE_PLACES_API_KEY not set - Find Businesses will be disabled until you add it.');
}

module.exports = { env, validateEnv };
