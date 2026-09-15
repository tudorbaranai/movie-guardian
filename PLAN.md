# Movie Guardian — Project Plan

A personal movie **recommendation + tracking** site for me and a few friends.
Built to learn good web development _and_ real (self-hosted, free) machine learning.

---

## 1. The vision, in two layers

**Layer 1 — Personalized recommender (the core).**
I build a profile, answer a short taste quiz, and the site suggests movies _for me
specifically_, each with a reason. It gets smarter the more I rate.

**Layer 2 — Social tracking layer.**
My friends and I mark what we've seen, rate it, keep watchlists, and find movies
similar to ones we loved. This data also _feeds Layer 1_ — the more it knows I've
watched, the better it recommends.

They are one app: the tracking generates the data that makes the recommender smart.

---

## 2. Decisions locked in

| Question                            | Decision                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Recommender type                    | **Content-based**, our own model. No paid APIs for the core.                                                                                                             |
| ML depth                            | Practical: a **pre-trained** embedding model (not trained by us) + a small taste-learner.                                                                                |
| Movie data                          | **Free TMDB API key** (free signup, no payment).                                                                                                                         |
| Hosting                             | Online for friends (free tiers) — live on Vercel.                                                                                                                        |
| Stack                               | Next.js + TypeScript · Supabase (+ pgvector) · offline embedding script (Node, Python or a Supabase Edge Function — to decide).                                          |
| AI gateway (e.g. Vercel AI Gateway) | **Optional, later, extras only:** AI-written questions and "why we picked this" sentences, cost-capped and saved once. Never used for the core "similar / for you" math. |

### Why content-based, not "Netflix-style"

Netflix uses **collaborative filtering** ("people like you also liked…"), a network
trained on _millions_ of users. With a handful of friends we have almost no data —
the **cold-start problem**. **Content-based** learns from the _movies themselves_
(plot, genre, cast, mood) plus _my own_ likes/dislikes, so it works from day one
with a single user.

### The trick that makes it free + self-hostable

1. **Once, offline:** turn every movie into an **embedding** (a vector of numbers
   capturing its "meaning"). This is the neural-network part; it runs locally, free.
2. **Live, cheap:** a recommendation is just "find unseen movies whose vectors are
   closest to the ones I love." Fast vector math — runs anywhere for free.
3. **Learns me:** a _small_ model on top adjusts to my thumbs up/down over time.

---

## 3. Architecture

```
        Browser (me + friends)
        Next.js frontend (React + TypeScript)
                     |
        +------------+-------------------+
        |                                |
   Supabase                     Next.js API routes
   - Auth (login)               - search, ratings, recommend
   - Postgres DB                - vector search via pgvector
   - pgvector (embeddings)
        ^
        | (offline, occasional)
   Embedding script (offline — Node, Python or a Supabase Edge Function)
   - pull movies from TMDB
   - compute embeddings (free pre-trained model)
   - upload movies + vectors to Supabase
```

**Key simplification:** only **two things run live** — Next.js (on Vercel) and
Supabase — both free tier. The embedding script runs **only offline** to build the
movie data and embeddings. (An optional AI gateway may later write questions and
explanations — never the core similarity math.) Postgres' `pgvector` extension (built into Supabase) does the
"find nearest movies" search, so we don't need a separate ML server running 24/7.

---

## 4. Data model (Supabase / Postgres)

- **profiles** — `id`, `display_name`, `avatar`, `taste_answers` (jsonb from quiz),
  `taste_vector` (the embedding representing my taste)
- **movies** — `tmdb_id`, `title`, `year`, `genres`, `overview`, `poster_path`,
  `embedding` (vector)
- **ratings** — `user_id`, `movie_id`, `status` (seen / watchlist),
  `rating` (like / dislike, or 1–5), `created_at`
- **friendships** _(later)_ — `user_id`, `friend_id`, `status`

---

## 5. The taste quiz (onboarding)

Maps my answers into a starting taste vector + filters:

- **Pick a few movies you love** → directly seeds the taste vector (most powerful).
- Genres you love / can't stand.
- Mood: slow & thoughtful ↔ fast & fun.
- Subtitles OK? Older films OK? Runtime tolerance?
- Gore / scary tolerance.

---

## 6. Roadmap (each phase is usable on its own)

### Phase 0 — Foundation

- Create Next.js + TypeScript project; connect Supabase; deploy an empty site to
  Vercel so the full pipeline works end-to-end early. Get a free TMDB key.

### Phase 1 — Core tracker (no ML yet)

- Search movies (TMDB), movie detail page with poster.
- Login (Supabase Auth).
- Mark seen / add to watchlist / rate. "My Movies" page.
- **Deliverable:** a working personal movie tracker, online.

### Phase 2 — Movie data + embeddings pipeline (first ML)

- A script pulls a solid catalog of movies (~5–10k) from TMDB → store in Supabase.
- Compute embeddings with a free **pre-trained** model (384 numbers per movie) → store
  in the `pgvector` column. Where the model runs is still to decide: Node
  (Transformers.js), Python (sentence-transformers) or Supabase's built-in `gte-small`.
- "Similar movies" on each detail page (nearest-neighbor search).
- **Deliverable:** "similar movies" works — validates the embeddings.

### Phase 3 — The recommender + quiz (the core vision)

- Onboarding quiz builds my taste vector + filters.
- "Recommended for you" = nearest unseen movies to my taste vector, minus dislikes.
- Thumbs up/down updates my taste vector.
- **The learning loop (agreed 2026-09-15):** after rating a movie, show **one short,
  skippable question** ("What hooked you most? The twisty plot / the visuals / …").
  Answers become preference scores (e.g. "mind-bending plots +0.2") and nudge the taste
  vector, so every rating + answer improves the next recommendations.
  - Start with a **question bank** (free, no AI).
  - Later: **AI-written questions** and analysis of free-text answers via an AI gateway
    (small cost; only movie info + answers are sent, never name or email).
  - A **"Your taste" page** shows, edits and deletes what the site has learned.
  - New tables: `user_answers`, `taste_profile` (both behind Row-Level Security).
- **Deliverable:** personalized recommendations that visibly improve with use.

### Phase 4 — Taste-learner + social

- Train the small per-user model on accumulated feedback (the "learns me" network).
- Friends: see what friends watched/rated, shared watchlists,
  "what should we watch together" (overlap of two taste vectors).
- **Deliverable:** it improves over time + the social layer.

### Phase 5 — Polish

- "Why we picked this" explanations (optionally written once by an AI and saved),
  better UI, mobile, performance.

---

## 7. What we build next (updated 2026-09-15)

Phases 0 and 1 are done and live (plus code-based sign-up, forgot password, change
password and automated tests). Next, in order:

1. **Phase 2 — "Similar movies"**: pgvector table, embedding script, nearest-neighbour
   search, "Similar movies" row next to TMDB's row.
2. **Taste vector + "Recommended for you"** (start of Phase 3).
3. **Question bank after rating + "Your taste" page** (the learning loop, no AI).
4. **AI-written questions + answer analysis** (AI gateway, cost-capped).
5. **AI "why we picked this"** sentences, saved once (Phase 5).

> Guiding rule: ship a tiny working thing at every step, deploy early, and only add
> the ML once the plain website works end-to-end.
