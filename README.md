# Job Tracker

A personal dashboard for tracking new grad job applications.

## Features

- Add, edit, and delete applications (company, role, link, location, source, date applied, notes)
- Paste a job link to autofill company, role, and location (Greenhouse, Lever, Ashby, Workday, and most career pages)
- Attach the resume and cover letter you sent to each job (stored in `data/uploads/`, git-ignored)
- Resume matching: Claude scores each job 0–100 against your resume, with matched/missing skills, red flags (years of experience, clearance, sponsorship…), and tailoring tips. New jobs are scored automatically in the background.
- Kanban board: drag cards between Saved → Applied → OA → Interviewing → Offer / Rejected / Ghosted
- Table view with inline status changes
- Stats: total applied, applied this week, response rate, interviews, offers

## Stack

- [Next.js](https://nextjs.org) (App Router, Server Actions) + TypeScript
- Tailwind CSS
- SQLite via Node's built-in `node:sqlite` (data lives in `data/tracker.db`, which is git-ignored)
- Claude API (`@anthropic-ai/sdk`) with structured outputs for match scoring

## Running locally

Requires Node 24+.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

For match scoring, add an Anthropic API key to `.env.local` (git-ignored):

```bash
ANTHROPIC_API_KEY=sk-ant-...
# Optional, defaults to claude-opus-5-5:
# MATCH_MODEL=claude-haiku-5-5
```

Then add your resume on the **My resume** page.

## Project layout

```
src/
  app/
    page.tsx                  dashboard (stats + board/table)
    actions.ts                server actions (create/update/delete/status)
    applications/new/         add form
    applications/[id]/        edit form
  components/                 Board, ApplicationForm, StatusSelect, DeleteButton
  lib/
    db.ts                     all database access
    extract.ts                job link autofill
    match.ts                  resume ↔ job scoring with Claude
    resume.ts                 base resume storage + PDF/DOCX text extraction
    statuses.ts               status pipeline + shared types
```

## Roadmap

- [ ] Deploy (Vercel) with login (Supabase auth + Postgres)
- [ ] Job scraper (GitHub new grad lists, Greenhouse/Lever/Ashby APIs) feeding a "Suggested" column
- [ ] Follow-up reminders
- [ ] Public portfolio pages
