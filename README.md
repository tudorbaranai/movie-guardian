# 🎬 Movie Guardian

A personal movie **tracking + recommendation** site, built for me and a few friends —
and as a way to learn modern web development. Everything runs on **free** tools.

Two features:
1. **Recommendations** (the main goal, later phase): a self-hosted, content-based model
   suggests films for you based on your taste and history. No paid AI APIs.
2. **Tracking** (being built now): search movies, mark them seen, rate them, keep watchlists.

> Full roadmap and design decisions live in [PLAN.md](./PLAN.md).

---

## Progress so far

- [x] **Phase 0 — Foundation:** Next.js project created, runs locally, custom homepage.
- [~] **Phase 1 — Movie tracker (in progress):**
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
  - Navy palette: the nav bar is now the *darkest* surface, the page a lighter
    dark blue (all driven by `--nav` / `--bg` in `globals.css`).
  - **Profile dropdown** in the header (avatar + nickname + caret) holding
    My Movies and Sign out. Sign-up now asks for a **Nickname**, stored as
    Supabase *user metadata* and shown in the nav instead of the email.
    (Accounts created before this fall back to the part of the email before `@`.)
  - **Trailer** on the movie page, side by side with the poster. It's a
    **click-to-play** still, not a live `<iframe>` — see the note below.
  - **Live search suggestions**: typing shows a dropdown of matching films
    (poster, title, year) with full arrow-key + Enter support. Powered by our
    own `/api/search` route, because the TMDB token is server-only.
  - **Every page starts at the top** — on link clicks *and* on Back.
  - **Seen / watchlist markers on every poster:** a 4px underline along the
    bottom edge — **green `#1ea040` = seen**, **gold `#f5c518` = watchlist** —
    and seen films are **dimmed**, so unwatched ones stand out in the grid.
  - **Ratings are gold everywhere** (`#f5c518`): the score chip on every poster
    and the big star + number in the homepage banner. The chip used to change
    colour with the number (green/gold/red); now it's always gold.
  - **Trending showcase** at the top of the homepage: the week's top 5 films as
    a **full-bleed** backdrop banner (edge to edge of the window) with numbered
    posters you click to switch and a large star rating. It replaced the old
    text banner and tagline entirely.
  - **Search lives in the header only.** A big search bar used to float over the
    banner, but the banner has `overflow: hidden` (it crops the backdrop), which
    clipped the suggestions dropdown and made the hidden options *unclickable*.
    Don't put dropdowns or popups inside `.stage`.
- [ ] Phase 2 — Similar movies (embeddings). Phase 3 — Recommender + quiz. Phase 4 — Social + deploy.

**Phase 1 is complete** — the site is a working, styled, multi-user movie tracker.

---

## Tech stack

| Piece | What it does |
|-------|--------------|
| **Next.js 16 + TypeScript** (App Router) | The website (pages, routing). Plain CSS, no Tailwind. |
| **Supabase** | Accounts (auth) + Postgres database. |
| **TMDB** | Source of movie data + posters (free tier). |
| **Vercel** *(later)* | Where we'll host it, on the user's domain. |

---

## Running it locally

Node.js lives at `D:\NodeJS` and **is on the system PATH**, so plain `node` and
`npm` work in any fresh terminal. (Verified 2026-07-27: Node v24.18.0,
npm 11.16.0, on the *Machine* PATH — it survives a reboot.)

**Option A — from a terminal.** Open PowerShell and run these two lines:

```bash
cd "D:\Claude Projects\movie-site"
```

```bash
npm.cmd run dev
```

Leave that window open — it *is* the server. Press **Ctrl+C** to stop it.

> ⚠️ **Use `npm.cmd`, not plain `npm`, in PowerShell.** This machine's PowerShell
> execution policy is **Restricted**, so `npm` (which resolves to the *script*
> `D:\NodeJS\npm.ps1`) is blocked with *"running scripts is disabled on this
> system"*. `npm.cmd` is a batch file, which the policy doesn't apply to, so it
> works as-is. Plain `npm` works fine in **Command Prompt (cmd.exe)**, and in
> Claude Code's shell — which runs with `-ExecutionPolicy Bypass`.
>
> To make plain `npm` work in PowerShell too, run this **once, yourself**
> (it changes a Windows security setting, so it's your call):
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

**Option B — via Claude Code:** the dev server is launched with the Browser preview
tool using `.claude/launch.json` (in the *parent* folder, `D:\Claude Projects\.claude\`),
which points directly at `D:\NodeJS\node.exe`. After a computer restart the server
is stopped — just ask Claude to start it again.

Then open **http://localhost:3000**.

Live edits auto-refresh the browser (Next.js "Fast Refresh"). **Note:** changes to
`.env.local` require a dev-server **restart** to take effect.

---

## Environment variables — `.env.local`

This file holds secrets and **is gitignored** (never committed / uploaded). It contains:

```
TMDB_ACCESS_TOKEN=...            # server-only (no NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_SUPABASE_URL=...     # safe for the browser
NEXT_PUBLIC_SUPABASE_ANON_KEY=... # safe for the browser (publishable key)
```

The `NEXT_PUBLIC_` prefix tells Next.js a value is allowed in the browser. The TMDB
token has no prefix, so it stays server-side only.

---

## Database (Supabase)

**Auth:** email + password. Email confirmation is currently **OFF** for easy dev
testing — ⚠️ **remember to turn it back ON before the site is public** (Authentication →
Sign In / Providers → Email → "Confirm email").

**Table `user_movies`** — one row per movie a user marks. Created by running this in the
Supabase **SQL Editor** (safe to re-run):

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
even though every browser uses the same public key.

---

## Project structure (the files we made)

```
movie-site/
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
│  │  ├─ page.tsx         # sign-in / create-account card
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
│  ├─ TrendingSpotlight.module.css
│  ├─ UserMoviesProvider.tsx # loads YOUR seen/watchlist marks once, shares them
│  └─ GridSkeleton.tsx    # grey placeholder cards (available, not currently used)
├─ lib/
│  ├─ tmdb.ts             # TMDB (server-side): search, trending, popular, details
│  └─ supabase.ts         # browser Supabase client (auth + database)
├─ next.config.ts         # allows poster images from image.tmdb.org
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

### A note on the trailer player

The trailer is **click-to-play** (`app/movie/[id]/TrailerPlayer.tsx`): the film's
still is shown with a ▶ button, and YouTube's `<iframe>` is only created once you
press it. An always-loaded iframe **broke the back button** — interacting with
YouTube's player pushes entries into *your* browser history, so "back" would stay
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

> To pick up in a fresh chat, say: **"Read the README in movie-site and continue."**

### Where things stand
**Phases 0 and 1 are complete and verified.** The site is a working, styled,
multi-user movie tracker: search, movie detail pages, login, mark seen / watchlist,
1–10 ratings, and a My Movies page. The production build passes.

### First steps in a new session
1. **Start the dev server** — use the Browser preview tool with the config name
   `movie-site` (from `.claude/launch.json`). Do *not* use `npm run dev` in a plain
   terminal unless you prefix the Node path (see "Running it locally" above).
2. Open <http://localhost:3000> and confirm the homepage shows Trending + Popular.

### Gotchas that have already bitten us
- **Node is at `D:\NodeJS` and IS on the system PATH** — but in PowerShell use
  **`npm.cmd run dev`**, not `npm run dev`: the execution policy is Restricted
  and blocks `npm.ps1`. See "Running it locally" above.
- **PowerShell treats `[id]` as a wildcard.** Use `-LiteralPath` for anything inside
  `app/movie/[id]/`.
- **Changing `.env.local` or `next.config.ts` requires a dev-server restart.**
- **Don't add `loading.tsx`** — see the note above.
- The user is **learning web development** — explain concepts in plain language with
  diagrams/analogies, one small verified step at a time.

### Next task: Phase 2 — "Similar movies" (the first machine-learning step)
1. Add a **Python** script (offline, run on this PC) that pulls a catalogue of movies
   from TMDB into Supabase.
2. Use a **local embedding model** (e.g. `sentence-transformers`) to turn each film's
   text (overview + genres + cast) into a vector. No paid APIs.
3. Enable the **`pgvector`** extension in Supabase and store the vectors.
4. Add a **"Similar movies"** row on the movie page using nearest-neighbour search —
   then compare it against TMDB's own "If you liked this" row that's already there.

### Still pending
- Connect the repo to **GitHub** (recommended before deploying — protects the work).
- ⚠️ **Re-enable Supabase email confirmation** before the site is public.
- Deploy to Vercel on the user's existing domain (they already own one).
