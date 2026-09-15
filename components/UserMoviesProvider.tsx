"use client";

// Knows which films YOU have marked, so every poster on the site can show it.
//
// The problem this solves: a poster card appears in half a dozen places
// (trending, popular, search, recommendations, My Movies). If each card asked
// the database "have I seen this one?" on its own, a single page would fire
// forty separate questions. Instead this asks ONCE — "give me everything I've
// marked" — and shares the answer with every card via React "context".
//
// Context is a way to hand a value to components far below you in the tree
// without passing it down through every level in between.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

export type MarkStatus = "seen" | "watchlist";

// A lookup table: movie id -> what you did with it.
type Marks = Record<number, MarkStatus>;

const MarksContext = createContext<{
  marks: Marks;
  refresh: () => Promise<void>;
}>({
  marks: {},
  refresh: async () => {},
});

/** Read the current user's marks from anywhere in the app. */
export function useMovieMarks() {
  return useContext(MarksContext);
}

// Just fetches and returns the data — deliberately does NOT touch React state.
// Keeping those two jobs apart is what lets the effect below stay clean.
async function fetchMarks(): Promise<Marks> {
  const { data: userData } = await supabase.auth.getUser();

  // Signed out: nothing is marked.
  if (!userData.user) return {};

  // No "where user_id = me" needed — the database's Row-Level Security rules
  // physically cannot return anyone else's rows.
  const { data } = await supabase
    .from("user_movies")
    .select("movie_id, status");

  const marks: Marks = {};
  for (const row of data ?? []) {
    marks[row.movie_id as number] = row.status as MarkStatus;
  }
  return marks;
}

export default function UserMoviesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [marks, setMarks] = useState<Marks>({});

  const refresh = useCallback(async () => {
    setMarks(await fetchMarks());
  }, []);

  useEffect(() => {
    // `active` guards against a slow answer arriving after this component is
    // gone, which would be an update to something that no longer exists.
    let active = true;
    const apply = (next: Marks) => {
      if (active) setMarks(next);
    };

    fetchMarks().then(apply);

    // Reload when someone signs in or out, so the marks always match the
    // account that's actually active.
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      fetchMarks().then(apply);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // useMemo keeps this object identical between renders. Without it, every
  // render would hand down a brand-new object and re-render every card.
  const value = useMemo(() => ({ marks, refresh }), [marks, refresh]);

  return (
    <MarksContext.Provider value={value}>{children}</MarksContext.Provider>
  );
}
