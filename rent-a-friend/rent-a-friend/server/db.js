'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const dir = path.join(__dirname, '..', 'data');
const db = new Database(process.env.DB_FILE || path.join(dir, 'rentafriend.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS profiles(
  id TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, age INTEGER NOT NULL,
  city TEXT NOT NULL, bio TEXT, personality TEXT, interests TEXT, languages TEXT, activities TEXT, rate INTEGER NOT NULL,
  availability TEXT, slots TEXT, photo TEXT, tone TEXT, hair TEXT, skin TEXT, status TEXT NOT NULL DEFAULT 'pending',
  is_sample INTEGER NOT NULL DEFAULT 0, phone TEXT, email TEXT, joined INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS bookings(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, date TEXT NOT NULL, hour INTEGER NOT NULL,
  hours INTEGER NOT NULL, total INTEGER NOT NULL, payout INTEGER NOT NULL, notes TEXT,
  status TEXT NOT NULL DEFAULT 'requested', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS ix_book ON bookings(profile_id, date);
CREATE TABLE IF NOT EXISTS favourites(user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE, PRIMARY KEY(user_id, profile_id));
CREATE TABLE IF NOT EXISTS blocks(user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE, PRIMARY KEY(user_id, profile_id));
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY, user_id INTEGER, profile_id TEXT, reason TEXT NOT NULL, details TEXT, status TEXT DEFAULT 'open', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, text TEXT NOT NULL, read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, booking_id INTEGER UNIQUE REFERENCES bookings(id) ON DELETE CASCADE, profile_id TEXT, user_id INTEGER, stars INTEGER NOT NULL, text TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, name TEXT, email TEXT, message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);

// Seed sample companions once (clearly flagged is_sample = 1).
if (db.prepare('SELECT COUNT(*) c FROM profiles').get().c === 0) {
  const seed = JSON.parse(fs.readFileSync(path.join(dir, 'json.json'), 'utf8'));
  const hairs = ['#2b2230', '#5a3a2b', '#1f1f2e', '#7a4b2a', '#3b2a4a', '#8b3a4a', '#2a3a4a', '#4a3320'];
  const skins = ['#f6d5c0', '#e9b99a', '#f3cdb3', '#d9a07f', '#f0c8aa', '#e7b393', '#f8dcc8', '#dfae8e'];
  const ins = db.prepare(`INSERT INTO profiles(id,name,age,city,bio,personality,interests,languages,activities,rate,availability,slots,tone,hair,skin,status,is_sample,joined)
    VALUES(@id,@name,@age,@city,@bio,@personality,@interests,@languages,@activities,@rate,@availability,@slots,@tone,@hair,@skin,'approved',1,@joined)`);
  seed.profiles.forEach((p, i) => ins.run({ ...p, interests: JSON.stringify(p.interests), languages: JSON.stringify(p.languages), activities: JSON.stringify(p.activities), availability: JSON.stringify(p.availability.filter((x) => x !== 'Evenings')), slots: JSON.stringify(p.availability.includes('Evenings') ? ['Evenings'] : ['Mornings', 'Afternoons', 'Evenings']), hair: hairs[i % 8], skin: skins[i % 8] }));
}

// Seed an admin once. Set ADMIN_EMAIL / ADMIN_PASSWORD, or a random password is printed a single time.
if (!db.prepare("SELECT 1 FROM users WHERE role='admin'").get()) {
  const email = process.env.ADMIN_EMAIL || 'admin@rentafriend.local';
  const pass = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES('Admin',?,?,'admin')").run(email, bcrypt.hashSync(pass, 10));
  console.log(`\n  First run: admin account created\n  email:    ${email}\n  password: ${process.env.ADMIN_PASSWORD ? '(from ADMIN_PASSWORD)' : pass}\n  Save this now. It is not shown again.\n`);
}
module.exports = db;
