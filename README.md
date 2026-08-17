# Freely

Quote, track, and report on client work — with AI wired in for real.

Freely starts as a single-person studio tool: sign-up is only available until
the first account is created. After that, more people join via a **Team
invite** (Team link in the top bar) rather than open sign-up.

## Stack

- Next.js 14 (App Router) + TypeScript — one codebase for frontend and backend
  (server actions for mutations, no separate API layer for most flows)
- Prisma + PostgreSQL
- NextAuth.js (Credentials provider, JWT sessions)
- Tailwind CSS
- Claude (Anthropic API), called **server-side only**
- Stripe (optional — real invoicing)
- Figma OAuth (optional — Memory connector)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start Postgres locally (Docker)

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` with user/password/db all set to `freely`
(see `docker-compose.yml`).

### 3. Configure environment variables

```bash
cp .env.example .env
```

Required to run the app at all:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Default from docker-compose works as-is. |
| `NEXTAUTH_SECRET` | Random secret for session signing. Generate with `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | `http://localhost:3000` for local dev. |
| `ANTHROPIC_API_KEY` | Your Claude API key. Never exposed to the client — only read in server actions. |

Optional — each feature just stays disabled/greyed out until you fill these in:

| Variable | Enables |
| --- | --- |
| `FREELY_ENCRYPTION_KEY` | Required before connecting Figma (encrypts the stored OAuth token). Generate the same way as `NEXTAUTH_SECRET`. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Real "Send for payment" invoicing via Stripe Checkout. |
| `FIGMA_CLIENT_ID`, `FIGMA_CLIENT_SECRET` | The Figma "Connect" button in Memory → Connectors. |

See `.env.example` for where to get each of these.

### 4. Push the Prisma schema to the database

```bash
npx prisma db push
```

(`npm install` also runs `prisma generate` automatically via the `postinstall` script.)

### 5. Run the app

```bash
npm run dev
```

Visit `http://localhost:3000` — you'll land on `/signup` to create the studio's
first account, then be redirected into the app.

### 6. Run tests

```bash
npm test
```

Covers AI-generation prompt building/response parsing (`lib/anthropic.ts`,
including the full Memory context — tone, story, context, files) and
project-state logic (`lib/project-state.ts`), plus `tests/integration/` —
integration tests that run against the real Postgres from step 2 rather than
a mocked Prisma client (see ADR-0002). These need `docker compose up -d`
running and the schema pushed, same as the app itself. `tests/support/`
has the test-DB client and User/Team/Quote factories those tests build on.

## CI

`.github/workflows/ci.yml` runs `npm run lint && npm test` on every push and
pull request to `main`, against an ephemeral Postgres service container (so
`tests/integration/` runs there too, no extra setup). Set this as a required
status check under GitHub → Settings → Branches so it actually gates merges,
rather than only reporting a pass/fail.

## How it works

- **Quote** — a 3-step wizard (source → instructions → output) that calls Claude
  server-side to generate a `Brief`. Briefs can be refined with follow-up prompts
  and are listed in history. "Add to Track" converts a brief into a `Project`.
  Every brief can be downloaded as a real PDF (`/api/briefs/[id]/pdf`,
  `@react-pdf/renderer`) from its detail page.
  - The wizard always asks for your **hourly rate** and (as a fallback signal)
    your **expertise level**. When generating, Freely pulls your own past
    quoted `Brief`s as pricing history and asks Claude to anchor the new
    price/hours to what you've actually charged for similar work. If you have
    no pricing history yet, Claude is given Anthropic's `web_search` tool and
    told to research realistic market rates for your field/expertise/region
    instead of guessing.
  - **Strategy** is an optional includable section (toggle it on in step 3,
    alongside Timeline/SOW/AI-disclosure) modeled on how strong hand-written
    quotes are structured: a goal statement, a few concrete findings drawn
    from the brief, an explicit "AI will / AI will not" delineation, and open
    questions to confirm with the client before kicking off. It's stored as
    structured data (not a prose blob), so the brief page, PDF export, and
    public quote page can all render it as real headed, bulleted sections
    with background-separated cards instead of one flat scroll of text.
  - **Examples** — attach reference files (a past landing page, a moodboard,
    a screenshot) to a quote with a caption explaining how it applies, e.g.
    "this is a landing page I built — I'd apply a similar structure here."
    Shown on the brief page, the PDF export, and the public quote page.
  - **3 public-page templates** — Classic (card layout, tinted sections),
    Editorial (large serif headline, magazine-style whitespace), and Minimal
    (plain, high-contrast, hairline rules) — picked in step 3 when the format
    is "HTML page" and rendered at `/q/[publicSlug]`.
  - **PDF export** now mirrors the same visual language as the brief page: a
    dark cover band with a 3-up stat row, pill-badge section labels, tinted
    section cards, and a footer with your email and the quote date. It also
    ships in the same 3 templates (Classic/Editorial/Minimal) — pick one from
    the dropdown next to "Download PDF" on the brief page; the choice is a
    per-download query param (`?template=`), not saved on the brief.
  - **Currency** — set your default in Memory → Branding (10 common
    currencies); each quote can still override it individually in the
    wizard's hourly-rate step. The chosen currency's symbol is used
    everywhere a price shows up (brief page, PDF, public quote page, Track,
    invoices) and is passed to Claude so its market-rate research and pricing
    reasoning stay in the right currency.
- **Track** — a dashboard of `Project`s with a stats bar (active/overdue count,
  total value, deliverables done), an editable deliverables checklist,
  price/hours/timeline, status, and a "Send to Diary" action. **Upload a brief
  / SOW** reads a document with Claude and creates the project directly —
  deliverables and timeline already filled in, no manual entry. The project
  detail page has a persistent switcher (left rail) to jump between projects
  without going back to the dashboard. The invoice page shows a computed
  summary, and — once `STRIPE_SECRET_KEY` is set — a real "Send for payment"
  button that creates a Stripe Checkout session. A webhook
  (`/api/webhooks/stripe`) marks the project's invoice PAID when Stripe
  confirms payment; Freely never touches card details.
- **Diary** — per-project update entries (auto-generated from Track actions, or
  written manually) plus a **Publish** toggle that makes a read-only page live at
  `/p/[publicSlug]` — no login required, a real shareable URL, styled with the
  owner's branding if set.
- **Quote's "HTML page" format** is now a real thing — publish a brief and it's
  live at `/q/[publicSlug]`, no login required (previously this was just a
  stored preference with no page behind it).
- **Onboarding** — new users pick one of ~7 broad industry categories
  (`/onboarding`, enforced by the `(app)` layout until `User.industry` is set).
  This tailors the Quote wizard's Instructions placeholder and is the fallback
  signal for persona/pricing research when there's no history yet.
- **Memory** — redesigned as one scrollable page (not tabs) with anchor-nav
  chips: **Persona** (AI-synthesized from Story/Tone/Context/Files/industry/past
  projects — regenerate on demand, or hand-correct it if it's off), **Voice**
  (Instructions + Tone, both with one-click presets), **Story & context**,
  **Files, images & links** (all three together — files and links feed Claude
  directly; images are for your own brand reference), **Branding** (logo +
  primary/accent color, applied to the public client site, public quote pages,
  and PDF export), and **Connectors** (Figma OAuth, proof of pattern for
  Notion/GitHub). **Skills** remains a placeholder.
- **Google login** — "Continue with Google" appears on the sign-in page once
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED`
  are set (see `.env.example`). Follows the same rule as email sign-up: only
  the very first account can self-create via Google; every account after that
  needs a Team invite. An existing Credentials account can add Google sign-in
  just by using the same email — no separate "link accounts" step.
- **Team** (linked from the top bar) — invite a teammate by email or with a
  shareable link; once they join, they see the same Quotes, Projects, and
  Diary as you do. The account that creates the first invite becomes the team
  owner and can remove members; every list and detail view (Track, Quote
  history, Diary) is scoped to "everyone on my team" instead of just "me."

## Configuring the optional integrations

**Stripe** — create a Stripe account, grab a test secret key from
[dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys), and for
local webhook testing run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
(the CLI prints a webhook secret to put in `STRIPE_WEBHOOK_SECRET`). In
production, create a webhook endpoint pointing at
`{your domain}/api/webhooks/stripe` subscribed to `checkout.session.completed`.

**Figma** — create an OAuth app at
[figma.com/developers/apps](https://www.figma.com/developers/apps) with
callback URL `{NEXTAUTH_URL}/api/connect/figma/callback`, and put its client
ID/secret in `.env`. Also set `FREELY_ENCRYPTION_KEY` — the access token is
encrypted (AES-256-GCM) before being stored.

## Explicitly out of scope for v1

- Real integrations with Notion/GitHub (Figma is wired up as the reference
  implementation of the OAuth pattern — `src/app/api/connect/figma/*`,
  `src/lib/figma.ts`, `src/lib/crypto.ts` — the same shape works for the rest)
- The Skills Memory tab
- PDF is the only real export format for quotes; Figma-file export (as
  opposed to Figma *connection*) is a meaningfully different kind of work and
  isn't built

## Deploying

Target stack is Vercel (app) + Neon (Postgres), both with usable free tiers.
Steps once you're ready:

1. Create a Neon Postgres database, copy its connection string into
   `DATABASE_URL` in your Vercel project's environment variables.
2. Set `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (your production URL),
   `ANTHROPIC_API_KEY`, and any of the optional variables above that you want
   live, in the same place.
3. Run `npx prisma db push` (or set up `prisma migrate deploy` in your build
   step) against the Neon database.
4. Deploy via the Vercel CLI or by connecting the GitHub repo.

Not deployed automatically — this is left for you to trigger once accounts are
confirmed.

## Project structure

```
prisma/schema.prisma       Data model — User, Team, TeamInvite, Brief, Project,
                            Deliverable, DiaryEntry, MemoryAsset, Connection
src/lib/                   Prisma client, auth config, Claude integration, text
                            extraction, PDF rendering, Stripe client, Figma API
                            helper, token encryption, team-scoping helper
src/actions/                Server actions — all mutations (briefs, projects,
                            diary, memory, auth, team, connections, invoice)
src/components/ui/         Ported design-system primitives (Button, Card, Chip,
                            TextField, Stamp, Stepper...)
src/app/(auth)/            Sign in / sign up / invite redemption
src/app/(app)/             Authenticated shell: Quote, Track, Diary, Memory, Team
src/app/p/[slug]/          Public, unauthenticated client site
src/app/api/               Stripe webhook, Figma OAuth start/callback, PDF download
tests/                     Vitest unit tests
tests/integration/         Integration tests against real Postgres (see below)
tests/support/             Test-DB client + User/Team/Quote factories, used by
                            tests/integration/
```
