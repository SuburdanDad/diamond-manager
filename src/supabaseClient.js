import { createClient } from "@supabase/supabase-js";

// ── Supabase Configuration ──────────────────────────────────────────────────
// Replace these with your actual Supabase project credentials.
// You can find them at: https://supabase.com/dashboard → Settings → API
//
// For the free tier, create a new project and run the SQL in supabase-schema.sql
// to set up the events table.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
