# Post Calendar

A small personal app for posting daily on X and LinkedIn. Dump a raw note, get drafts, park them in a bank, put them on a calendar, post by hand, tick them off.

Next.js (App Router, TypeScript) · Supabase Postgres · Anthropic API · plain CSS.
Supabase and Anthropic are only ever called from server code. Nothing secret reaches the browser.

## Run locally

Needs Node 20+.

```bash
npm install
cp .env.example .env.local   # then fill in the four values
npm run dev                  # http://localhost:3000
```

| Variable                    | What it is                                                        |
| --------------------------- | ----------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`         | Anthropic API key                                                 |
| `SUPABASE_URL`              | Supabase project URL (Project Settings → API)                     |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase `service_role` key. Server only, never prefix it `NEXT_PUBLIC_` |
| `APP_PASSWORD`              | The one password for the login screen                             |

`APP_PASSWORD` also signs the session cookie, so changing it logs everyone out.

## Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**.
3. Paste the whole of [`supabase/schema.sql`](supabase/schema.sql) and press **Run**. It is safe to run again.

That creates `notes`, `drafts` and `settings` (with its single row) and turns on row level security. The app uses the service role key, which bypasses RLS, so nobody else can read the tables.

## Deploy to Vercel

1. Push this repo to GitHub (or any git host Vercel supports).
2. In Vercel: **Add New → Project**, import the repo. The Next.js preset needs no changes.
3. Under **Settings → Environment Variables**, add `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `APP_PASSWORD` for Production (and Preview if you use it).
4. Deploy. Visit the URL, enter your password.

Redeploy after changing any environment variable. Vercel only reads them at build/deploy time.

## How it works

- **Notes → drafts.** `/api/draft` runs two model calls: a specificity check, then drafting. If the note is vague you get one follow-up question; your answer is added and drafting runs. Each of the 3 angles produces an X and a LinkedIn draft (6 in total) that land in the Bank.
- **Bank → calendar.** Schedule from the Bank, or use "Pick from bank" on an empty calendar slot. Each day has one X slot and one LinkedIn slot.
- **Streak.** Consecutive days, ending today or yesterday, with at least one draft marked posted. A post counts toward the day it is scheduled on.
- **Red dot.** A past day with a scheduled post that was never marked posted.
- **Account.** The first visit asks what the account is about, who it's for, and for a bio. Every draft has to stay inside that. An off-topic note does not become an off-topic post. Edit it later from Settings.
- **Chat.** The Chat tab can do the same things as the buttons: save a note, answer a follow-up, edit, schedule, unschedule, mark posted, discard, and change settings. The other tabs keep working on their own. A change in chat shows up there immediately.

## Layout

```
app/            pages, API route handlers, global CSS
components/     the client UI (one file per tab)
lib/            auth cookie, Supabase client, model calls, date helpers
proxy.ts        redirects to /login without a valid session cookie
supabase/       schema.sql
```

`proxy.ts` is what Next.js 16 calls middleware.
