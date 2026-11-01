const mongoose = require('mongoose');
const { env } = require('./env');

mongoose.set('strictQuery', true);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connectDB(maxAttempts = 5) {
  mongoose.connection.on('connected', () => console.log(`[db] connected to "${mongoose.connection.name}"`));
  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'));
  mongoose.connection.on('reconnected', () => console.log('[db] reconnected'));
  mongoose.connection.on('error', (e) => console.error('[db] error:', e.message));

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 10 });
      return mongoose.connection;
    } catch (err) {
      console.error(`[db] connection attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
      if (attempt === maxAttempts) throw err;
      await sleep(1000 * 2 ** attempt);
    }
  }
}

const disconnectDB = () => mongoose.connection.close();
module.exports = { connectDB, disconnectDB };
