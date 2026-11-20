# Rent A Friend

A companionship marketplace (platonic, 18+): Express + SQLite backend with a vanilla HTML/CSS/JS front end. Four themes, four font packs.

## Run it (first time)
1. Install **Node.js LTS** (https://nodejs.org). Version 18 or newer.
2. Extract this folder. **Windows:** double-click `start.bat`. **Mac/Linux:** run `./start.sh`. Or in a terminal: `npm install` then `npm start`.
3. Open **http://localhost:3000**. (Opening the HTML files directly will not work now: the pages need the server.)
4. On the first run the terminal prints the **admin email and password once**. Save it. To choose your own, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before the first run.

## Try the whole flow
- Sign up (you confirm you are 18+), browse, save favourites, open a profile, book a time. The server blocks double-bookings, past dates and invalid hours, and calculates the price itself.
- Apply at *Become a Friend* (needs an account). Log in as admin, open **Dashboard → Open admin review**, approve it. The profile goes live and the user gets companion tools: booking requests (accept/decline), earnings estimate, availability and rate.
- A customer can review a booking after it is completed (a confirmed booking whose time has passed).
- Report or block a profile. Reports appear in the admin page. Admins can suspend a profile.
- **Appearance** button (top bar): Classic ivory, Sakura (anime), Starry night (anime), Matcha. Fonts: Editorial, Soft rounded, Kawaii, Modern. Saved on the device only.

## What is real
Accounts (bcrypt-hashed passwords, httpOnly cookie sessions), database storage, availability and conflict checks, booking requests with accept/decline, notifications, favourites, blocks, reports, reviews, photo upload (JPG/PNG/WebP, 3 MB, content checked), admin approval, account deletion, rate limiting, CSRF protection (SameSite cookie plus required header), security headers (CSP via helmet), input validation on the server.

## What is not (needs you or a provider)
- **Payments:** none collected. Bookings are requests. Add Razorpay/Stripe and a webhook before charging anyone. Earnings shown are estimates.
- **Identity verification:** "Reviewed by team" is a manual admin approval, not an ID check. Add an ID-verification provider before relying on it for safety claims.
- **Email:** no emails are sent (no password reset by email, no booking emails). Connect an email service (e.g. Resend, SES) and add reset tokens.
- **Sample profiles** (8 seeded, labelled "Sample") are fictional and send nothing to anyone. Delete them from the database before launch.
- **Moderation staffing and legal review:** the terms, privacy, safety and community pages are templates with placeholders. Have a lawyer review them. Fill in the company name, jurisdiction and contact details.
- **Avatars** are generated illustrations until a companion uploads a photo.

## Put it online (checklist)
1. Host on a Node platform with a **persistent disk** for `data/` and `uploads/` (Render, Railway, a VPS). Back them up.
2. Set `NODE_ENV=production`, `JWT_SECRET` (long random string), `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Serve over **HTTPS** (cookies are `secure` in production).
3. Put it behind a reverse proxy (it already trusts one proxy in production). For many users, move SQLite to PostgreSQL.
4. Add the payment, email and ID-verification pieces above, then get the legal review.

## Structure
```
server/index.js   API, auth, rules, admin     server/db.js   schema and seed
public/           the website (HTML, css/, js/, assets/)
data/json.json    seed data for sample profiles (DB file is created in data/)
uploads/          user photos        tools/build_pages.py  regenerates the HTML pages
```
To change the shared header/footer or page text: edit `tools/build_pages.py`, then `cd public && python3 ../tools/build_pages.py`.

## External resources
Google Fonts (DM Sans, Playfair Display, Zen Maru Gothic, Nunito, Fredoka, Manrope) via CDN with system fallbacks. npm packages: express, better-sqlite3, bcryptjs, jsonwebtoken, cookie-parser, helmet, express-rate-limit, multer.
