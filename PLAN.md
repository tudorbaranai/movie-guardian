# Movie Guardian — Project Plan

A personal movie **recommendation + tracking** site for me and a few friends.
Built to learn good web development *and* real (self-hosted, free) machine learning.

---

## 1. The vision, in two layers

**Layer 1 — Personalized recommender (the core).**
I build a profile, answer a short taste quiz, and the site suggests movies *for me
specifically*, each with a reason. It gets smarter the more I rate.

**Layer 2 — Social tracking layer.**
My friends and I mark what we've seen, rate it, keep watchlists, and find movies
similar to ones we loved. This data also *feeds Layer 1* — the more it knows I've
watched, the better it recommends.

They are one app: the tracking generates the data that makes the recommender smart.

---

## 2. Decisions locked in

| Question            | Decision                                                        |
| ------------------- | --------------------------------------------------------------- |
| Recommender type    | **Content-based**, our own model. No paid APIs.                 |
| ML depth            | Practical: local embedding model + a small taste-learner.       |
| Movie data          | **Free TMDB API key** (free signup, no payment).                |
| Hosting             | Online for friends (free tiers).                                |
| Stack               | Next.js + TypeScript · Supabase · Python (offline ML).          |

### Why content-based, not "Netflix-style"
Netflix uses **collaborative filtering** ("people like you also liked…"), a network
trained on *millions* of users. With a handful of friends we have almost no data —
the **cold-start problem**. **Content-based** learns from the *movies themselves*
(plot, genre, cast, mood) plus *my own* likes/dislikes, so it works from day one
with a single user.

### The trick that makes it free + self-hostable
1. **Once, offline:** turn every movie into an **embedding** (a vector of numbers
   capturing its "meaning"). This is the neural-network part; it runs locally, free.
2. **Live, cheap:** a recommendation is just "find unseen movies whose vectors are
   closest to the ones I love." Fast vector math — runs anywhere for free.
3. **Learns me:** a *small* model on top adjusts to my thumbs up/down over time.

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
   Python scripts on my PC
   - pull movies from TMDB
   - compute embeddings (sentence-transformers, local)
   - upload movies + vectors to Supabase
```

**Key simplification:** only **two things run live** — Next.js (on Vercel) and
Supabase — both free tier. Python is used **only offline** to build the movie data
and embeddings. Postgres' `pgvector` extension (built into Supabase) does the
"find nearest movies" search, so we don't need a separate ML server running 24/7.

---

## 4. Data model (Supabase / Postgres)

- **profiles** — `id`, `display_name`, `avatar`, `taste_answers` (jsonb from quiz),
  `taste_vector` (the embedding representing my taste)
- **movies** — `tmdb_id`, `title`, `year`, `genres`, `overview`, `poster_path`,
  `embedding` (vector)
- **ratings** — `user_id`, `movie_id`, `status` (seen / watchlist),
  `rating` (like / dislike, or 1–5), `created_at`
- **friendships** *(later)* — `user_id`, `friend_id`, `status`

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
- Python: pull a solid catalog of movies from TMDB → store in Supabase.
- Compute embeddings locally → store in the `pgvector` column.
- "Similar movies" on each detail page (nearest-neighbor search).
- **Deliverable:** "similar movies" works — validates the embeddings.

### Phase 3 — The recommender + quiz (the core vision)
- Onboarding quiz builds my taste vector + filters.
- "Recommended for you" = nearest unseen movies to my taste vector, minus dislikes.
- Thumbs up/down updates my taste vector.
- **Deliverable:** personalized recommendations.

### Phase 4 — Taste-learner + social
- Train the small per-user model on accumulated feedback (the "learns me" network).
- Friends: see what friends watched/rated, shared watchlists,
  "what should we watch together" (overlap of two taste vectors).
- **Deliverable:** it improves over time + the social layer.

### Phase 5 — Polish
- "Why we picked this" explanations, better UI, mobile, performance.

---

## 7. What we build first (immediate next step)

**Phase 0 + start of Phase 1:**
1. Scaffold the Next.js + TypeScript project in this folder.
2. Set up a free Supabase project (accounts + database).
3. Get a free TMDB key.
4. Build movie search + a detail page as the first working screen.

> Guiding rule: ship a tiny working thing at every step, deploy early, and only add
> the ML once the plain website works end-to-end.
