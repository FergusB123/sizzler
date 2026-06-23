# Sizzler — build decisions

Judgement calls made during the one-pass build, where the brief left room.

## Visual redesign — "Noir Editorial"
The original warm orange/cream theme was fully replaced with a dark, contemporary
design language at the user's request:
- Near-black canvas (`#0a0a0b`) with micro-stepped elevation and hairline borders
  instead of drop shadows; iris/indigo accent (`#6e6bff`) used as *light* (glow +
  small punctuation), emerald (`#34d399`) for positives.
- Type-led: **Clash Display** headings + **General Sans** body (Fontshare).
- All emoji removed from the UI in favour of a single stroke-icon set
  (`src/components/Icon.jsx`). Recipe images that don't exist render a typographic
  initial fallback rather than a generated stub (stub gen off by default).
- Floating pill bottom nav, bento Home, editorial recipe cards.
- Design tokens centralise in `src/index.css`; old variable names were kept and
  remapped so component CSS cascaded with minimal churn.

## Architecture pivot (Supabase → Botanica stack)
The app was first built on Supabase (Postgres+RLS, Auth, Storage, Edge Functions).
At the user's request it was re-platformed onto the **same stack as their Botanica
project** for consistency and reuse of existing infrastructure:
- **Supabase Postgres + RLS → Neon Postgres** via `pg`, ownership enforced per-route
  (`WHERE user_id = $1`) instead of row-level security.
- **Supabase Auth → JWT + bcrypt** (`Bearer` token in localStorage), mirroring Botanica.
- **Supabase Storage → Cloudinary** (`services/storage.js`, copied from Botanica) with
  local-disk dev fallback. Note: Botanica's env has no Cloudinary creds, so local dev
  stores images under `/uploads`; add `CLOUDINARY_*` for production hosting.
- **Edge Functions → Express routes** + the Anthropic Node SDK (`services/claude.js`).
- **Supabase cron → node-cron** (self-host) / **Vercel Cron** (`api/cron/reminders.js`).
- **Profile table → columns on the `users` row** (mirrors Botanica storing
  `push_subscription` on users) — simpler than a separate profiles table.
- Project restructured into `client/` + `server/` with a root `package.json` running
  both via `concurrently`, matching Botanica's layout and Vercel config.
- IDs are now integer `SERIAL` (were UUIDs); the drag-to-swap handler casts the DOM
  `data-slot-id` string back to a number.
- Default model set to `claude-sonnet-4-6` (Botanica's model) via `ANTHROPIC_MODEL`.
- The whole React UI, planner logic and shopping-list logic were reused unchanged —
  only the data/auth/push layer (`lib/api.js`, `context/AuthContext`, `lib/push.js`)
  was rewritten to call the REST API.
- **`nodemon.json` scopes the watcher to `server/` only.** Without it, `npm run dev`
  had nodemon watching the whole repo, so Vite's writes to `client/dev-dist` (the PWA
  dev service worker) triggered constant API restarts — during a restart window the
  Vite proxy returns HTTP 500, which surfaced as intermittent "request failed with
  status 500" on sign-up. Scoping the watcher eliminates the restart storm.

## Brand / logo
- **No logo file was attached** to the brief, so the visual identity is reconstructed
  from the description (flame + pan, warm orange/black/cream). The mark lives in
  `public/icons/flame.svg`; PNG app icons are generated from it via `npm run icons`.
  Swap `flame.svg` and re-run that script to drop in the real artwork — nothing else
  references raster logos directly.

## Stack & architecture
- **AI calls run server-side in Supabase Edge Functions**, never the browser, so the
  Anthropic key is never shipped in the bundle. The client calls `extract-recipe`,
  `import-url`, `generate-image`. Model defaults to `claude-opus-4-8` (override with
  the `ANTHROPIC_MODEL` secret).
- **Structured extraction uses a single Claude tool** (`save_recipe`) with
  `tool_choice` forced, so text / URL / photo / social all return an identical recipe
  shape. The same system prompt instructs Claude to *infer* missing fields and list
  them in `inferred_fields` → stored as `ai_inferred_fields` → shown as dismissible
  "AI" tags in the UI.
- **Image generation is stubbed** (`generate-image`): with no key it returns an
  on-brand deterministic SVG "food card" (data URL), so the app is fully functional
  offline of any image API. `realProvider()` is the single function to implement for a
  real generator (OpenAI Images / Replicate examples are inlined as comments).

## Data model & privacy
- Recipes are **private by default** (`is_shared = false`) and protected by RLS:
  owners get full CRUD on their rows; everyone can `select` rows where `is_shared`.
  A `community_recipes` view joins shared recipes to author display names and is the
  only surface other users read from.
- **Storage**: recipe images go in a public-read `recipe-images` bucket, but writes are
  restricted to a folder named after the user's uid (`<uid>/<uuid>.jpg`).
- Shopping list has **two independent tick states** (`have_at_home`, `in_cart`) rather
  than one — the home pantry check and the in-store trolley check are different mental
  models, and items marked "have at home" are hidden from the in-store list.

## Planning
- **Auto-allocation variety rules** (`src/lib/planner.js`): meal-type fit is a hard
  filter; "heavy" dishes (curry/roast/≥60 min) are barred from breakfast; soft scoring
  penalises same-cuisine-on-consecutive-days, same-cuisine-within-a-day, repeated
  recipes, and over-used cuisines, with a little jitter to break ties.
- **Shortlist target** is ~70% of total slots (min 3): enough for variety without
  demanding an unrealistically large library, since recipes may repeat across a week.
- **Drag-adjust** after auto-allocation is implemented as drag-to-**swap** between
  slots (drag a filled slot's card onto another to exchange them), plus tap-to-edit via
  a recipe picker. This is more reliable on touch than free reordering into a grid.
- A **plan is created on demand** the first time you open Plan/Swipe/Manual, using the
  household's saved horizon + meals. Creating a new plan archives the previous active one.

## Notifications
- Permission is requested at a **sensible moment** — right after a plan is created
  (`PushPrimer`), never on first load. It no-ops if already granted/denied/unsupported.
- Reminder cadence is enforced server-side in `send-reminders` with per-plan bookkeeping
  columns (`reminded_2d_at/1d_at/0d_at`) so each nudge fires at most once. The 1-day and
  same-day nudges only fire while the plan is still `active` (i.e. the user hasn't moved
  it to `planning`/archived by starting a new plan). Wire it to a daily cron — see README.

## Auth
- **Email + password** with optional magic-link, via Supabase Auth. A DB trigger
  auto-creates a `profiles` row on signup; onboarding fills it in. If email confirmation
  is enabled in your Supabase project, signups must confirm before first sign-in.

## Scope notes / placeholders
- **Social import is best-effort**: we read `og:description` / JSON-LD from the link.
  Full TikTok/IG video transcription is not implemented (platforms block it and it needs
  extra infra) — failures surface a clear "paste it manually" fallback, as specified.
- Recipe **editing** reuses the same `RecipeForm`; the detail screen currently supports
  share-toggle + delete. A dedicated edit route can reuse `RecipeForm` with `initial`.
- Offline: app shell + images + GET responses are cached (service worker). Mutations
  assume connectivity; an offline write queue is a future enhancement.
