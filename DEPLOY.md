# Deploying Sizzler to Vercel

The repo is already structured for Vercel: the Vite client builds to `client/dist`,
the Express server is wrapped as a serverless function in `api/index.js`, and
`vercel.json` wires routing + a daily reminder cron. Steps below.

## 1. Push to GitHub

This folder is now a git repo with an initial commit. Create an **empty** repo on
GitHub (no README/license), then:

```bash
cd ~/sizzler
git remote add origin https://github.com/<you>/sizzler.git
git branch -M main
git push -u origin main
```

`.env` is git-ignored, so **no secrets are committed** — they go into Vercel below.

## 2. Set up Cloudinary (needed for images in production)

Vercel's filesystem is read-only/ephemeral, so the local `/uploads` store doesn't
work in prod. Use Cloudinary's free tier:

1. Create an account at [cloudinary.com](https://cloudinary.com).
2. Note your **Cloud name** (Dashboard).
3. Settings → **Upload** → add an **unsigned** upload preset; note its name.

You'll set `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_UPLOAD_PRESET` in Vercel.
(Without these, images still work but get stored as base64 in Postgres — heavy; not
recommended.)

## 3. Import the project into Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import your GitHub repo.
2. Framework preset: **Other** (the included `vercel.json` drives the build).
   - Build command, output dir, and install command are already set in `vercel.json`;
     don't override them.
3. Add **Environment Variables** (Production + Preview) — see the table below.
4. **Deploy.**

## 4. Environment variables (Vercel → Settings → Environment Variables)

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Neon pooled connection string (`...-pooler...?sslmode=require`) |
| `JWT_SECRET` | A long random string (reuse local, or generate a new one) |
| `ANTHROPIC_API_KEY` | Your Anthropic key |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` |
| `VAPID_PUBLIC_KEY` | From local `.env` |
| `VAPID_PRIVATE_KEY` | From local `.env` |
| `VAPID_EMAIL` | `mailto:you@example.com` |
| `CLOUDINARY_CLOUD_NAME` | From step 2 |
| `CLOUDINARY_UPLOAD_PRESET` | From step 2 (unsigned) |
| `CRON_SECRET` | A random string — protects the reminders cron endpoint |

The schema auto-creates on first request (idempotent `CREATE TABLE IF NOT EXISTS`),
so no migration step is needed. You're using the **same Neon database** as local dev,
so your existing recipes/account carry over.

## 5. After first deploy

- Open the deployment URL, sign up / log in (demo: `demo@sizzler.app` / `sizzler1234`).
- On mobile, "Add to Home Screen" installs the PWA (HTTPS is provided by Vercel, so
  install + push notifications work).
- The reminder cron runs daily at 09:00 UTC (`vercel.json`). Vercel Cron sends the
  `CRON_SECRET` as a bearer token, which `api/cron/reminders.js` verifies.

## Notes / gotchas

- **Function timeout:** recipe extraction calls Claude (can take ~10s). `vercel.json`
  sets `maxDuration: 60`. If a deploy rejects it on your plan, lower it to the plan's
  max (Hobby historically 10s) — most imports still finish in time.
- **Rotate the secrets** that were shared during development (DB password in Neon,
  Anthropic key) once live, and update them in Vercel.
- Local-only `/uploads` images were cleared from the DB (they'd 404 in prod); those
  recipes show the typographic fallback until re-imported with Cloudinary configured.
- Cron jobs require the Vercel Cron feature (available on Hobby at 1×/day, which matches
  our schedule).
