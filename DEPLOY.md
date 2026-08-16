# Deploying Freely so client links actually work

Right now Freely only runs on your laptop (`localhost:3000`), which is why
published quote links and diary links don't open for clients — "localhost"
only means anything on the machine that's running it. Once this is deployed,
the exact same "Publish" buttons will produce real links anyone can open.

This uses Vercel (hosting, free tier is fine) + Neon (hosted Postgres, free
tier is fine). Both are the easiest fit for a Next.js + Prisma app like this.

## 1. Push the code to GitHub

A git repo has already been initialized locally with a clean first commit
(checked — your real `.env` secrets were **not** included, only
`.env.example`).

On your own machine, in the `freely` folder:

```bash
# Create a new empty repo on github.com first (no README/license — keep it empty),
# then point your local repo at it:
git remote add origin https://github.com/<your-username>/freely.git
git branch -M main
git push -u origin main
```

## 2. Create a hosted Postgres database (Neon)

1. Go to https://neon.tech, sign up, create a new project (any name/region).
2. Once created, copy the **connection string** it gives you — it looks like
   `postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require`.
   Keep this tab open, you'll need it twice.

## 3. Import the project into Vercel

1. Go to https://vercel.com, sign up/log in (GitHub login is easiest).
2. "Add New" → "Project" → import the `freely` GitHub repo.
3. Before clicking Deploy, open **Environment Variables** and add:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from step 2 |
   | `NEXTAUTH_SECRET` | a random string — generate with `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | your project's **stable** domain, e.g. `https://freely-yourname.vercel.app` or your own domain. See the warning in step 5: this must not be a per-deployment URL. |
   | `ANTHROPIC_API_KEY` | your Claude API key |
   | `FREELY_ENCRYPTION_KEY` | a random string — generate with `openssl rand -base64 32` |

   Optional, and each one switches something on:

   | Key | What it turns on |
   |---|---|
   | `RESEND_API_KEY` | All email. Without it, sends are recorded as skipped and nothing goes out. |
   | `EMAIL_FROM` | The address mail comes from. Needs a domain verified in Resend, otherwise only your own address receives anything. |
   | `CRON_SECRET` | The daily nudges. The endpoint refuses to run without it rather than running unauthenticated. Generate with `openssl rand -base64 32`. |
   | `ADMIN_EMAIL` | The /insights dashboard, for that address only. Unset means nobody, and the page 404s. |
   | `NEXT_PUBLIC_POSTHOG_KEY` | A hosted analytics tool. Off unless set. Update your privacy policy before setting it: it is the only thing here that sends a third party anything. |

   Leave `STRIPE_*`, `FIGMA_*`, and `GOOGLE_*` out for now — those features
   just stay greyed out until you add them later, nothing breaks.

4. Click **Deploy**.

## 4. Push the database schema to Neon

The deploy will succeed even though the database is still empty — Prisma
just needs its schema pushed to it once. From your own machine:

```bash
# Temporarily point at the Neon database and push the schema to it:
DATABASE_URL="<paste the same Neon connection string>" npx prisma db push
```

Do this once now, and again any time the schema changes in the future
(same as you already do locally).

## 5. Lock in the real URL

After the first deploy, set `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to your
project's stable domain, then **Deployments → redeploy**.

**Use the right URL.** Vercel shows several and they are not interchangeable:

| Looks like | What it is | Use it? |
|---|---|---|
| `freely-a1b2c3d4-yourname.vercel.app` | one deployment | **No.** Replaced on every push |
| `freely-git-main-yourname.vercel.app` | the main branch | No |
| `freely-yourname.vercel.app` | the project | Yes |
| `your-own-domain.com` | your domain | Yes, best |

Pick a deployment URL and everything works until the next push, then sign-out,
sign-in and OAuth callbacks all return `DEPLOYMENT_NOT_FOUND`, because
NextAuth redirects to a deployment that no longer exists. It is the same reason
a client's project page link would stop working: those links are built from
`NEXT_PUBLIC_APP_URL`, and a link you sent a client last week has to still open
this week.

The deployment URL is the one Vercel shows you immediately after a deploy, so it
is the easy one to copy by mistake. Find the stable one under
**Settings → Domains**.

## 6. Verify

- Open the Vercel URL, sign up/log in.
- Generate a quote, hit "Publish as HTML page."
- Open the link it gives you in an incognito window (or send it to yourself
  on your phone) — it should now be a real `https://...vercel.app/q/...`
  link that opens for anyone, not `localhost`.

---

Everything above from here on is a one-time setup. Day-to-day, you keep
working locally (`npm run dev`) and just `git push` when you want to ship
changes — Vercel redeploys automatically on every push to `main`.

## Card payments (optional, add later)

Skip this entirely and Freely still invoices: the PDF works on its own, the Pay
button simply never appears, and no part of the app breaks. Set it up when you
want clients to be able to pay by card.

**How the money moves.** Freely has one Stripe account, the platform. Each
freelancer links their own. A client's payment is charged directly on the
freelancer's account, so the money goes from the client to the freelancer and
Freely never holds it. That is deliberate: taking other people's money into our
account and paying it on afterwards is money transmission, which is licensed
work in most countries.

What Freely stores is the account id Stripe hands back. No bank details, no card
details, no keys belonging to a freelancer.

### One-off setup

1. Sign up at **stripe.com**. This is Freely's own account, not yours as a
   freelancer, so use a business email you are happy to keep.
2. In the dashboard, leave the **Test mode** toggle on until you have tried a
   payment end to end.
3. Left sidebar, **Connect**, then **Get started**. Choose **Platform or
   marketplace** when it asks what you are building. Stripe will ask for a
   business name and a support email that its users see.
4. Left sidebar, **Developers**, then **API keys**. Reveal the **Secret key**
   (it starts with `sk_test_`) and copy it.
5. In Vercel, **Settings**, then **Environment Variables**. Add
   `STRIPE_SECRET_KEY` with that value.

### The webhook

This is what marks an invoice paid. It has to be a **Connect** endpoint, because
payments happen on connected accounts rather than on Freely's own. An account
endpoint will be accepted by Stripe and then never deliver anything, which is a
slow thing to debug.

6. **Developers**, then **Webhooks**, then **Add endpoint**.
7. URL: `https://free-ly.co/api/webhooks/stripe`
8. Where it asks which events to listen to, choose **Events on Connected
   accounts**, not events on your account.
9. Select `checkout.session.completed`. Nothing else is used.
10. On the endpoint's page, reveal the **Signing secret** (starts with `whsec_`)
    and add it in Vercel as `STRIPE_WEBHOOK_SECRET`.
11. **Deployments**, three dots on the newest, **Redeploy**.

### Trying it

12. Open **Account** in Freely. A **Card payments** section appears once the key
    is set. Click **Connect Stripe** and go through Stripe's sign-up.
13. In test mode Stripe accepts made-up details and clears the account in
    seconds. Come back and the section says Connected.
14. Open a project's invoice, click **Send for payment**, and pay with card
    number `4242 4242 4242 4242`, any future expiry, any CVC.
15. The invoice should flip to paid within a few seconds. If it does not, the
    webhook is the thing to check: Stripe's Webhooks page lists every delivery
    and the response it got.

### Going live

Switch Stripe out of test mode, repeat steps 4 and 10 with the live keys
(`sk_live_`, and a new signing secret for the live endpoint), and update both
variables in Vercel. Test keys and live keys are separate worlds and nothing
carries over, including connected accounts.
