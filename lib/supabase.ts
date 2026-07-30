import { createClient } from "@supabase/supabase-js";

// A Supabase client for use in the browser. It uses the PUBLIC values from
// .env.local (that's why they start with NEXT_PUBLIC_). This key is safe to
// ship to the browser — the database is guarded by access rules we'll add next.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
