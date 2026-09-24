require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const db = require('./db');
const { sendWithdrawalEmail } = require('./mailer');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET || 'insecure_dev_secret_change_me';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const CAP_MB = Number(process.env.CAP_MB || 100);
const TAP_MIN_MB = Number(process.env.TAP_MIN_MB || 0.3);
const TAP_MAX_MB = Number(process.env.TAP_MAX_MB || 0.8);
const TAP_COOLDOWN_MS = Number(process.env.TAP_COOLDOWN_MS || 150);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+?234|0)[7-9]\d{9}$/;

function signToken(email) {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: '30d' });
}

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not logged in.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userEmail = payload.email;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expired, please log in again.' });
  }
}

// ---------- Auth: log in with just an email, no code ----------
app.post('/api/auth/login', (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const user = db.upsertUser(email, { verified: true });

  const token = signToken(email);
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.json({ email, balanceMb: user.balanceMb, capMb: CAP_MB });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out.' });
});

// ---------- Current user info ----------
app.get('/api/me', requireAuth, (req, res) => {
  const user = db.getUser(req.userEmail);
  res.json({ email: req.userEmail, balanceMb: user.balanceMb, capMb: CAP_MB });
});

// ---------- Tap to earn ----------
app.post('/api/tap', requireAuth, (req, res) => {
  const user = db.getUser(req.userEmail);
  if (!user) return res.status(400).json({ error: 'User not found.' });

  if (user.balanceMb >= CAP_MB) {
    return res.status(400).json({
      error: `You've reached the ${CAP_MB}MB limit. Withdraw before it can grow again.`,
      balanceMb: user.balanceMb,
      capped: true,
    });
  }

  const now = Date.now();
  if (now - (user.lastTapAt || 0) < TAP_COOLDOWN_MS) {
    return res.status(429).json({ error: 'Too fast, slow down a little.' });
  }

  const increment = TAP_MIN_MB + Math.random() * (TAP_MAX_MB - TAP_MIN_MB);
  const newBalance = Math.min(CAP_MB, Math.round((user.balanceMb + increment) * 100) / 100);

  const updated = db.upsertUser(req.userEmail, { balanceMb: newBalance, lastTapAt: now });
  res.json({ balanceMb: updated.balanceMb, capMb: CAP_MB, capped: updated.balanceMb >= CAP_MB });
});

// ---------- Withdraw ----------
app.post('/api/withdraw', requireAuth, async (req, res) => {
  const phone = String((req.body && req.body.phone) || '').trim();
  if (!PHONE_RE.test(phone)) {
    return res.status(400).json({ error: 'Please enter a valid Nigerian phone number.' });
  }

  const user = db.getUser(req.userEmail);
  if (!user || user.balanceMb < CAP_MB) {
    return res.status(400).json({
      error: `You need to reach ${CAP_MB}MB before you can withdraw.`,
    });
  }

  const amountMb = user.balanceMb;
  const record = {
    id: crypto.randomUUID(),
    userEmail: req.userEmail,
    phone,
    amountMb,
    requestedAt: Date.now(),
    status: 'pending',
  };
  db.addWithdrawal(record);
  db.upsertUser(req.userEmail, { balanceMb: 0, lastTapAt: 0 });

  try {
    if (ADMIN_EMAIL) await sendWithdrawalEmail(ADMIN_EMAIL, record);
  } catch (e) {
    console.error('Failed to send withdrawal email (request is still saved locally):', e.message);
  }

  res.json({ message: 'Withdrawal request submitted. Your data will be sent within 24 hours.', balanceMb: 0 });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`StartMiner backend running at http://localhost:${PORT}`);
});