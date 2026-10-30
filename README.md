# Job Tracker

A personal dashboard for tracking new grad job applications.

## Features

- Add, edit, and delete applications (company, role, link, location, source, date applied, notes)
- Paste a job link to autofill company, role, and location (Greenhouse, Lever, Ashby, Workday, and most career pages)
- Attach the resume and cover letter you sent to each job (private Supabase Storage bucket)
- Resume matching: Claude scores each job 0–100 against your resume, with matched/missing skills, red flags (years of experience, clearance, sponsorship…), and tailoring tips. New jobs are scored automatically in the background.
- Kanban board: drag cards between Saved → Applied → OA → Interviewing → Offer / Rejected / Ghosted
- Table view with inline status changes
- Stats: total applied, applied this week, response rate, interviews, offers
- Login with Supabase Auth, limited to the email(s) in `ALLOWED_EMAIL`

## Stack

- [Next.js](https://nextjs.org) (App Router, Server Actions) + TypeScript
- Tailwind CSS
- Supabase: Postgres (via [postgres.js](https://github.com/porsager/postgres)), Storage, and Auth
- Deployed on Vercel
- Claude API (`@anthropic-ai/sdk`) with structured outputs for match scoring

## Setup

Requires Node 24+ and a Supabase project.

1. Copy the values below into `.env.local` (git-ignored):

   ```bash
   # Supabase → Project Settings → Database → Connection string → Transaction pooler (port 6543)
   DATABASE_URL=postgresql://postgres.xxxx:PASSWORD@aws-0-xx.pooler.supabase.com:6543/postgres
   # Supabase → Project Settings → API
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...   # server-only
   # Who may sign in (comma-separated)
   ALLOWED_EMAIL=you@example.com
   # Match scoring
   ANTHROPIC_API_KEY=sk-ant-...
   # Optional
   # MATCH_MODEL=claude-haiku-5-5            (default claude-opus-5-5)
   # APP_TIMEZONE=America/Los_Angeles
   ```

2. Create the tables and storage bucket: `npm install && npm run db:migrate`
3. In Supabase → Authentication: add your user (Users → Add user, auto-confirm), and turn off "Allow new users to sign up".
4. `npm run dev` and open http://localhost:3000.

Deploying to Vercel: import the repo and add the same environment variables in the project settings.

## Project layout

```
src/
  app/
    page.tsx                  dashboard (stats + board/table)
    actions.ts                server actions (create/update/delete/status)
    applications/new/         add form
    applications/[id]/        edit form
  components/                 Board, ApplicationForm, StatusSelect, DeleteButton
  proxy.ts                    redirects to /login unless signed in as ALLOWED_EMAIL
  lib/
    db.ts                     all database access (Supabase Postgres)
    documents.ts              file uploads (Supabase Storage)
    auth.ts                   login checks (Supabase Auth)
    extract.ts                job link autofill
    match.ts                  resume ↔ job scoring with Claude
    resume.ts                 base resume storage + PDF/DOCX text extraction
    statuses.ts               status pipeline + shared types
```

## Roadmap

- [ ] Job scraper (GitHub new grad lists, Greenhouse/Lever/Ashby APIs) feeding a "Suggested" column
- [ ] Follow-up reminders
- [ ] Public portfolio pages
