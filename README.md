# 🔥 Sizzler

A production-quality, mobile-first **recipe storage + meal-planning PWA**. Save recipes
four ways (manual, URL, photo, social), plan your week by swiping or by hand, and get a
categorised shopping list — installable and offline-capable.

Built on the **same stack as Botanica**: React + Vite client, Express + Neon (Postgres)
server, Cloudinary image uploads, JWT auth, node-cron, web-push, and the Anthropic SDK.

```
sizzler/
├── client/            # React + Vite PWA (the whole UI)
│   └── src/
│       ├── api/       # axios client (Bearer token)
│       ├── lib/       # REST data layer, planner + shopping logic, push
│       ├── context/   # JWT Auth + Profile providers
│       ├── components/ # UI kit, RecipeCard, RecipeForm, BottomNav, PushPrimer
│       ├── pages/      # Auth, Onboarding, Home, Library, RecipeDetail, add/*, Plan, …
│       └── sw.js       # service worker (precache + offline + push)
├── server/            # Express API
│   ├── database.js    # pg Pool + schema (prefs live on the users row)
│   ├── middleware/    # JWT auth
│   ├── routes/        # auth, profile, recipes, import, plans, shopping, notifications, config, cron
│   └── services/      # claude (extraction), storage (Cloudinary), images, push, cron
├── api/               # Vercel serverless entry (wraps server/app) + cron fn
└── vercel.json
```

## Quick start

```bash
npm run install:all        # installs server (root) + client deps
cp .env.example .env        # already auto-wired locally; just set DATABASE_URL
```

Set **`DATABASE_URL`** in `.env` to a Neon Postgres connection string
(create a free DB at [neon.tech](https://neon.tech)). The rest of `.env` is already
populated locally (Anthropic key reused from Botanica, fresh JWT + VAPID generated).

```bash
npm run seed   # optional: demo@sizzler.app / sizzler1234 + 4 recipes
npm run dev    # server on :3011, client on :5180 (proxied)
```

Open **http://localhost:5180**.

## Environment (`.env`, repo root)

| Var | Notes |
|-----|-------|
| `DATABASE_URL` | **Required.** Neon Postgres. The schema auto-creates on boot. |
| `JWT_SECRET` | Auth signing secret (auto-generated locally). |
| `ANTHROPIC_API_KEY` | Recipe extraction (reused from Botanica). |
| `ANTHROPIC_MODEL` | Defaults to `claude-sonnet-4-6`. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_EMAIL` | Web Push (auto-generated locally). |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_UPLOAD_PRESET` | Optional. Unset → dev stores images on local disk (`/uploads`); on Vercel falls back to base64. |
| `CRON_SECRET` | Optional. Protects the `/api/cron/reminders` endpoint in production. |

## How the pieces map to the brief

- **4 add routes** → `POST /api/import/{text,url,photo}` + manual form; all hit
  `services/claude.js` (one forced `save_recipe` tool → identical recipe shape, with
  inferred fields flagged as dismissible "AI" tags).
- **Private vs shared** → `recipes.is_shared`; ownership enforced per-route with
  `WHERE user_id = $1`; community reads only `is_shared = TRUE`.
- **Swipe planner** → `GET /api/recipes/swipe-pool` (own + community), client-side
  variety-rule allocation (`lib/planner.js`), drag-to-swap, then `PUT /api/plans/slots`.
- **Shopping list** → `lib/shoppingList.js` builds a categorised, de-duped list;
  `have_at_home` vs `in_cart` are two distinct tick states.
- **Reminders** → `services/cron.js` (2d / 1d / 0d cadence, self-throttling) runs via
  node-cron when self-hosting, or via Vercel Cron (`api/cron/reminders.js`) in prod.
  Permission is asked at a sensible moment (`PushPrimer`, after a plan is created).

## Deploy (Vercel)

`vercel.json` is set up like Botanica: client build → `client/dist`, all `/api/*`
routed to `api/index.js` (the Express app), and a daily cron hitting
`/api/cron/reminders`. Set the same env vars in the Vercel project (plus Cloudinary for
real image hosting).

See [`DECISIONS.md`](./DECISIONS.md) for the judgement calls.
