# 🎬 Movie Guardian

A personal movie **tracking + recommendation** site, built for me and a few friends —
and as a way to learn modern web development. Everything runs on **free** tools.

**Live:** <https://movie-guardian.vercel.app> · **Code:** <https://github.com/tudorbaranai/movie-guardian>

Three features:

1. **Recommendations** (the main goal, later phase): a self-hosted, content-based model
   suggests films for you based on your taste and history. No paid AI APIs.
2. **Tracking** (built): search movies, mark them seen, rate them, keep watchlists.
3. **Movie assistant** (built): a ✨ chat in the nav bar that answers movie questions
   knowing what _you_ have watched, rated and saved.

> Full roadmap and design decisions live in [PLAN.md](./PLAN.md).
> _Last updated: 2026-09-23._

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
  - **Create account asks for the password twice** ("Confirm password"): a red hint appears as
    soon as the second one stops matching, and the account isn't created until they match.
  - **Forgot password?** on the Sign in tab: enter your email → type the 8-digit code from
    the "Reset password" email → choose a new password (typed twice) → signed in. The reply
    after "Send code" never reveals whether an account exists for that email.
  - **Change password** on the new **Account** page (avatar menu → Account): current
    password + new password typed twice, with an option to sign out other devices.
  - Auth emails go through **custom SMTP (Gmail)** so the templates can be edited.
- [x] **QA fixes (Sept 2026):** the results-page search box no longer pops open by itself;
      crafted `/movie/…` addresses are refused (404); images load straight from TMDB instead of
      Vercel's optimizer; "Try again" really reloads; search and My Movies show real errors.
- [x] **Feedback loops (Sept 2026):** Vitest unit tests, TypeScript + ESLint + Prettier checks,
      and a **Husky pre-commit hook** that blocks commits when any of them fail.
- [x] **Movie assistant — an AI chat in the nav bar (Sept 2026):**
  - A ✨ **AI** sticker sits in the header. Click it and a chat panel drops down
    (a full-width sheet on a phone) with a greeting and three suggested questions.
  - The assistant is a **movie recommender**: before every conversation the server
    reads _your_ `user_movies` rows and writes them into the model's instructions, so
    it already knows what you loved, what you disliked and what's on your watchlist.
  - Answers **stream in word by word** instead of appearing after a long pause.
  - Runs on **Vercel AI Gateway** (one key, one spend cap, many providers) using
    a **free** model — see [The movie assistant](#the-movie-assistant-ai-chat) below.
- [x] **The assistant can look films up on TMDB (Sept 2026):**
  - It has two **tools**, `search_movies` and `get_movie`. When it wants a fact it
    stops and asks _us_ to fetch it, so release years, runtimes, directors and cast
    come from TMDB instead of from what the model happens to remember.
  - Every film it names is a **link to our own `/movie/[id]` page**.
  - **One request to the model per question**, which is what makes it usable on a
    free account limited to about five a minute.
- [x] **Making the assistant honest (Sept 2026)** — after it was caught lying:
  - An **audit** put ten trap questions to the live model and checked every answer
    against TMDB. It denied that Hugh Laurie is in 101 Dalmatians (1996) — he plays
    Jasper — invented a Tron: Legacy credit for Ewan McGregor, and named a
    three-year-old film as Nolan's most recent. See
    [Keeping it honest](#keeping-it-honest-the-audit-and-what-came-of-it).
  - The **system prompt was rewritten**: it now knows today's date, has one exact
    phrase to use when unsure, is told not to embellish or to agree just to be
    agreeable, and keeps **bold for film titles only** (TV shows go in plain text).
  - The **link contract was tightened** so a bolded label can never become a film
    link again — `**Runtime:**` used to link to a 2019 film called _Runtime_.
  - We now **look films up before the model answers**: the film page you opened the
    chat from, and every film already linked in the conversation. Still exactly one
    request to the model.
  - `npm run probe` re-runs the ten trap questions against the live model whenever
    you want a reality check.
- [ ] Phase 2 — Similar movies (embeddings). Phase 3 — Recommender + quiz. Phase 4 — Social.

---

## Tech stack

| Piece                                       | What it does                                                          |
| ------------------------------------------- | --------------------------------------------------------------------- |
| **Next.js 16.3 + TypeScript** (App Router)  | The website (pages, routing). Plain CSS, no Tailwind.                 |
| **Supabase**                                | Accounts (auth) + Postgres database. Auth emails sent via Gmail SMTP. |
| **TMDB**                                    | Source of movie data + posters (free tier).                           |
| **Vercel**                                  | Hosting. Deploys automatically from GitHub `main`.                    |
| **Vercel AI Gateway** + `openai` SDK        | One door to every AI model. Powers the ✨ movie assistant.            |
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
AI_GATEWAY_API_KEY=...                    # server-only — powers the ✨ movie assistant
AI_MODEL=...                              # optional; default is a free model
AI_FALLBACK_MODELS=...                    # optional; used when a model is DOWN
AI_TOOL_ROUNDS=0                          # optional; TMDB tool calling, off by default
AI_REASONING_EFFORT=low                   # optional; ONLY for effort-capable models
```

- The `NEXT_PUBLIC_` prefix tells Next.js a value is allowed in the browser. The TMDB token
  has no prefix, so it stays server-side only.
- `TMDB_ACCESS_TOKEN` is the long **API Read Access Token** (`eyJ…`), _not_ the short "API Key".
- **Never** use the Supabase **secret key** (`sb_secret_…`) in this app — it bypasses
  Row-Level Security, and nothing here needs it.
- `AI_GATEWAY_API_KEY` comes from **vercel.com → AI Gateway → API Keys → Create key**.
  Without it the site works exactly as before and the ✨ panel says the assistant
  isn't switched on — nothing else breaks.
- Vercel has its **own copy** of these values (Project → Settings → Environment Variables).
  `TMDB_ACCESS_TOKEN` and `AI_GATEWAY_API_KEY` are stored there as **secrets**.

---

## Checks and tests (feedback loops)

| Command              | What it does                                              |
| -------------------- | --------------------------------------------------------- |
| `npm run check`      | **Everything below in one go** — run it before committing |
| `npm run typecheck`  | TypeScript errors (`tsc --noEmit`)                        |
| `npm run lint`       | ESLint with the Next.js rules                             |
| `npm test`           | Vitest unit tests, once                                   |
| `npm run test:watch` | Tests that re-run on every save (press `q` to stop)       |
| `npm run probe`      | **By hand only** — asks the live AI ten trap questions    |
| `npm run format`     | Prettier formats every file (`format:check` only reports) |

**Pre-commit hook** (`.husky/pre-commit`): every `git commit` first runs lint-staged
(ESLint + Prettier on the staged files), then `typecheck`, then all tests. If anything fails,
**the commit is refused** — fix the cause, never bypass it with `--no-verify`.

**Tests** live in `__tests__/` (Vitest + React Testing Library, set up as in the Next.js
testing guide), in the **same folders as the file they test, minus `app/`** — e.g.
`components/SearchBar.tsx` → `__tests__/components/SearchBar.test.tsx`. Supabase, `fetch`
(TMDB), `next/navigation`, `next/image` and `next/link` are **mocked** — tests never touch the
real project, send emails, or create accounts. Tests of server code start with
`// @vitest-environment node`.

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
- **Password reset also uses a code.** The "Reset password" template shows `{{ .Token }}` and
  has no link. "Require current password when updating" must stay **off**, or people who
  forgot their password couldn't set a new one. (The Account page's "Change password"
  checks the current password itself, by signing in with it before saving.)
- _Optional:_ Emails → Templates → Security → **"Password changed"** sends a heads-up email
  whenever a password changes.
- **Email OTP length is 8** (for both emails) — it must match `CODE_LENGTH` in
  `app/login/VerifyCode.tsx`. Change both together.
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
│  │  ├─ search/route.ts  # /api/search?q=… — feeds the search suggestions
│  │  └─ chat/route.ts    # /api/chat — the ✨ movie assistant (streams its answer)
│  ├─ globals.css         # THE DESIGN SYSTEM — all colours/sizes as CSS variables
│  ├─ page.tsx            # homepage: search results, or Trending + Popular
│  ├─ page.module.css
│  ├─ not-found.tsx       # custom 404 page
│  ├─ error.tsx           # friendly "something went wrong" page
│  ├─ message.module.css  # shared styles for those two
│  ├─ login/
│  │  ├─ page.tsx         # sign in / create account; moves between the screens below
│  │  ├─ VerifyCode.tsx   # "Enter your code" (8 boxes, paste, resend) — sign-up AND reset
│  │  ├─ ForgotPassword.tsx # "Reset your password": asks for the email
│  │  ├─ NewPassword.tsx  # "Choose a new password" (after the reset code)
│  │  ├─ ConfirmPasswordField.tsx # shared "Confirm password" box with live hint
│  │  └─ login.module.css
│  ├─ account/
│  │  ├─ page.tsx         # /account — server component (sets the tab title)
│  │  ├─ AccountSettings.tsx # signed-in check, who you are
│  │  ├─ ChangePasswordForm.tsx # current + new password, sign out other devices
│  │  └─ account.module.css
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
│  ├─ AiChat.tsx         # the ✨ sticker in the nav + the chat panel it opens
│  ├─ UserMoviesProvider.tsx # loads YOUR seen/watchlist marks once, shares them
│  └─ GridSkeleton.tsx    # grey placeholder cards (available, not currently used)
├─ lib/
│  ├─ tmdb.ts             # TMDB (server-side): search, trending, popular, details
│  ├─ supabase.ts         # browser Supabase client (auth + database)
│  ├─ supabase-server.ts  # SERVER Supabase client, acting as one signed-in person
│  ├─ ai.ts               # the model client + which model/fallbacks to use
│  ├─ movie-tools.ts      # the 2 TMDB lookups the assistant may ask us to run
│  ├─ text-tool-calls.ts  # copes with models that write tool calls as text
│  ├─ movie-links.ts      # **bold titles** → links, resolved against TMDB
│  ├─ chat-context.ts     # facts we look up BEFORE the model is asked
│  └─ watch-history.ts    # your films → the paragraph the assistant reads
├─ __tests__/             # unit tests, same folders as the code (login/, lib/, api/…)
├─ scripts/
│  └─ probe-assistant.mjs # `npm run probe` — the ten trap questions, live
├─ .husky/pre-commit      # checks that run before every commit
├─ .claude/launch.json    # lets Claude Code start the dev server ("movie-site")
├─ vitest.config.mts      # test settings (+ vitest.setup.ts)
├─ .lintstagedrc.json     # what runs on staged files (ESLint, Prettier)
├─ .prettierrc.json       # Prettier (default settings)
├─ next.config.ts         # images served straight from image.tmdb.org (no Vercel optimizer)
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

### The movie assistant (AI chat)

Click the **✨ AI** sticker in the header and a chat panel opens. It only answers
movie questions, and it answers them knowing what _you_ have watched. It runs on a
**free** model — no credits, no card, nothing to top up.

#### How one question travels

```
   browser                        /api/chat (our server)            Vercel AI Gateway
   -------                        ---------------------             -----------------
   the chat so far     ──────▶    1. who are you?  (Supabase)
   + your access token            2. read YOUR user_movies rows
                                  3. turn them into a paragraph
                                  4. ask the model, streaming ─────▶  a free model
   words appear        ◀──────    5. rewrite **titles** into links  ◀──
                                     and forward each word as it lands
```

**Exactly one request to the model per question.** That is the single most
important number in this feature — see the free-tier table below.

#### The five ideas behind it

1. **The model has no memory of our site.** It only ever sees the text we hand it.
   So `lib/watch-history.ts` writes a short summary — "Loved: Arrival 9/10, Heat
   9/10 · Rated lowest: Cats 2/10 · Watchlist: Dune" — and `buildSystemPrompt()`
   staples it to the front of the conversation along with the house rules. That
   summary is the whole reason the answers feel personal.

2. **The server proves who you are; the browser is not trusted.** The page sends
   its Supabase **access token** in the `Authorization` header, and
   `lib/supabase-server.ts` builds a server-side client carrying that token. The
   _database_ then decides what may be read: the same Row-Level Security rules
   apply, so the route can only ever see your rows. Letting the browser post its
   own film list would have been simpler and forgeable.

3. **The answer streams.** The route returns a `ReadableStream` of plain text, and
   `AiChat.tsx` reads it with `response.body.getReader()`, appending each chunk to
   the bubble. That's why the words type themselves out. (`TextDecoder` is used
   with `{ stream: true }` because a chunk can split an emoji in half.)

4. **We do the fact-checking, not the model.** The model is asked for
   `**Arrival (2016)**` — something it can write in one breath — and
   `lib/movie-links.ts` swaps that for `[Arrival (2016)](/movie/329865)` as the
   text streams past, by searching TMDB itself. Free, cached for an hour, and no
   extra request to the model. Two things fall out of it:
   - **Wrong years get fixed.** "Heat (1996)" goes out as Heat (1995), linked.
   - **Invented films stay bold.** No TMDB match means no link, so an unlinked
     title is a quiet signal the model may have made it up.

5. **Costs and abuse are capped.** Sign-in is required, there's a
   20-messages-an-hour brake per user in the route, and the model itself is free.
   An open AI endpoint on a public site is a bill waiting to happen.

#### What the free tier actually gives you (measured 2026-09-18)

|                                |                                                    |
| ------------------------------ | -------------------------------------------------- |
| Models a free account may call | **7** of ~376 — the rest answer `403`              |
| Requests allowed back to back  | **5**, then `429`                                  |
| Time to recover                | ~30s after a light burst, longer after a heavy one |
| Is the limit per model?        | **No — it is account-wide**                        |

Those numbers decided the whole design.

**Why tool calling is off.** Letting the model look films up cost **three**
requests per question (it once fired eight searches in one turn), so a single
question ate the minute's allowance and the next two were refused. One request per
question is the difference between a chat that works and one that apologises.

**Why you can't buy headroom by spreading the load.** The obvious trick is to
rotate across all seven free models, since each looks like its own bucket. It
isn't. Exhaust one and _every_ free model answers `429` — tested directly with
`ling-3.0-flash-fin-free`, `ling-3.0-flash-sante-free`, `laguna-s-2.1-free` and
`ling-3.0-flash-fin`, all refused. **There is no way to raise this ceiling without
paying.** So `AI_FALLBACK_MODELS` earns its place for _outages_ (Laguna answered
`503` repeatedly during setup), not for capacity.

**What we do instead.** A `429` no longer fails immediately: the route waits ~9s
and retries, then ~21s and retries again (`RATE_LIMIT_WAITS_MS` in the route),
which usually outlasts the limit. The reader just sees the typing dots for longer.
Only if all three attempts are refused does the chat say so — and then it says how
long to wait.

#### Choosing a model

The catalogue, prices and which models your account may use are in the Vercel
dashboard under **AI Gateway → Models**. A model needs the **free** tag to be
usable without credits, and the **tool-use** tag only if you turn tool calling
back on.

Set it in `.env.local` and **restart the dev server** (Next.js reads `.env.local`
at startup). Leave everything commented out to use the defaults in `lib/ai.ts`:

| Variable              | Default                                                    | Notes                                       |
| --------------------- | ---------------------------------------------------------- | ------------------------------------------- |
| `AI_MODEL`            | `inclusionai/ling-3.0-flash-vl-free`                       | free, no credits needed                     |
| `AI_FALLBACK_MODELS`  | `inclusionai/ling-3.0-flash-vl,poolside/laguna-s-2.1-free` | tried in order when one is **down**         |
| `AI_TOOL_ROUNDS`      | `0`                                                        | TMDB tool calling; needs credits to be sane |
| `AI_REASONING_EFFORT` | unset                                                      | see below                                   |

##### Why `AI_REASONING_EFFORT` is off by default

"Think harder" is not one setting. The catalogue reports `reasoning_options` as
`{type: "effort"}` for GPT 5.6 Luna, `{type: "toggle"}` for Laguna, and _nothing_
for Ling. Sending `reasoning_effort` to a model that doesn't take one is a 400 and
a dead answer — so we send it only when you explicitly set it.

##### When the model writes its tool call instead of sending it

Only relevant with `AI_TOOL_ROUNDS` turned up. The API has a proper field for
"call this tool", and a well-behaved model uses it. Some models — including the
free ones here, _intermittently_ — instead type the call into their answer:

```
<tool_call>search_movies
<arg_key>query</arg_key>
<arg_value>Spider-Man No Way Home</arg_value>
</tool_call>
```

That fails twice over: the lookup never runs, and the markup lands in the chat
bubble. `lib/text-tool-calls.ts` handles both — a filter that never lets the markup
through (holding back even a partial `<tool_` until it knows what follows), and a
parser that rebuilds the calls. The same model gets it right most of the time, so
it's a shim rather than a reason to change models.

#### If you ever do decide to pay

Deliberately deferred on 2026-09-18 — the free setup works. The options, in order
of how much they cost:

1. **Vercel AI Gateway credits.** Top up under **AI Gateway → the credits button,
   top right** (that dialog holds the card and auto top-up too), set a budget under
   **AI Gateway → Budgets → API Keys**, then uncomment `AI_MODEL=openai/gpt-5.6-luna`
   and `AI_REASONING_EFFORT=low`, and turn `AI_TOOL_ROUNDS` up to 2. About a third
   of a cent per question. Note that buying credits **ends the free tier
   permanently**, and a budget is a **soft cap** that can overshoot slightly.
2. **Straight to a provider**, skipping Vercel: point `lib/ai.ts` at
   `api.openai.com` or swap in the Anthropic SDK. Needs an API key from
   platform.openai.com or console.anthropic.com **with credit on it** — a ChatGPT
   Plus or Claude Pro subscription is _not_ an API key. You'd lose the budgets
   screen, the fallbacks and the unified logs.
3. **Vercel's BYOK** is the worst of both: their docs say _"To use BYOK, your team
   needs purchased AI Gateway credits"_, so you'd pay Vercel **and** the provider.

#### Keeping it honest (the audit, and what came of it)

On 22 Sep 2026 the assistant was caught telling a flat lie, so the whole feature
was put through ten deliberately awkward questions — the live model, the real
system prompt — and **every factual claim was checked against TMDB**. Three of
ten answers were wrong, three were right but decorated with invention, and four
held up. The interesting part is that these were **three separate faults**, and
only one of them was the model's:

1. **It had no facts.** It answers film questions from memory, and nothing on the
   request path ever checks one. No wording in a prompt fixes that.
2. **Our link contract was overloaded.** `**bold**` was asked to mean "this is a
   film" while also being the obvious way to write a heading or a TV title, and
   we searched TMDB for every bold span we saw. Real answers shipped links from
   `**Runtime:**` to _Runtime (2019)_ and from `**House (1977)**` to a Japanese
   horror film.
3. **Some rules were unenforceable.** "Never invent a cast member" is a wish, not
   a constraint — the model cannot tell invention from recall. "Say so if unsure"
   is too vague to obey or to test.

What changed, in the order it matters:

- **`lib/movie-links.ts` got suspicious.** A bold span that ends in a colon, or
  runs longer than a title plausibly can, is never looked up at all. A year is
  read whether it sits inside the bold or just outside it, and it is printed
  once, not twice. A _range_ of years (`(2004–2012)`) is read as a TV series and
  never linked. And if the model gives a year that no matching film is within a
  year of, we link nothing rather than link the wrong film.
- **`buildSystemPrompt` was restructured** around the advice every prompting
  guide agrees on: say what it is, say what it _cannot_ do, give it one
  unambiguous fallback for "I don't know", and keep the output contract small
  and free of contradictions. It is now told today's date (it has no clock, which
  is why "most recent" answers were three years stale), to use the exact words
  _"I'm not sure"_, to add nothing for colour, and that **bold is only ever a
  film title**.
- **`lib/chat-context.ts` is new.** Before the model is called, we fetch the
  facts for the film page the chat was opened from and for every film already
  linked earlier in the conversation — cast _with character names_, year,
  runtime, director — and put them in the prompt marked as checked. Those ids
  cost nothing to find: our own link enricher already resolved them against
  TMDB. **It is still one request to the model per question.**

##### What this deliberately does not do yet

It does not read the question and go looking for whatever you asked about. That
needs entity extraction, and it is a job of its own — the experiments are worth
knowing before it is built:

- You **cannot** just send the question to TMDB. `/search/multi` with the whole
  sentence returns nothing; it is a title index, not a search engine.
- TMDB has **no typo tolerance**: "ewan megregor" and "hugh lorie" return
  nothing. Single words often rescue it ("ewan" → Ewan McGregor), but not always.
- It knows **localised titles**: "101 dalmatieni" resolves with `language=ro-RO`.
- Resolving **one** entity is often enough. We cannot resolve "doctor house", but
  resolving "101 dalmatieni" gives a cast list with _Hugh Laurie as Jasper_ in
  it, and the model cannot then deny it.

##### What no amount of this will fix

A true sentence with an invented detail stapled on. Asked about Bill Murray in
_Zombieland_ it got the fact right and then placed the scene in Las Vegas; it is
at his home in Beverly Hills. TMDB has no field for that. The prompt now tells it
to stop embellishing, which helps and does not cure.

#### Upgrading the assistant

1. **Richer history.** We send bare titles. Storing genre and year on `user_movies`
   turns "Arrival 9/10" into "Arrival (2016, sci-fi/drama) 9/10" — a stronger hint
   for almost no extra tokens, and no extra requests.
2. **Turn tool calling back on** (`AI_TOOL_ROUNDS=2`) once there are credits, so it
   can state runtimes and directors from TMDB rather than memory.
3. **A "where can I watch it?" tool** via TMDB's `/watch/providers` (needs a region
   constant), and a **browse** tool via `/discover` for "a funny film under 100
   minutes".
4. **Actions, not just talk.** Let it add a film to your watchlist when you say
   "save that one" — one more tool, writing through the same access token.
5. **Feed it the Phase 2 embeddings.** Once "similar movies" exists, we can compute
   the nearest films ourselves and put _those_ in the prompt, so the assistant
   explains a recommendation our own maths made.
6. **Remember the conversation.** Chats vanish on reload today. A `chat_messages`
   table behind Row-Level Security would keep them.

#### A note on the AI panel's styling

The panel lives inside the header, next to the account menu, and uses the same
click-outside / Escape behaviour so the two feel like one thing. Below 520px it
stops being a dropdown and becomes a `position: fixed` sheet pinned to both edges
— a 380px box would hang off the side of a phone.

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

### Where things stand (2026-09-23)

**Phases 0 and 1 are complete, verified, and live** at <https://movie-guardian.vercel.app>:
search, movie pages, sign-up confirmed with an 8-digit email code, sign in, forgot password
(with a code), change password (Account page), mark seen / watchlist, 1–10 ratings, My Movies.
The **✨ movie assistant** needs `AI_GATEWAY_API_KEY` (local **and** on Vercel) before it
can answer — see [The movie assistant](#the-movie-assistant-ai-chat). It was **audited and
hardened on 2026-09-23** after being caught inventing facts; those changes are unit-tested
but have **not yet been judged by a person** in the real chat window, which is the next
thing to do.
`npm run check` (180 tests) and
the production build pass, `npm audit` reports 0 vulnerabilities, and the findings of the QA
pass (desktop + phone, signed out and signed in) are fixed and live.

### First steps in a new session

1. **Start the dev server** — Browser panel config `movie-site`, or `npm run dev` on the Mac.
2. Open <http://localhost:3000> and confirm the homepage shows Trending + Popular.
3. Run `npm run check` to confirm everything is green before changing anything.

### Next steps (in order)

Done on 2026-09-15: live sign-up test, QA fix batch, Confirm password, Forgot password
(tested for real by the user), Supabase URL configuration (Site URL + 3 redirect URLs),
test-account cleanup, and **Change password** (Account page). The Windows PC update was
dropped — that PC isn't used for now. The full plan behind the steps below is in PLAN.md.

0. **Test the hardened assistant for real** (next thing to do). The changes of
   2026-09-23 — new system prompt, stricter links, facts fetched before the model
   answers — are covered by unit tests but have not yet been judged by a person in
   the real chat window. Run `npm run probe` for the ten trap questions against the
   live model, then use the chat normally and see whether the answers got better.

1. ~~Buy AI Gateway credits.~~ **Decided 2026-09-18: stay free.** The assistant was
   tuned until it answers properly without paying, and it does — verified live: one
   request per question, ten recommendations with ten correct links, off-topic
   questions refused, invented films refused. The only cost is a ceiling of about
   five questions a minute, which the route now waits out rather than erroring on.
   If that ever becomes annoying, see
   [If you ever do decide to pay](#if-you-ever-do-decide-to-pay).

2. ~~Try Change password for real.~~ **Done.**
3. **Swap in a stronger model — bring your own key + Claude Opus** (planned next).
   The free model is the floor under answer quality: it is small, and grounding
   raises its accuracy without raising its intelligence. Note that Vercel's BYOK
   needs purchased AI Gateway credits, so "bring your own key" there means paying
   twice; going straight to the provider avoids that but loses the gateway's
   budgets, fallbacks and unified logs. Either way the code change is small — the
   model is one constant in `lib/ai.ts` — and `AI_TOOL_ROUNDS` can go back up once
   requests are no longer rationed.
4. **Phase 2 — "Similar movies"** (the first machine-learning step, free):
   1. Enable **`pgvector`** in Supabase and add a `movies` table with a vector column.
   2. A script pulls ~5–10k movies from TMDB (title, plot, genres, top cast, director).
   3. A free **pre-trained** embedding model turns each film into 384 numbers. Decide where it
      runs: **Node** (Transformers.js — suggested, same language as the site), **Python**
      (sentence-transformers) or Supabase's built-in **`gte-small`** (Edge Function).
   4. A database function returns the nearest movies; a **"Similar movies"** row on the movie
      page, next to TMDB's "If you liked this" row for comparison.
5. **Taste vector + "Recommended for you"** — average of the vectors of films you rated
   highly; nearest unseen films.
6. **Learning loop without AI** — one short, skippable question after rating (question bank),
   answers become preference scores; a **"Your taste"** page to see/edit/delete them.
7. **AI-written questions + answer analysis** via an AI gateway (small cost, spending cap, key
   only on the server).
8. **"Because…" explanations** written once by an AI and saved.
9. _Later, only when needed:_
   - **Custom domain + a transactional email service** (e.g. Resend) — worth it once the site
     is shared beyond a few friends, codes start landing in spam, or Gmail's daily sending
     limit gets close. Not needed during early development.
   - TypeScript 7 and ESLint 10 major upgrades (skipped on purpose for now).

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
