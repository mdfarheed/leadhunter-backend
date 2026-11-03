/*
 * Secure admin bootstrap. There is NO public registration endpoint.
 *   Interactive:      npm run create-admin
 *   Non-interactive:  ADMIN_NAME="..." ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run create-admin
 * If an admin already exists, pass --force to add another.
 */
const readline = require('readline');
const { validateEnv } = require('../config/env');
validateEnv();
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const { seedAll } = require('./seed');

function prompter() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const orig = rl._writeToOutput;
  rl._writeToOutput = function w(s) { if (rl.muted) return; orig.call(rl, s); };
  const ask = (q, hidden = false) => new Promise((resolve) => {
    process.stdout.write(q);
    rl.muted = hidden;
    rl.question('', (a) => { rl.muted = false; if (hidden) process.stdout.write('\n'); resolve(a.trim()); });
  });
  return { ask, close: () => rl.close() };
}

(async () => {
  await connectDB();
  const force = process.argv.includes('--force');
  if (!force && (await User.countDocuments({ role: { $ne: 'user' } })) > 0) {
    console.error('An admin already exists. Re-run with --force to create another one.');
    return;
  }
  let { ADMIN_NAME: name, ADMIN_EMAIL: email, ADMIN_PASSWORD: password, ADMIN_DEVELOPER_NAME: developerName } = process.env;
  if (!name || !email || !password) {
    const p = prompter();
    name = name || await p.ask('Admin name: ');
    email = email || await p.ask('Admin email: ');
    developerName = developerName || await p.ask('Developer name (used in WhatsApp templates): ');
    password = password || await p.ask('Password (min 8 chars, letters + numbers): ', true);
    p.close();
  }
  if (!name || !/^\S+@\S+\.\S+$/.test(email || '')) throw new Error('A name and a valid email are required');
  if (!password || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new Error('Password must be 8+ characters with letters and numbers');
  if (await User.exists({ email: email.toLowerCase() })) throw new Error('A user with that email already exists');
  await User.create({ name, email, password, developerName: developerName || name, role: 'admin', city: process.env.ADMIN_CITY || 'Etah' });
  const seeded = await seedAll();
  console.log(`\nAdmin "${email}" created. Seeded ${seeded.categories} categories and ${seeded.templates} message templates.`);
})()
  .catch((e) => { console.error('Error:', e.message); process.exitCode = 1; })
  .finally(() => disconnectDB().then(() => process.exit()));
