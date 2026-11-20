'use strict';
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./db');

const ROOT = path.join(__dirname, '..');
const PROD = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;
const secretFile = path.join(ROOT, 'data', '.jwt-secret');
const SECRET = process.env.JWT_SECRET || (fs.existsSync(secretFile) ? fs.readFileSync(secretFile, 'utf8') : (() => { const s = crypto.randomBytes(48).toString('hex'); fs.writeFileSync(secretFile, s, { mode: 0o600 }); return s; })());
const j = (v, d = []) => { try { return JSON.parse(v); } catch (e) { return d; } };
const app = express();
app.disable('x-powered-by');
if (PROD) app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ['https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:', 'blob:'], connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

// CSRF defence: cookies are SameSite=Lax and every state-changing request must carry a custom header (forces a CORS preflight).
app.use('/api', (req, res, next) => (['GET', 'HEAD'].includes(req.method) || req.get('x-raf') === '1' ? next() : res.status(403).json({ error: 'Missing request header.' })));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 400, standardHeaders: true, legacyHeaders: false }));
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { error: 'Too many attempts. Try again in 15 minutes.' } });
const contactLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, message: { error: 'Too many messages. Try again later.' } });

// ---------- helpers ----------
const wrap = (fn) => (req, res, next) => { try { fn(req, res, next); } catch (e) { next(e); } };
const fail = (res, code, error) => res.status(code).json({ error });
const clean = (s, max = 200) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max);
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 120;
const pwOk = (p) => typeof p === 'string' && p.length >= 8 && p.length <= 100 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);
const userOut = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, companion: !!db.prepare("SELECT 1 FROM profiles WHERE user_id=? AND status='approved'").get(u.id) });
function setCookie(res, user, remember) {
  const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: remember ? '30d' : '1d' });
  res.cookie('raf_token', token, { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: remember ? 30 * 864e5 : undefined });
}
function auth(req, res, next) {
  try { const { id } = jwt.verify(req.cookies.raf_token, SECRET); const u = db.prepare('SELECT * FROM users WHERE id=?').get(id); if (!u) throw 0; req.user = u; next(); }
  catch (e) { fail(res, 401, 'Please log in.'); }
}
const optAuth = (req, res, next) => { try { const { id } = jwt.verify(req.cookies.raf_token, SECRET); req.user = db.prepare('SELECT * FROM users WHERE id=?').get(id); } catch (e) { /* guest */ } next(); };
const admin = (req, res, next) => (req.user.role === 'admin' ? next() : fail(res, 403, 'Admins only.'));
const notify = (uid, text) => uid && db.prepare('INSERT INTO notifications(user_id,text) VALUES(?,?)').run(uid, text);

const PROFILE_SQL = `SELECT p.*, 
  (SELECT COUNT(*) FROM bookings b WHERE b.profile_id=p.id AND b.status IN ('confirmed','completed')) AS popularity,
  (SELECT ROUND(AVG(stars),1) FROM reviews r WHERE r.profile_id=p.id) AS rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.profile_id=p.id) AS review_count FROM profiles p`;
function shape(p, full) {
  const slots = j(p.slots, ['Mornings', 'Afternoons', 'Evenings']), days = j(p.availability);
  return { id: p.id, name: p.name, age: p.age, city: p.city, bio: p.bio, personality: p.personality, interests: j(p.interests), languages: j(p.languages), activities: j(p.activities),
    rate: p.rate, days, slots, availability: days.concat(slots.includes('Evenings') ? ['Evenings'] : []), photo: p.photo, tone: p.tone, hair: p.hair, skin: p.skin,
    sample: !!p.is_sample, reviewed: !p.is_sample && p.status === 'approved', joined: p.joined || 0, popularity: p.popularity, rating: p.rating, reviewCount: p.review_count, ...(full ? {} : {}) };
}
// ---------- availability ----------
const isWeekend = (d) => [0, 6].includes(new Date(d + 'T00:00:00').getDay());
function daySlots(p, date) {
  const days = j(p.availability), slots = j(p.slots, []);
  const dayOpen = isWeekend(date) ? days.includes('Weekends') : days.includes('Weekdays');
  const taken = new Set();
  db.prepare("SELECT hour,hours FROM bookings WHERE profile_id=? AND date=? AND status IN ('requested','confirmed')").all(p.id, date).forEach((b) => { for (let h = b.hour; h < b.hour + b.hours; h++) taken.add(h); });
  const part = (h) => (h < 12 ? 'Mornings' : h < 17 ? 'Afternoons' : 'Evenings');
  const hours = []; for (let h = 9; h <= 21; h++) hours.push({ h, ok: dayOpen && slots.includes(part(h)) && !taken.has(h) });
  return { open: dayOpen, hours };
}
const dateWindow = () => { const loc = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }; return { min: loc(1), max: loc(60) }; };

// ---------- auth ----------
const api = express.Router();
api.post('/auth/signup', authLimit, wrap((req, res) => {
  const name = clean(req.body.name, 80), email = clean(req.body.email, 120).toLowerCase(), pw = req.body.password;
  if (name.length < 2) return fail(res, 400, 'Enter your name.');
  if (!emailOk(email)) return fail(res, 400, 'Enter a valid email.');
  if (!pwOk(pw)) return fail(res, 400, 'Password needs 8+ characters with upper case, lower case and a number.');
  if (req.body.adult !== true) return fail(res, 400, 'You must confirm you are 18 or older.');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return fail(res, 409, 'An account with this email already exists.');
  const id = db.prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)').run(name, email, bcrypt.hashSync(pw, 10)).lastInsertRowid;
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(id); setCookie(res, u, false); notify(id, 'Welcome to Rent A Friend. Read the safety guidelines before your first meeting.');
  res.status(201).json({ user: userOut(u) });
}));
api.post('/auth/login', authLimit, wrap((req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(clean(req.body.email, 120).toLowerCase());
  if (!u || !bcrypt.compareSync(String(req.body.password || ''), u.password_hash)) return fail(res, 401, 'Email or password is incorrect.');
  setCookie(res, u, req.body.remember === true); res.json({ user: userOut(u) });
}));
api.post('/auth/logout', (req, res) => { res.clearCookie('raf_token'); res.json({ ok: true }); });
api.get('/auth/me', optAuth, (req, res) => res.json({ user: req.user ? userOut(req.user) : null }));
api.patch('/auth/me', auth, wrap((req, res) => {
  const name = clean(req.body.name, 80), email = clean(req.body.email, 120).toLowerCase();
  if (name.length < 2 || !emailOk(email)) return fail(res, 400, 'Enter a valid name and email.');
  if (db.prepare('SELECT 1 FROM users WHERE email=? AND id<>?').get(email, req.user.id)) return fail(res, 409, 'That email is already in use.');
  db.prepare('UPDATE users SET name=?,email=? WHERE id=?').run(name, email, req.user.id); res.json({ user: userOut(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
}));
api.post('/auth/password', auth, authLimit, wrap((req, res) => {
  if (!bcrypt.compareSync(String(req.body.current || ''), req.user.password_hash)) return fail(res, 401, 'Current password is incorrect.');
  if (!pwOk(req.body.next)) return fail(res, 400, 'New password needs 8+ characters with upper case, lower case and a number.');
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(req.body.next, 10), req.user.id); res.json({ ok: true });
}));
api.delete('/auth/me', auth, authLimit, wrap((req, res) => {
  if (req.user.role === 'admin') return fail(res, 400, 'Admin accounts cannot be deleted here.');
  if (!bcrypt.compareSync(String(req.body.password || ''), req.user.password_hash)) return fail(res, 401, 'Password is incorrect.');
  db.prepare('DELETE FROM users WHERE id=?').run(req.user.id); res.clearCookie('raf_token'); res.json({ ok: true });
}));

// ---------- profiles ----------
api.get('/stats', (req, res) => res.json({
  companions: db.prepare("SELECT COUNT(*) c FROM profiles WHERE status='approved'").get().c,
  cities: db.prepare("SELECT COUNT(DISTINCT city) c FROM profiles WHERE status='approved'").get().c,
  bookings: db.prepare("SELECT COUNT(*) c FROM bookings WHERE status IN ('confirmed','completed')").get().c }));
api.get('/profiles', optAuth, wrap((req, res) => {
  let rows = db.prepare(PROFILE_SQL + " WHERE p.status='approved'").all();
  if (req.user) { const bl = new Set(db.prepare('SELECT profile_id FROM blocks WHERE user_id=?').all(req.user.id).map((b) => b.profile_id)); rows = rows.filter((p) => !bl.has(p.id)); }
  res.json({ profiles: rows.map((p) => shape(p)) });
}));
api.get('/profiles/:id', wrap((req, res) => {
  const p = db.prepare(PROFILE_SQL + " WHERE p.id=? AND p.status='approved'").get(req.params.id);
  if (!p) return fail(res, 404, 'Profile not found.');
  const reviews = db.prepare('SELECT r.stars,r.text,r.created_at,u.name FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.profile_id=? ORDER BY r.id DESC LIMIT 20').all(p.id).map((r) => ({ stars: r.stars, text: r.text, by: r.name.split(' ')[0], at: r.created_at }));
  res.json({ profile: shape(p, true), reviews, window: dateWindow() });
}));
api.get('/profiles/:id/availability', wrap((req, res) => {
  const p = db.prepare("SELECT * FROM profiles WHERE id=? AND status='approved'").get(req.params.id); const d = String(req.query.date || '');
  if (!p) return fail(res, 404, 'Profile not found.');
  const w = dateWindow(); if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < w.min || d > w.max) return fail(res, 400, 'Choose a date within the next 60 days.');
  res.json(daySlots(p, d));
}));

// ---------- apply to become a friend ----------
const upload = multer({ storage: multer.diskStorage({ destination: path.join(ROOT, 'uploads'), filename: (r, f, cb) => cb(null, crypto.randomBytes(16).toString('hex') + ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[f.mimetype] || '.bin')) }),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 }, fileFilter: (r, f, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(f.mimetype)) });
const magicOk = (file) => { const b = fs.readFileSync(file).subarray(0, 12); return (b[0] === 0xff && b[1] === 0xd8) || b.toString('latin1', 1, 4) === 'PNG' || (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP'); };
api.post('/apply', auth, upload.single('photo'), wrap((req, res) => {
  const b = req.body, list = (v) => [].concat(v || []).map((x) => clean(x, 40)).filter(Boolean), csv = (v) => String(v || '').split(',').map((x) => clean(x, 30)).filter(Boolean).slice(0, 8);
  const err = (m) => { if (req.file) fs.unlink(req.file.path, () => {}); return fail(res, 400, m); };
  if (req.file && !magicOk(req.file.path)) return err('That file is not a valid image.');
  const age = +b.age, rate = +b.rate, name = clean(b.name, 80), city = clean(b.city, 60), bio = clean(b.bio, 500), email = clean(b.email, 120), phone = clean(b.phone, 20);
  const days = list(b.days).filter((d) => ['Weekdays', 'Weekends'].includes(d)), slots = list(b.slots).filter((s) => ['Mornings', 'Afternoons', 'Evenings'].includes(s));
  if (name.length < 2 || !city) return err('Enter your name and city.');
  if (!(age >= 18 && age <= 99)) return err('You must be 18 or older.');
  if (!(rate >= 200 && rate <= 5000)) return err('Hourly rate must be between ₹200 and ₹5000.');
  if (!emailOk(email)) return err('Enter a valid email.');
  if (!/^[+\d][\d\s-]{8,14}$/.test(phone)) return err('Enter a valid phone number.');
  if (bio.length < 40) return err('Bio needs at least 40 characters.');
  if (!days.length || !slots.length) return err('Choose available days and time slots.');
  if (b.terms !== 'true' && b.terms !== 'on') return err('You must accept the terms.');
  const interests = csv(b.interests), languages = csv(b.languages); if (!interests.length || !languages.length) return err('Add interests and languages.');
  const old = db.prepare('SELECT * FROM profiles WHERE user_id=?').get(req.user.id);
  if (old && old.status !== 'rejected') return err(old.status === 'pending' ? 'Your application is already under review.' : 'You already have a profile.');
  if (old) db.prepare('DELETE FROM profiles WHERE id=?').run(old.id);
  const hair = ['#2b2230', '#5a3a2b', '#7a4b2a', '#3b2a4a', '#8b3a4a'][req.user.id % 5], skin = ['#f6d5c0', '#e9b99a', '#f0c8aa', '#d9a07f'][req.user.id % 4];
  db.prepare(`INSERT INTO profiles(id,user_id,name,age,city,bio,personality,interests,languages,activities,rate,availability,slots,photo,tone,hair,skin,status,phone,email,joined)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?)`).run(`u${req.user.id}-${crypto.randomBytes(3).toString('hex')}`, req.user.id, name, age, city, bio, clean(b.personality, 120), JSON.stringify(interests), JSON.stringify(languages), JSON.stringify(csv(b.activities || interests.join(','))), rate, JSON.stringify(days), JSON.stringify(slots), req.file ? '/uploads/' + req.file.filename : null, ['#405B4B', '#8A6428', '#3D4F5C', '#6B4E3D'][req.user.id % 4], hair, skin, phone, email, Date.now());
  db.prepare("SELECT id FROM users WHERE role='admin'").all().forEach((a) => notify(a.id, `New companion application from ${name}.`));
  notify(req.user.id, 'Application received. A team member will review it before your profile is listed.'); res.status(201).json({ ok: true });
}));
api.get('/my/profile', auth, wrap((req, res) => { const p = db.prepare('SELECT * FROM profiles WHERE user_id=?').get(req.user.id); res.json({ profile: p ? { ...shape(p), status: p.status } : null }); }));
api.patch('/my/profile', auth, wrap((req, res) => {
  const p = db.prepare("SELECT * FROM profiles WHERE user_id=? AND status='approved'").get(req.user.id); if (!p) return fail(res, 404, 'No approved profile.');
  const days = [].concat(req.body.days || []).filter((d) => ['Weekdays', 'Weekends'].includes(d)), rate = +req.body.rate;
  if (!days.length) return fail(res, 400, 'Choose at least one day.');
  if (!(rate >= 200 && rate <= 5000)) return fail(res, 400, 'Hourly rate must be between ₹200 and ₹5000.');
  db.prepare('UPDATE profiles SET availability=?, rate=? WHERE id=?').run(JSON.stringify(days), rate, p.id); res.json({ ok: true });
}));

// ---------- bookings ----------
function bookingOut(b) {
  const end = new Date(`${b.date}T00:00:00`); end.setHours(b.hour + b.hours);
  return { id: b.id, profileId: b.profile_id, friend: b.pname, customer: b.uname, date: b.date, hour: b.hour, hours: b.hours, total: b.total, payout: b.payout, notes: b.notes, status: b.status === 'confirmed' && end < new Date() ? 'completed' : b.status, reviewed: !!b.reviewed };
}
const BSQL = `SELECT b.*, p.name pname, u.name uname, p.user_id puid, (SELECT 1 FROM reviews r WHERE r.booking_id=b.id) reviewed FROM bookings b JOIN profiles p ON p.id=b.profile_id JOIN users u ON u.id=b.user_id`;
api.post('/bookings', auth, wrap((req, res) => {
  const p = db.prepare("SELECT * FROM profiles WHERE id=? AND status='approved'").get(String(req.body.profileId)); if (!p) return fail(res, 404, 'Profile not found.');
  const date = String(req.body.date || ''), hour = +req.body.hour, hours = +req.body.hours, w = dateWindow();
  if (p.user_id === req.user.id) return fail(res, 400, 'You cannot book yourself.');
  if (db.prepare('SELECT 1 FROM blocks WHERE user_id=? AND profile_id=?').get(req.user.id, p.id)) return fail(res, 400, 'You have blocked this profile.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < w.min || date > w.max) return fail(res, 400, 'Choose a date within the next 60 days (from tomorrow).');
  if (!Number.isInteger(hour) || !Number.isInteger(hours) || hours < 1 || hours > 4 || hour < 9 || hour + hours > 22) return fail(res, 400, 'Choose a valid start time and duration.');
  const run = db.transaction(() => {
    const ds = daySlots(p, date); for (let h = hour; h < hour + hours; h++) { const s = ds.hours.find((x) => x.h === h); if (!s || !s.ok) return null; }
    const total = Math.round(p.rate * hours * 1.1), payout = p.rate * hours;
    return db.prepare('INSERT INTO bookings(user_id,profile_id,date,hour,hours,total,payout,notes) VALUES(?,?,?,?,?,?,?,?)').run(req.user.id, p.id, date, hour, hours, total, payout, clean(req.body.notes, 400)).lastInsertRowid;
  });
  const id = run(); if (!id) return fail(res, 409, 'That time is no longer available. Pick another slot.');
  notify(p.user_id, `New booking request from ${req.user.name} on ${date} at ${hour}:00.`); notify(req.user.id, `Request sent to ${p.name} for ${date} at ${hour}:00.`);
  res.status(201).json({ booking: bookingOut(db.prepare(BSQL + ' WHERE b.id=?').get(id)), sample: !!p.is_sample });
}));
api.get('/bookings', auth, wrap((req, res) => {
  const mine = db.prepare(BSQL + ' WHERE b.user_id=? ORDER BY b.date DESC, b.hour DESC').all(req.user.id).map(bookingOut);
  const incoming = db.prepare(BSQL + ' WHERE p.user_id=? ORDER BY b.date DESC, b.hour DESC').all(req.user.id).map(bookingOut);
  res.json({ mine, incoming });
}));
api.patch('/bookings/:id', auth, wrap((req, res) => {
  const b = db.prepare(BSQL + ' WHERE b.id=?').get(+req.params.id), a = req.body.action; if (!b) return fail(res, 404, 'Booking not found.');
  const isCust = b.user_id === req.user.id, isComp = b.puid === req.user.id;
  if (a === 'cancel' && isCust && ['requested', 'confirmed'].includes(b.status)) db.prepare("UPDATE bookings SET status='cancelled' WHERE id=?").run(b.id);
  else if (a === 'accept' && isComp && b.status === 'requested') db.prepare("UPDATE bookings SET status='confirmed' WHERE id=?").run(b.id);
  else if (a === 'decline' && isComp && b.status === 'requested') db.prepare("UPDATE bookings SET status='declined' WHERE id=?").run(b.id);
  else return fail(res, 400, 'That action is not available.');
  if (a === 'cancel') notify(b.puid, `${b.uname} cancelled the booking on ${b.date}.`); else notify(b.user_id, `${b.pname} ${a === 'accept' ? 'accepted' : 'declined'} your booking on ${b.date}.`);
  res.json({ booking: bookingOut(db.prepare(BSQL + ' WHERE b.id=?').get(b.id)) });
}));
api.post('/bookings/:id/review', auth, wrap((req, res) => {
  const b = db.prepare(BSQL + ' WHERE b.id=?').get(+req.params.id); if (!b || b.user_id !== req.user.id) return fail(res, 404, 'Booking not found.');
  if (bookingOut(b).status !== 'completed') return fail(res, 400, 'You can review after the booking is completed.');
  const stars = +req.body.stars; if (!(stars >= 1 && stars <= 5)) return fail(res, 400, 'Choose 1 to 5 stars.');
  if (b.reviewed) return fail(res, 409, 'Already reviewed.');
  db.prepare('INSERT INTO reviews(booking_id,profile_id,user_id,stars,text) VALUES(?,?,?,?,?)').run(b.id, b.profile_id, req.user.id, stars, clean(req.body.text, 400)); res.status(201).json({ ok: true });
}));
api.get('/earnings', auth, wrap((req, res) => {
  const rows = db.prepare(BSQL + ' WHERE p.user_id=?').all(req.user.id).map(bookingOut), sum = (st) => rows.filter((r) => st.includes(r.status)).reduce((a, r) => a + r.payout, 0);
  res.json({ completed: sum(['completed']), upcoming: sum(['confirmed']), pending: sum(['requested']), count: rows.filter((r) => r.status === 'completed').length, note: 'Estimates only. Payouts are not enabled until a payment provider is connected.' });
}));

// ---------- favourites, blocks, reports, notifications, contact ----------
api.get('/favourites', auth, (req, res) => res.json({ ids: db.prepare('SELECT profile_id FROM favourites WHERE user_id=?').all(req.user.id).map((r) => r.profile_id) }));
api.put('/favourites/:id', auth, wrap((req, res) => { if (!db.prepare("SELECT 1 FROM profiles WHERE id=? AND status='approved'").get(req.params.id)) return fail(res, 404, 'Not found.'); db.prepare('INSERT OR IGNORE INTO favourites VALUES(?,?)').run(req.user.id, req.params.id); res.json({ ok: true }); }));
api.delete('/favourites/:id', auth, (req, res) => { db.prepare('DELETE FROM favourites WHERE user_id=? AND profile_id=?').run(req.user.id, req.params.id); res.json({ ok: true }); });
api.put('/blocks/:id', auth, wrap((req, res) => { if (!db.prepare('SELECT 1 FROM profiles WHERE id=?').get(req.params.id)) return fail(res, 404, 'Not found.'); db.prepare('INSERT OR IGNORE INTO blocks VALUES(?,?)').run(req.user.id, req.params.id); db.prepare('DELETE FROM favourites WHERE user_id=? AND profile_id=?').run(req.user.id, req.params.id); res.json({ ok: true }); }));
api.get('/blocks', auth, (req, res) => res.json({ blocked: db.prepare('SELECT p.id,p.name FROM blocks b JOIN profiles p ON p.id=b.profile_id WHERE b.user_id=?').all(req.user.id) }));
api.delete('/blocks/:id', auth, (req, res) => { db.prepare('DELETE FROM blocks WHERE user_id=? AND profile_id=?').run(req.user.id, req.params.id); res.json({ ok: true }); });
api.post('/reports', auth, wrap((req, res) => {
  if (!db.prepare('SELECT 1 FROM profiles WHERE id=?').get(String(req.body.profileId))) return fail(res, 404, 'Profile not found.');
  const reason = clean(req.body.reason, 80); if (!reason) return fail(res, 400, 'Choose a reason.');
  db.prepare('INSERT INTO reports(user_id,profile_id,reason,details) VALUES(?,?,?,?)').run(req.user.id, req.body.profileId, reason, clean(req.body.details, 500));
  db.prepare("SELECT id FROM users WHERE role='admin'").all().forEach((a) => notify(a.id, 'New profile report to review.')); res.status(201).json({ ok: true });
}));
api.get('/notifications', auth, (req, res) => res.json({ items: db.prepare('SELECT id,text,read,created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50').all(req.user.id) }));
api.post('/notifications/read', auth, (req, res) => { db.prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(req.user.id); res.json({ ok: true }); });
api.post('/contact', contactLimit, wrap((req, res) => {
  const name = clean(req.body.name, 80), email = clean(req.body.email, 120), message = clean(req.body.message, 2000);
  if (!name || !emailOk(email) || message.length < 10) return fail(res, 400, 'Fill in your name, a valid email and a message of at least 10 characters.');
  db.prepare('INSERT INTO messages(name,email,message) VALUES(?,?,?)').run(name, email, message); res.status(201).json({ ok: true });
}));

// ---------- admin ----------
api.get('/admin/overview', auth, admin, (req, res) => res.json({
  applications: db.prepare("SELECT id,user_id,name,age,city,bio,email,phone,rate,interests,languages,photo,created_at FROM profiles WHERE status='pending' ORDER BY created_at").all().map((p) => ({ ...p, interests: j(p.interests), languages: j(p.languages) })),
  reports: db.prepare("SELECT r.id,r.reason,r.details,r.created_at,r.profile_id,p.name pname,u.name uname FROM reports r LEFT JOIN profiles p ON p.id=r.profile_id LEFT JOIN users u ON u.id=r.user_id WHERE r.status='open' ORDER BY r.id").all(),
  messages: db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 30').all() }));
api.post('/admin/applications/:id', auth, admin, wrap((req, res) => {
  const p = db.prepare("SELECT * FROM profiles WHERE id=? AND status='pending'").get(req.params.id); if (!p) return fail(res, 404, 'Application not found.');
  const ok = req.body.decision === 'approve'; db.prepare('UPDATE profiles SET status=? WHERE id=?').run(ok ? 'approved' : 'rejected', p.id);
  if (ok) db.prepare("UPDATE users SET role='companion' WHERE id=? AND role='customer'").run(p.user_id);
  notify(p.user_id, ok ? 'Your profile was approved and is now listed.' : 'Your application was not approved. You can update and apply again.'); res.json({ ok: true });
}));
api.post('/admin/reports/:id', auth, admin, wrap((req, res) => {
  const r = db.prepare('SELECT * FROM reports WHERE id=?').get(+req.params.id); if (!r) return fail(res, 404, 'Report not found.');
  if (req.body.action === 'suspend') db.prepare("UPDATE profiles SET status='suspended' WHERE id=?").run(r.profile_id);
  db.prepare("UPDATE reports SET status='closed' WHERE id=?").run(r.id); res.json({ ok: true });
}));
app.use('/api', api);
app.use('/api', (req, res) => fail(res, 404, 'Not found.'));

app.use('/uploads', express.static(path.join(ROOT, 'uploads'), { setHeaders: (r) => r.setHeader('X-Content-Type-Options', 'nosniff'), index: false, dotfiles: 'deny' }));
app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return fail(res, 400, err.code === 'LIMIT_FILE_SIZE' ? 'Photo must be under 3 MB.' : 'Upload failed.');
  if (err.type === 'entity.parse.failed') return fail(res, 400, 'Invalid request.');
  console.error(err); fail(res, 500, 'Something went wrong on our side.');
});
if (require.main === module) app.listen(PORT, () => console.log(`Rent A Friend running at http://localhost:${PORT}`));
module.exports = app;
