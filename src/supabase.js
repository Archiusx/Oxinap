import { createClient } from "@supabase/supabase-js";
import { auth } from "./firebase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "[CyIntel] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars. " +
    "Add them in your .env file and in Vercel → Project → Settings → Environment Variables."
  );
}

// We keep Firebase Auth as the single login system (Google Sign-In, etc).
// Supabase is used ONLY as the database. To make Postgres Row Level Security
// (RLS) actually enforce "a user can only see their own rows" WITHOUT asking
// people to log in twice, we hand Supabase the current Firebase ID token on
// every request via the `accessToken` callback below. Supabase verifies that
// token using its "Third-Party Auth" Firebase integration (configured once in
// the Supabase dashboard — see SUPABASE_SETUP.md). Inside SQL policies this
// makes `auth.uid()` / `auth.jwt()->>'sub'` equal to the Firebase UID.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  accessToken: async () => {
    const user = auth.currentUser;
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch (err) {
      console.error("[CyIntel] Failed to get Firebase ID token for Supabase:", err);
      return null;
    }
  },
});
