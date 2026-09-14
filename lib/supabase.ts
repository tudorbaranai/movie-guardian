import { createClient } from "@supabase/supabase-js";

// A Supabase client for use in the browser. It uses the PUBLIC values from
// .env.local (that's why they start with NEXT_PUBLIC_). The publishable key
// (sb_publishable_…) is safe to ship to the browser — the database is guarded
// by Row Level Security rules. Never put the secret key (sb_secret_…) here.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);
