// A Supabase client for use on the SERVER, acting as one specific signed-in
// person.
//
// `lib/supabase.ts` is the browser client: it knows who's logged in because
// the login is stored in that browser. An API route has no such memory — it
// just gets an HTTP request. So the browser sends its Supabase **access
// token** (a short-lived signed pass, already in its session) in the
// `Authorization` header, and we build a client that carries that pass.
//
// Why not simply let the browser POST its list of watched films to us? Because
// anything the browser sends can be edited before it's sent. With the token,
// the DATABASE decides what we may read: the same Row-Level Security rules as
// everywhere else apply, so this client can only ever see that person's rows —
// and only if the token is genuine and unexpired.
//
// Note this still uses the *publishable* key, never the secret one.
import { createClient } from "@supabase/supabase-js";

export function supabaseForToken(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      // A server handles many people at once and forgets everything between
      // requests, so it must not try to store or refresh a session.
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

/** Pull the token out of an `Authorization: Bearer …` header. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}
