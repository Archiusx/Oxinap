# Supabase Setup Guide — CyIntel

Auth (Google Sign-In) **Firebase pe hi rehta hai** — kuch nahi badla wahan.
Sirf **data storage** (investigations) ab Firestore ki jagah **Supabase
(Postgres)** me jaata hai. Iska fayda: SQL hai, RLS Firestore-rules se simple
hai, aur JSONB me poora nested object directly daal sakte ho — koi
"nested array not supported" wala drama nahi.

Auth do baar nahi karwana padega: Supabase ka **Firebase Third-Party Auth**
feature use kiya hai, jisse Firebase ka login token hi Supabase verify karta
hai. User ko sirf ek hi baar (Firebase/Google) login karna hoga.

---

## Step 1 — Supabase project banao

1. https://supabase.com → Sign in → **New Project**
2. Naam do (e.g. `cyintel`), region select karo (Mumbai/Singapore agar dikhe — India ke liye fast rahega), database password set karo (save kar lena, baad me chahiye nahi hoga par safe rakho)
3. ~2 min wait karo project provision hone ka

## Step 2 — SQL schema run karo

1. Left sidebar → **SQL Editor** → **New Query**
2. `supabase/schema.sql` file (zip me hai) ka pura content copy-paste karo
3. **Run** click karo
4. Confirm: left sidebar → **Table Editor** → `investigations` table dikhni chahiye

## Step 3 — Firebase ko Supabase me "Third-Party Auth" ke roop me connect karo

Ye step zaroori hai warna RLS (`auth.jwt()->>'sub'`) kaam nahi karega.

1. Supabase dashboard → **Authentication** → **Sign In / Providers** → niche scroll karo **"Third Party Auth"** section tak (kabhi-kabhi naam "Third-Party Auth Integrations" hota hai)
2. **Add provider** → **Firebase** select karo
3. Apna **Firebase Project ID** daalo — ye Firebase Console → Project Settings → General tab me "Project ID" field me milega (e.g. `cyintel-12345`)
4. Save karo

> Agar tumhe ye option nahi dikhta (kabhi-kabhi naye dashboards me jagah badal jaati hai), to Supabase docs search karo: **"Firebase Auth third-party"** — wahan exact current UI path mil jayega.

## Step 4 — API keys lo

1. Supabase dashboard → **Project Settings** (gear icon) → **API**
2. Copy karo:
   - **Project URL** → `https://xxxxx.supabase.co`
   - **anon public** key (NOT service_role — wo kabhi frontend me mat daalna)

## Step 5 — Env variables set karo

**Local dev (`.env` file, repo root me):**
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**Vercel:**
Project → Settings → Environment Variables → ye dono add karo → **Redeploy**
(naye env vars sirf naye deployment me effective hote hain, isliye redeploy zaroori hai)

## Step 6 — Dependency install + deploy

```bash
npm install
npm run build   # local check
git add .
git commit -m "migrate: Firestore -> Supabase for investigation storage"
git push
```
Vercel auto-deploy kar dega push ke baad (ya Vercel dashboard se manual redeploy bhi kar sakte ho agar auto-deploy off hai).

## Step 7 — Test

1. App khulo → login karo (Firebase/Google — same as pehle)
2. Koi search/investigation chalao
3. Browser console (F12) me dekho: `[CyIntel] Supabase save SUCCESS` aana chahiye
4. Supabase dashboard → **Table Editor** → `investigations` → naya row dikhna chahiye
5. Dashboard pe "Recent Investigations" list me bhi turant dikhna chahiye (Realtime subscription)

---

## Agar abhi bhi save nahi ho raha

Browser console me jo error aaye wo dekho:

- **`relation "investigations" does not exist`** → Step 2 ka SQL run nahi hua, dobara karo
- **`new row violates row-level security policy`** → Step 3 (Firebase Third-Party Auth) properly setup nahi hua — confirm Firebase Project ID sahi daala hai
- **`Missing VITE_SUPABASE_URL`** → Step 5 ke env vars set nahi hain ya Vercel redeploy nahi hua
- **`JWT expired` / `Invalid JWT`** → user ka Firebase session refresh karne ke liye logout→login karke try karo

Agar exact error message bhej do, main turant specific fix bata dunga.
