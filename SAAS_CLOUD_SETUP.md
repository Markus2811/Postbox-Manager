# Postbox Manager — cloud SaaS setup (multi-tenant, no payments)

This guide walks you through running **Postbox Manager** as a **hosted software product**: private individuals **self-register** with email and password; each account is **isolated** via Supabase **Row Level Security (RLS)** and **per-user storage paths**. There is **no billing or payment** integration in this repository.

For a **German** production strategy (second Vercel project, keys, and detailed tests), see [PRODUCTION_DEPLOY.md](./PRODUCTION_DEPLOY.md).

---

## Official platform documentation (read alongside this repo)

Use these vendor guides as the source of truth for behaviour and UI locations in the dashboards:

| Topic | Documentation |
|--------|----------------|
| Deploy Next.js on Vercel | [Vercel — Next.js](https://vercel.com/docs/frameworks/nextjs) |
| Next.js production deployment | [Next.js — Deploying](https://nextjs.org/docs/app/building-your-application/deploying) |
| Supabase Auth with Next.js (App Router, cookies) | [Supabase — SSR Auth](https://supabase.com/docs/guides/auth/server-side/nextjs) |
| Redirect URLs and Site URL | [Supabase — Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) |
| Vercel environment variables | [Vercel — Environment variables](https://vercel.com/docs/projects/environment-variables) |
| Supabase Row Level Security | [Supabase — RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) |

---

## Prerequisites

- A [Supabase](https://supabase.com) account and a new **empty** project (recommended: separate from any personal dev project you use for experiments).
- A [Vercel](https://vercel.com) account (or another host that runs **Next.js 16** with the same environment-variable model).
- An [OpenAI](https://platform.openai.com) API key if you use document analysis / Q&A features that call OpenAI from the server.
- **Node.js** matching [Vercel’s supported range](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) (this repo declares `>=20.9.0` in `package.json` and pins **22** in `.nvmrc` for local parity).

---

## Step 1 — Create the Supabase project

1. In the Supabase dashboard, create a project and wait until the database is ready.
2. Note **Project URL**, **anon (publishable) key**, and **service role key** (Settings → API). The service role key must **never** be exposed to the browser or committed to git.

**Check:** You can open the SQL editor and run `select 1`.

---

## Step 2 — Apply schema, RLS, and storage

1. In the Supabase **SQL Editor**, run the bundled script in order:
   - `supabase/apply_postbox_to_cloud.sql` (full file).
2. If your repo has newer incremental migrations under `supabase/migrations/` that are **not** already reflected in `apply_postbox_to_cloud.sql`, run those migrations as well (newest last), or merge their contents intentionally.
3. Optional but recommended: run `supabase/security_rls_audit.sql` and confirm RLS is enabled on app tables and the `documents` bucket is **not** public.

**Check:** Tables such as `documents` exist; Storage shows a private `documents` bucket (or the name your SQL defines).

---

## Step 3 — Configure Auth (email signup for individuals)

This app exchanges OAuth / PKCE codes on **`/auth/callback`** (see `src/app/auth/callback/route.ts`). Supabase must allow redirects to that path on **every** origin you use.

1. **Authentication → URL configuration** (see [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)):
   - **Site URL:** the primary user-facing origin, e.g. `https://your-app.vercel.app` or your custom domain (must use `https` in production).
   - **Redirect URLs:** add at least:
     - `https://<your-production-host>/auth/callback`
     - For Vercel Preview deployments, either add each preview URL or a pattern your org accepts (Supabase supports wildcards in some plans; tighten when you go fully public).
2. **Email** (optional for production UX): configure SMTP or Supabase’s email settings so confirmation and password-reset emails are delivered. For early testing you can confirm users manually (see `supabase/auth_manual_confirm_email.sql` if you use that workflow).
3. Leave **sign-ups enabled** for a public SaaS; use Supabase rate limiting, CAPTCHA, or **Auth Hooks** if you face abuse (see Supabase docs).

**Check:** From the deployed app’s `/signup`, you can create a test user and complete login (with or without email confirmation, depending on your Supabase settings). Email magic links must land on `/auth/callback` with the same host as in Redirect URLs.

---

## Step 4 — Deploy the Next.js app (Vercel)

1. **Import** the Git repository in Vercel ([guide](https://vercel.com/docs/getting-started-with-vercel/import)).
2. **Root Directory:** set to `postbox-manager` if the Git repo root is the monorepo folder above the app.
3. **Framework preset:** Next.js (auto-detected). The repo includes **`vercel.json`** with `"$schema"` and **`npm ci`** for reproducible installs (requires a valid `package-lock.json`).
4. **Environment variables** (mirror `.env.example`; set separately for **Production**, **Preview**, and **Development** in Vercel as needed — see [environments](https://vercel.com/docs/projects/environment-variables#environment-types)):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only; never `NEXT_PUBLIC_`)
   - `OPENAI_API_KEY` (server only, if features require it)
   - Optional: `NEXT_PUBLIC_SITE_URL` — canonical `https://…` for metadata / Open Graph when you use a **custom domain** (see `.env.example`).
5. **Production branch:** in Vercel → Project → Settings → Git, choose which branch deploys to Production (commonly `main`).

**Check:** Production build succeeds; opening the production URL shows the landing page. After first deploy, call `GET /api/health` — you should see `vercelEnv: "production"` on the production deployment when built on Vercel.

---

## Step 5 — Custom domain (optional, official flow)

1. In Vercel → Project → **Domains**, add your domain and complete DNS as instructed.
2. Update Supabase **Site URL** and **Redirect URLs** to use the new `https://your-domain/...` (especially `/auth/callback`).
3. Set `NEXT_PUBLIC_SITE_URL` in Vercel Production to the same canonical `https://` origin so Next.js `metadataBase` resolves correctly (see `src/app/layout.tsx`).

---

## Step 6 — Long-running API routes

Heavy routes already declare `export const maxDuration` in code (e.g. document analyze / ask). On **Vercel**, long serverless durations require a **Pro** (or higher) plan and project limits that allow the configured maximum. If requests time out at 10s, upgrade the plan or split work into async jobs (not implemented in this repo).

---

## Step 7 — Multi-tenant verification (mandatory before “go live”)

1. Open **two separate** browser profiles (or one normal window + one private window).
2. Register **User A** and **User B** with different emails.
3. As User A, upload a document with a distinctive filename or title.
4. Log in as User B and confirm that **User B cannot see User A’s** documents or metadata.

Isolation is enforced by **RLS policies** tied to `auth.uid()` and storage paths scoped to the user — not by hiding UI alone.

---

## Step 8 — Operations (no payments)

- **Monitoring:** Vercel Observability / logs; ping `GET /api/health` from an uptime monitor (`vercelEnv` + short `gitSha` confirm which build responded).
- **Backups:** Rely on Supabase project backups / point-in-time recovery according to your Supabase plan.
- **Secrets:** Rotate `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` in Vercel and Supabase if they are ever exposed. Never commit them or prefix them with `NEXT_PUBLIC_`.
- **Headers:** Production responses include standard hardening headers from `next.config.ts` (including **HSTS** on HTTPS deployments).
- **Privacy / legal:** Add your own privacy policy and terms if you offer the product to the public; this repo does not ship legal text.

---

## Step 9 — EU data residency (optional)

Vercel lets you pin **regions** for some workloads. If you need EU-only compute, see [Vercel — Regions](https://vercel.com/docs/concepts/regions) and add a `regions` field to `vercel.json` only after you confirm which routes your plan supports (Edge vs Node). This repo does not pin a region by default so you can choose globally or per compliance needs.

---

## Summary

| Concern | Mechanism |
|--------|------------|
| Per-person registration | Supabase Auth (email/password) + `/signup` |
| OAuth / session callback | `/auth/callback` (whitelist in Supabase) |
| Multi-tenant data isolation | PostgreSQL RLS + user-scoped storage |
| Secrets | Service role and OpenAI keys **server-only** on Vercel |
| Reproducible deploys | `npm ci` in `vercel.json`, `engines` + `.nvmrc` |
| Payments | Not part of this application |

You now have a **single codebase** deployed as a **multi-tenant SaaS** backend and frontend, suitable for private individuals signing up on their own.
