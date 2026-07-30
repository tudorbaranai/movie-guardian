// Talks to the TMDB API. Everything here runs on the SERVER only, so your
// secret token (from .env.local) is never sent to the visitor's browser.

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

/* ---------------------------------- types --------------------------------- */

export type Movie = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  // The wide, cinematic still. TMDB sends this on list endpoints too, not just
  // on the full movie details — that's what the homepage showcase uses.
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
};

export type CastMember = {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
};

export type Video = {
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
};

export type MovieDetails = Movie & {
  runtime: number | null;
  tagline: string | null;
  genres: { id: number; name: string }[];
  vote_count: number;
  // These come from "append_to_response" — extra data in the same request.
  credits?: { cast: CastMember[] };
  videos?: { results: Video[] };
  recommendations?: { results: Movie[] };
};

/* --------------------------------- helpers -------------------------------- */

// One shared place to make a TMDB request, so every function below stays short.
async function tmdbFetch<T>(path: string): Promise<T | null> {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${TMDB_BASE_URL}${path}${separator}language=en-US`, {
    headers: {
      Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
      accept: "application/json",
    },
    // Remember the answer for an hour: instant repeats, and kind to TMDB.
    next: { revalidate: 3600 },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`TMDB request failed (${response.status}) for ${path}`);
  }

  return (await response.json()) as T;
}

// Build image URLs. TMDB serves several widths; we pick one per use case.
export function posterUrl(path: string | null, size: "w185" | "w342" | "w500" = "w342") {
  return path ? `${IMAGE_BASE_URL}/${size}${path}` : null;
}

export function backdropUrl(path: string | null, size: "w780" | "w1280" = "w1280") {
  return path ? `${IMAGE_BASE_URL}/${size}${path}` : null;
}

export function profileUrl(path: string | null) {
  return path ? `${IMAGE_BASE_URL}/w185${path}` : null;
}

// "2010-07-15" -> "2010"
export function yearOf(releaseDate: string | null | undefined) {
  return releaseDate ? releaseDate.slice(0, 4) : null;
}

// 148 -> "2h 28m"
export function formatRuntime(minutes: number | null) {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

/* -------------------------------- requests -------------------------------- */

export async function searchMovies(query: string): Promise<Movie[]> {
  const data = await tmdbFetch<{ results: Movie[] }>(
    `/search/movie?query=${encodeURIComponent(query)}&include_adult=false&page=1`,
  );
  return data?.results ?? [];
}

export async function getTrending(): Promise<Movie[]> {
  const data = await tmdbFetch<{ results: Movie[] }>("/trending/movie/week");
  return data?.results ?? [];
}

export async function getPopular(): Promise<Movie[]> {
  const data = await tmdbFetch<{ results: Movie[] }>("/movie/popular?page=1");
  return data?.results ?? [];
}

// One request that also brings back cast, trailers and recommendations.
export async function getMovie(id: string | number): Promise<MovieDetails | null> {
  return tmdbFetch<MovieDetails>(
    `/movie/${id}?append_to_response=credits,videos,recommendations`,
  );
}

// Pick the best YouTube trailer from the videos list, if there is one.
export function findTrailer(videos: Video[] | undefined): Video | null {
  if (!videos?.length) return null;
  const youtube = videos.filter((video) => video.site === "YouTube");
  return (
    youtube.find((v) => v.type === "Trailer" && v.official) ??
    youtube.find((v) => v.type === "Trailer") ??
    youtube.find((v) => v.type === "Teaser") ??
    null
  );
}
