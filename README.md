# 🎬 Movie Guardian

A personal movie **tracking + recommendation** site, built for me and a few friends —
and as a way to learn modern web development. Everything runs on **free** tools.

**Live:** <https://movie-guardian.vercel.app> · **Code:** <https://github.com/tudorbaranai/movie-guardian>

Two features:

1. **Recommendations** (the main goal, later phase): a self-hosted, content-based model
   suggests films for you based on your taste and history. No paid AI APIs.
2. **Tracking** (built): search movies, mark them seen, rate them, keep watchlists.

> Full roadmap and design decisions live in [PLAN.md](./PLAN.md).
> _Last updated: 2026-09-15._

---

## Progress so far

- [x] **Phase 0 — Foundation:** Next.js project, Supabase, TMDB key — and now
      **deployed on Vercel** from GitHub.
- [x] **Phase 1 — Movie tracker:**
  - [x] Movie **search** via TMDB (homepage).
  - [x] Movie **detail pages** (dynamic route `/movie/[id]`).
  - [x] **Login** (email + password) via Supabase — login page + header showing who's signed in.
  - [x] **Database table** `user_movies` created with Row-Level Security.
  - [x] **"✓ Seen" / "+ Watchlist" / 1–10 rating buttons** on movie pages.
  - [x] **"My Movies"** page listing what you've marked (linked from the header).
- [x] **Design pass** — dark Letterboxd-style theme + a full set of real site features:
  - Sticky header with logo, always-available search, and account state.
  - Homepage **discover** view: "Trending this week" + "Popular right now".
  - Movie pages with **backdrop hero, TMDB score, genres, top cast, trailer link**
    and an "If you liked this" row.
  - My Movies with **stats** (watched / to-watch / average rating), **Seen vs
    Watchlist tabs**, and **sorting**.
  - Custom **404** and **error** pages, responsive layout, keyboard focus styles,
    and TMDB attribution in the footer (required by their API terms).
- [x] **Rebrand + IMDb-inspired pass:**
  - Site renamed **Movie Guardian**; bigger logo, nudged 20px left.
  - Navy palette: the nav bar is now the _darkest_ surface, the page a lighter
    dark blue (all driven by `--nav` / `--bg` in `globals.css`).
  - **Profile dropdown** in the header (avatar + nickname + caret) holding
    My Movies and Sign out. Sign-up asks for a **Nickname**, stored as
    Supabase _user metadata_ and shown in the nav instead of the email.
    (Accounts created before this fall back to the part of the email before `@`.)
  - **Trailer** on the movie page, side by side with the poster. It's a
    **click-to-play** still, not a live `<iframe>` — see the note below.
  - **Live search suggestions**: typing shows a dropdown of matching films
    (poster, title, year) with full arrow-key + Enter support. Powered by our
    own `/api/search` route, because the TMDB token is server-only.
  - **Every page starts at the top** — on link clicks _and_ on Back.
  - **Seen / watchlist markers on every poster:** a 4px underline along the
    bottom edge — **green `#1ea040` = seen**, **gold `#f5c518` = watchlist** —
    and seen films are **dimmed**, so unwatched ones stand out in the grid.
  - **Ratings are gold everywhere** (`#f5c518`): the score chip on every poster
    and the big star + number in the homepage banner.
  - **Trending showcase** at the top of the homepage: the week's top 5 films as
    a **full-bleed** backdrop banner with numbered posters you click to switch.
  - **Search lives in the header only.** A big search bar used to float over the
    banner, but the banner has `overflow: hidden` (it crops the backdrop), which
    clipped the suggestions dropdown and made the hidden options _unclickable_.
    Don't put dropdowns or popups inside `.stage`.
- [x] **Move to Mac + go live (Sept 2026):**
  - Development moved to an **Intel MacBook Pro** (the Windows PC still works — see below).
  - **Security upgrade:** Next.js 16.2 → **16.3.5** (fixed a critical advisory), React 19.3,
    `npm audit` → **0 vulnerabilities**.
  - Supabase **publishable key** (`sb_publishable_…`) replaces the old `anon` key.
  - **Deployed to Vercel** — every push to `main` goes live automatically.
- [x] **Login hardening (Sept 2026):**
  - **Email confirmation is ON.** Sign-up now shows an **"Enter your code"** screen: Supabase
    emails an **8-digit code** that you type (or paste) on the same page — no link, no second tab.
  - Signing in with an unconfirmed email sends a fresh code and opens that screen.
  - Signing up with an email that already has an account points you to Sign in.
  - Signed-in users who open `/login` are sent to the homepage.
  - Auth emails go through **custom SMTP (Gmail)** so the templates can be edited.
- [x] **Feedback loops (Sept 2026):** Vitest unit tests, TypeScript + ESLint + Prettier checks,
      and a **Husky pre-commit hook** that blocks commits when any of them fail.
- [ ] Phase 2 — Similar movies (embeddings). Phase 3 — Recommender + quiz. Phase 4 — Social.

---

## Tech stack

| Piece                                       | What it does                                                          |
| ------------------------------------------- | --------------------------------------------------------------------- |
| **Next.js 16.3 + TypeScript** (App Router)  | The website (pages, routing). Plain CSS, no Tailwind.                 |
| **Supabase**                                | Accounts (auth) + Postgres database. Auth emails sent via Gmail SMTP. |
| **TMDB**                                    | Source of movie data + posters (free tier).                           |
| **Vercel**                                  | Hosting. Deploys automatically from GitHub `main`.                    |
| **Vitest + React Testing Library**          | Unit tests (`__tests__/`).                                            |
| **ESLint · Prettier · Husky · lint-staged** | Code checks and formatting, enforced before every commit.             |

---

## Running it locally

### On the Mac (main machine)

**One-time setup:**

1. **Node.js 24 LTS** — installed with the official `.pkg` from <https://nodejs.org>.
   (Homebrew no longer supports Intel Macs, so don't use it here.) Check with:

   ```bash
   node --version
   ```

2. **Download the libraries** (also installs the Git pre-commit hook):

   ```bash
   npm install
   ```

3. **Create `.env.local`** with the 3 secrets — see [Environment variables](#environment-variables--envlocal).

**Every time:**

```bash
npm run dev
```

Leave that terminal open — it _is_ the server. Press **Ctrl+C** to stop it. Then open
**<http://localhost:3000>**.

**Via Claude Code:** the dev server can instead be started from the Browser panel using the
config **`movie-site`** in `.claude/launch.json` — that way Claude can read the server log.

Live edits auto-refresh the browser (Next.js "Fast Refresh"). **Note:** changes to
`.env.local` or `next.config.ts` require a dev-server **restart**.

### On the Windows PC

The project lives at `D:\Claude Projects\movie-site`, Node at `D:\NodeJS` (on the PATH).

- In **PowerShell use `npm.cmd run dev`**, not `npm run dev`: the execution policy is
  **Restricted** and blocks `npm.ps1`. Plain `npm` works in **Command Prompt (cmd.exe)**.
  To fix PowerShell permanently, run this **once, yourself** (it changes a Windows security
  setting): `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
- **PowerShell treats `[id]` as a wildcard.** Use `-LiteralPath` for anything inside `app/movie/[id]/`.
- ⚠️ **After pulling the Sept 2026 changes:** rename `NEXT_PUBLIC_SUPABASE_ANON_KEY` to
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in that PC's `.env.local` (with the `sb_publishable_…`
  value), then run `npm.cmd install`.

---

## Environment variables — `.env.local`

This file holds secrets and **is gitignored** (never committed / uploaded). It contains:

```
TMDB_ACCESS_TOKEN=...                     # server-only (no NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_SUPABASE_URL=...              # https://<project>.supabase.co — nothing after it
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...  # sb_publishable_… — safe for the browser
```

- The `NEXT_PUBLIC_` prefix tells Next.js a value is allowed in the browser. The TMDB token
  has no prefix, so it stays server-side only.
- `TMDB_ACCESS_TOKEN` is the long **API Read Access Token** (`eyJ…`), _not_ the short "API Key".
- **Never** use the Supabase **secret key** (`sb_secret_…`) in this app — it bypasses
  Row-Level Security, and nothing here needs it.
- Vercel has its **own copy** of these 3 values (Project → Settings → Environment Variables).
  `TMDB_ACCESS_TOKEN` is stored there as a **secret**.

---

## Checks and tests (feedback loops)

| Command              | What it does                                              |
| -------------------- | --------------------------------------------------------- |
| `npm run check`      | **Everything below in one go** — run it before committing |
| `npm run typecheck`  | TypeScript errors (`tsc --noEmit`)                        |
| `npm run lint`       | ESLint with the Next.js rules                             |
| `npm test`           | Vitest unit tests, once                                   |
| `npm run test:watch` | Tests that re-run on every save (press `q` to stop)       |
| `npm run format`     | Prettier formats every file (`format:check` only reports) |

**Pre-commit hook** (`.husky/pre-commit`): every `git commit` first runs lint-staged
(ESLint + Prettier on the staged files), then `typecheck`, then all tests. If anything fails,
**the commit is refused** — fix the cause, never bypass it with `--no-verify`.

**Tests** live in `__tests__/` (Vitest + React Testing Library, set up as in the Next.js
testing guide). Supabase and `next/navigation` are **mocked** — tests never touch the real
project, send emails, or create accounts.

---

## Deployment (Vercel)

- **Push to `main` → Vercel builds and publishes** <https://movie-guardian.vercel.app>
  (about 1–2 minutes). Watch it under the project's **Deployments** tab.
- Other branches get **preview** deployments (protected by Vercel login).
- The build needs the 3 environment variables above in Vercel. `NEXT_PUBLIC_` values are
  baked in **at build time** — after changing them, redeploy.
- Husky skips hook setup on Vercel (there's no `.git` folder there), so builds aren't affected.

---

## Database and auth (Supabase)

**Project:** `movie-site` (ref `ytzvbndveoorscrlchig`). The dashboard is signed into with
the GitHub account `tudorbaranai`.

### Auth settings

- **Email + password**, with **email confirmation ON** (Authentication → Sign In / Providers → Email).
- **Sign-up is confirmed with a code, not a link.** The "Confirm sign up" email template
  (Authentication → Emails → Templates) shows `{{ .Token }}` and has no link.
- **Email OTP length is 8** — it must match `CODE_LENGTH` in `app/login/VerifyCode.tsx`.
  Change both together.
- **Custom SMTP = Gmail** (`smtp.gmail.com`, port 465, an App Password). Supabase requires
  custom SMTP before email templates can be edited, and its built-in sender only delivers a
  few emails an hour to team members. Gmail is fine for a few friends; a service like Resend
  on our own domain would be better later.

### Table `user_movies`

One row per movie a user marks. Created by running this in the Supabase **SQL Editor**
(safe to re-run):

```sql
create table if not exists public.user_movies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  movie_id integer not null,
  title text not null,
  poster_path text,
  status text not null default 'seen' check (status in ('seen', 'watchlist')),
  rating integer check (rating between 1 and 10),
  created_at timestamptz not null default now(),
  unique (user_id, movie_id)
);

alter table public.user_movies enable row level security;

drop policy if exists "view own movies" on public.user_movies;
create policy "view own movies" on public.user_movies
  for select using (auth.uid() = user_id);

drop policy if exists "add own movies" on public.user_movies;
create policy "add own movies" on public.user_movies
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own movies" on public.user_movies;
create policy "update own movies" on public.user_movies
  for update using (auth.uid() = user_id);

drop policy if exists "delete own movies" on public.user_movies;
create policy "delete own movies" on public.user_movies
  for delete using (auth.uid() = user_id);
```

Row-Level Security means each logged-in user can only read/change **their own** rows,
even though every browser uses the same publishable key. (Verified: a signed-out request
for `user_movies` returns nothing.)

---

## Project structure (the files we made)

```
movie-guardian/
├─ app/
│  ├─ layout.tsx          # shared frame: header + footer on every page
│  ├─ api/
│  │  └─ search/route.ts  # /api/search?q=… — feeds the search suggestions
│  ├─ globals.css         # THE DESIGN SYSTEM — all colours/sizes as CSS variables
│  ├─ page.tsx            # homepage: search results, or Trending + Popular
│  ├─ page.module.css
│  ├─ not-found.tsx       # custom 404 page
│  ├─ error.tsx           # friendly "something went wrong" page
│  ├─ message.module.css  # shared styles for those two
│  ├─ login/
│  │  ├─ page.tsx         # sign-in / create-account card; hands over to the code screen
│  │  ├─ VerifyCode.tsx   # "Enter your code" screen (8 boxes, paste, resend cooldown)
│  │  └─ login.module.css
│  ├─ my-movies/
│  │  ├─ page.tsx         # stats, Seen/Watchlist tabs, sorting
│  │  └─ my-movies.module.css
│  └─ movie/[id]/
│     ├─ page.tsx         # detail page (one file serves every movie)
│     ├─ movie.module.css
│     ├─ MovieActions.tsx # ✓ Seen / + Watchlist / rating (saves to Supabase)
│     ├─ MovieActions.module.css
│     ├─ TrailerPlayer.tsx # click-to-play trailer (see the note below)
│     └─ TrailerPlayer.module.css
├─ components/            # reusable pieces shared across pages
│  ├─ Header.tsx          # sticky nav: logo, search, account
│  ├─ Footer.tsx          # TMDB attribution
│  ├─ MovieCard.tsx       # one poster card — used by EVERY grid
│  ├─ MovieGrid.tsx       # responsive grid + section heading
│  ├─ SearchBar.tsx       # search form + live suggestions dropdown
│  ├─ ScrollToTop.tsx     # every page starts at the top (renders nothing)
│  ├─ TrendingSpotlight.tsx # homepage showcase: top 5 trending, clickable
│  ├─ UserMoviesProvider.tsx # loads YOUR seen/watchlist marks once, shares them
│  └─ GridSkeleton.tsx    # grey placeholder cards (available, not currently used)
├─ lib/
│  ├─ tmdb.ts             # TMDB (server-side): search, trending, popular, details
│  └─ supabase.ts         # browser Supabase client (auth + database)
├─ __tests__/login/       # unit tests for the login page and the code screen
├─ .husky/pre-commit      # checks that run before every commit
├─ .claude/launch.json    # lets Claude Code start the dev server ("movie-site")
├─ vitest.config.mts      # test settings (+ vitest.setup.ts)
├─ .lintstagedrc.json     # what runs on staged files (ESLint, Prettier)
├─ .prettierrc.json       # Prettier (default settings)
├─ next.config.ts         # allows poster images from image.tmdb.org
├─ AGENTS.md / CLAUDE.md  # instructions for AI coding agents
├─ .env.local             # secrets (gitignored)
├─ PLAN.md                # full roadmap & design decisions
└─ README.md              # this file
```

### How the poster markers know what you've seen

`components/UserMoviesProvider.tsx` wraps the whole app in `layout.tsx`. It asks
Supabase **once** — "give me every movie I've marked" — and shares the answer
with every `MovieCard` through React **context**, so a grid of 24 posters costs
one database query instead of 24. `MovieActions` (on a movie page) calls the
provider's `refresh()` after you mark or unmark something, so the underlines on
other cards update straight away instead of going stale until a reload.

Because it needs to know who's signed in, `MovieCard` is a **client** component.

### A note on the sign-up code (why not a link)

Email apps open links in a **new tab**, so a "click to confirm" link left the old tab
showing the form while a second tab was signed in. With a **code**, you type it on the
same page and never leave it — and it also works when the email is read on another device.
The code screen verifies with `supabase.auth.verifyOtp({ email, token, type: "email" })`
and resends with `supabase.auth.resend({ type: "signup", email })` (at most once a minute).

### A note on the trailer player

The trailer is **click-to-play** (`app/movie/[id]/TrailerPlayer.tsx`): the film's
still is shown with a ▶ button, and YouTube's `<iframe>` is only created once you
press it. An always-loaded iframe **broke the back button** — interacting with
YouTube's player pushes entries into _your_ browser history, so "back" would stay
put or jump to the wrong movie. It's also much faster, since most visits never
press play. Don't replace it with a plain `<iframe>`.

Two details that are easy to lose: the iframe needs `fullscreen` in its `allow`
list (without it YouTube hides the fullscreen button and the bottom-right
controls shift), and its `border-radius` is kept small — a large radius clips the
corners of YouTube's control bar.

### A note on `loading.tsx`

Next.js can show a skeleton screen while a page loads via a `loading.tsx` file.
We tried it and **removed it**: it puts the page behind a React "streaming"
boundary, and we could not confirm the skeleton reliably gets swapped out for the
real content in our test browser — a stuck skeleton is worse than none. The pages
are fast anyway (TMDB replies are cached for an hour, ~50–300 ms). `GridSkeleton`
is still in `components/` if we want to revisit this later with a real browser.

---

## Resume point — START HERE in a new session

> To pick up in a fresh chat, say: **"Read the README in movie-guardian and continue."**

### Where things stand (2026-09-15)

**Phases 0 and 1 are complete, verified, and live** at <https://movie-guardian.vercel.app>:
search, movie pages, sign-up confirmed with an 8-digit email code, sign in, mark seen /
watchlist, 1–10 ratings, My Movies. `npm run check` and the production build pass,
`npm audit` reports 0 vulnerabilities, and a QA pass (desktop + phone, signed out and signed in)
found only the items in the fix batch below.

### First steps in a new session

1. **Start the dev server** — Browser panel config `movie-site`, or `npm run dev` on the Mac.
2. Open <http://localhost:3000> and confirm the homepage shows Trending + Popular.
3. Run `npm run check` to confirm everything is green before changing anything.

### Next steps (in order)

1. **Live sign-up test** on <https://movie-guardian.vercel.app> with a new email alias.
2. **Supabase URL configuration** (Authentication → URL Configuration):
   Site URL `https://movie-guardian.vercel.app`; Redirect URLs `http://localhost:3000/**`,
   `https://movie-guardian.vercel.app/**`, `https://movie-guardian-*-tudorbaranai-5534s-projects.vercel.app/**`.
   Then delete test accounts (Authentication → Users).
3. **Fix batch** from the QA/code review (one commit):
   - the search box on the `/?q=` results page opens its suggestions dropdown by itself on load
   - `/movie/[id]` must reject non-numeric ids (a crafted id makes the server call other TMDB endpoints with our token)
   - load images straight from TMDB (every poster currently uses Vercel image optimization — free-plan limit)
   - `app/error.tsx`: use `retry` instead of `reset` so "Try again" really reloads data (Next 16.3 docs)
   - show real errors instead of "No matches" / an empty My Movies when TMDB or Supabase fails
   - add `data-scroll-behavior="smooth"` to `<html>` (Next 16 dev notice)
4. **Forgot password** with an emailed code (`verifyOtp` type `recovery`), and switch the
   Supabase "Reset password" template to `{{ .Token }}`.
5. **Windows PC:** rename the Supabase key in its `.env.local` (see above), then pull + install.
6. **Custom domain:** the user already owns one — connect it in Vercel, then move auth email
   from Gmail to a transactional service (e.g. Resend) on that domain.
7. **Phase 2 — "Similar movies"** (the first machine-learning step):
   1. A **Python** script (offline) that pulls a catalogue of movies from TMDB into Supabase.
   2. A **local embedding model** (e.g. `sentence-transformers`) turns each film's text
      (overview + genres + cast) into a vector. No paid APIs.
   3. Enable **`pgvector`** in Supabase and store the vectors.
   4. A **"Similar movies"** row on the movie page using nearest-neighbour search — compared
      against TMDB's own "If you liked this" row.
8. _Later:_ TypeScript 7 and ESLint 10 major upgrades (skipped on purpose for now).

### Gotchas that have already bitten us

- **This Next.js (16.3) differs from older versions** — read the guide in
  `node_modules/next/dist/docs/` before writing code (see `AGENTS.md`).
- **Changing `.env.local` or `next.config.ts` requires a dev-server restart.**
- **`NEXT_PUBLIC_SUPABASE_URL` must end at `.supabase.co`** — adding `/rest/v1/` breaks every request.
- **Email OTP length (Supabase) and `CODE_LENGTH` (code) must match** — currently 8.
- **Supabase email templates can't be edited without custom SMTP.**
- **Several people's accounts are signed in on this Mac.** The regular Chrome is signed in to a
  _different_ Supabase account — use Claude's built-in Browser panel for this project's dashboard.
- **Mac: `npm install -g` fails with `EACCES`** (Node's system folder belongs to root) — use
  `sudo` for global installs, or skip them; the project itself never needs global packages.
- **Don't add `loading.tsx`** — see the note above.
- **Never bypass the pre-commit hook** (`--no-verify`) — fix what it reports.
- The user is **learning web development** — explain concepts in plain language, one small
  verified step at a time, and ask before each change. The user types passwords and
  verification codes themselves.
