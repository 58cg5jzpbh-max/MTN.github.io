const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify({ users: {}, otps: {}, withdrawals: [] }, null, 2)
    );
  }
}

function load() {
  ensureDb();
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    fs.writeFileSync(DB_FILE + '.broken-' + Date.now(), raw);
    const fresh = { users: {}, otps: {}, withdrawals: [] };
    save(fresh);
    return fresh;
  }
}

function save(db) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getUser(email) {
  const db = load();
  return db.users[email] || null;
}

function upsertUser(email, patch) {
  const db = load();
  const existing = db.users[email] || {
    email,
    verified: false,
    balanceMb: 0,
    lastTapAt: 0,
    createdAt: Date.now(),
  };
  db.users[email] = { ...existing, ...patch };
  save(db);
  return db.users[email];
}

function setOtp(email, record) {
  const db = load();
  db.otps[email] = record;
  save(db);
}

function getOtp(email) {
  const db = load();
  return db.otps[email] || null;
}

function clearOtp(email) {
  const db = load();
  delete db.otps[email];
  save(db);
}

function addWithdrawal(record) {
  const db = load();
  db.withdrawals.push(record);
  save(db);
  return record;
}

module.exports = {
  getUser,
  upsertUser,
  setOtp,
  getOtp,
  clearOtp,
  addWithdrawal,
};