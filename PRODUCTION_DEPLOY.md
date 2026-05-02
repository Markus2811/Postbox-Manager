# Produktions-SaaS: zweite „Version“ + Vercel (ohne bestehende lokale App zu ersetzen)

**Englische Schrittfolge (Cloud-SaaS, Multi-Tenant, ohne Zahlungen):** [SAAS_CLOUD_SETUP.md](./SAAS_CLOUD_SETUP.md)

Dieses Dokument erklärt **zuerst** die Strategie, dann **Schritte mit Testpunkten**. Die **bestehende URL** (localhost, Tunnel, altes Vercel-Projekt) bleibt unberührt, solange du **ein neues Vercel-Projekt** (oder eine Preview-Deployment-URL) anlegst – es gibt **keine** zweite Ordner-Kopie des Codes im Repo (Pflege-Horror), sondern **dieselbe Codebasis**, optional eigener **Git-Branch**.

---

## 0. Begriffe: „zweite Version“ und Supabase-Keys

| Begriff | Bedeutung |
|--------|-----------|
| **Zweite Version der App** | Zweites **Vercel-Projekt** (gleiches Git-Repo) **oder** Branch `release` + Production-Branch in Vercel. Gleicher Code unter `postbox-manager/`. |
| **Bestehende URL** | Läuft weiter: z. B. `npm run dev`, Tunnel, oder bereits verknüpftes Vercel-Projekt A. Neues Deployment = **Projekt B** mit neuer `*.vercel.app`-Domain. |
| **`NEXT_PUBLIC_SUPABASE_*`** | **Anon/Publishable Key** + Projekt-URL **dürfen** im Browser stehen – das ist das offizielle Supabase-SSR-Muster. **Schutz = Row Level Security**, nicht Geheimhaltung des Anon-Keys. |
| **Niemals im Client** | **`SUPABASE_SERVICE_ROLE_KEY`**, **`OPENAI_API_KEY`**, Passwörter – nur Server-Umgebung (Vercel → Settings → Environment Variables, **nicht** `NEXT_PUBLIC_`). |

Wenn du wirklich **keinen** Supabase-Client im Browser willst, bräuchtest du einen größeren Umbau (Upload nur über eigene API mit Service Role) – **nicht** Teil dieses Leitfadens.

---

## 1. Supabase: separates Projekt für Production (empfohlen)

**Warum:** Beta/Dev-Daten und Production trennen.

**Schritte**

1. Neues Projekt im Supabase-Dashboard anlegen (Production).
2. **Test:** Dashboard öffnen, Projekt-URL notieren.

---

## 2. SQL: Tabellen, RLS, Storage (Pflicht)

**Schritte**

1. Im SQL-Editor des **Production**-Projekts nacheinander ausführen:
   - `supabase/apply_postbox_to_cloud.sql` (vollständig)
   - ggf. weitere Migrationen aus `supabase/migrations/` (z. B. `content_hash`, `workspace_bucket`), falls noch nicht im Block enthalten.
2. **Test:** `supabase/security_rls_audit.sql` ausführen – Erwartung:
   - `documents` / `document_metadata`: `rls_enabled = true`
   - Bucket `documents`: `public = false`
   - Storage-Policies `documents_storage_*` vorhanden.

---

## 3. Supabase Auth: URLs für Vercel

**Schritte**

1. Vercel-Projekt B anlegen (siehe Abschnitt 5) und die **Production-URL** notieren, z. B. `https://dein-appname.vercel.app`.
2. Supabase → **Authentication → URL Configuration**
   - **Site URL:** `https://dein-appname.vercel.app` (oder deine Custom Domain).
   - **Redirect URLs:** dieselbe Basis-URL, plus  
     `https://dein-appname.vercel.app/auth/callback`  
     (und weiterhin `http://localhost:3000/auth/callback` für lokal, falls gewünscht).
3. **Test:** Registrierung auf Vercel-URL → E-Mail-Link (falls Confirm an) öffnet → landet nach `/auth/callback` eingeloggt im Dashboard.

---

## 4. Environment Variables (Vercel)

Im Vercel-Projekt B → **Settings → Environment Variables** (Production):

| Variable | Kontext | Hinweis |
|----------|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | Anon / publishable key |
| `OPENAI_API_KEY` | Production | Nur Server |
| `OPENAI_MODEL` | Production | Optional |

**Nicht setzen** im Vercel-Frontend-Build: `SUPABASE_SERVICE_ROLE_KEY` (nur für Admin-Skripte lokal/CI).

**Test:** Nach Deploy (Abschnitt 5) Upload + Analyse auf Production-URL; in Browser-DevTools **Application → keine** `service_role` / `sk-` Strings in ausgeliefertem JS (Stichprobe).

---

## 5. Vercel: zweites Projekt (neue URL)

**Schritte**

1. [vercel.com](https://vercel.com) → **Add New… → Project** → Git-Repo verbinden.
2. **Root Directory:** `postbox-manager` (falls Repo-Root der Monorepo-Parent ist – im Wizard setzen).
3. **Build:** `npm run build` (Default), **Output:** Next.js erkannt. Im Repo liegt **`vercel.json`** mit **`npm ci`** (reproduzierbarer Install; gültiges `package-lock.json` nötig).
4. Optional **Custom Domain:** in Vercel Domains hinterlegen und in Supabase **Site URL** + **Redirect URLs** dieselbe `https://…`-Origin verwenden; für korrekte Metadaten-URLs `NEXT_PUBLIC_SITE_URL` in Vercel setzen (siehe `.env.example`).
5. Env-Variablen wie in Abschnitt 4 eintragen → **Deploy**.
6. **Test:**  
   - Startseite lädt per HTTPS.  
   - `curl -I https://dein-appname.vercel.app/` → Response-Header enthält u. a. `x-content-type-options: nosniff` und `strict-transport-security` (nur Production-Build).  
   - Login, Dashboard, Upload, Download eines eigenen Dokuments.

---

## 5b. Upload-Flow (Server + signierte Storage-URL)

- **`POST /api/documents/upload-init`:** Prüft Session, Duplikat per `content_hash`, legt die Zeile in `documents` an (immer `user_id = auth.uid()`), erzeugt `createSignedUploadUrl` für `…/original.{ext}`.
- **Browser:** lädt die Datei per `uploadToSignedUrl` **direkt zu Supabase Storage** (kein großer Datei-Body durch die Next.js-Route – wichtig für Vercel-Limits).
- **`POST /api/documents/upload-abort`:** räumt die Zeile auf, wenn der Storage-Upload fehlschlägt.

---

## 6. Multi-Tenancy & API (bereits im Code – Verifikation)

- **Middleware:** `src/lib/supabase/middleware.ts` – geschützte Routen inkl. `/dokumentenliste`.
- **API:** `getUser()` + `.eq("user_id", user.id)` bzw. gleichwertig in `analyze`, `ask`, `download`.
- **RLS:** letzte Instanz in Postgres.

**Test (manuell, zwei Accounts):**

1. Nutzer A anlegen, Dokument hochladen.  
2. Nutzer B anlegen, in Browser B einloggen.  
3. URL von A `/documents/<id-von-a>` in Session B öffnen → **404 / kein Zugriff**.  
4. Optional: Supabase SQL als User B `select * from documents where id = '…'` → 0 Zeilen.

---

## 7. Storage & signierte URLs

- Upload-Pfad: `{user_id}/{document_id}/original.{ext}` (Client nutzt Session; RLS erzwingt Ordner = `auth.uid()`).
- Download: `GET /api/documents/[id]/download` → serverseitig `createSignedUrl` (kurzlebig).

**Test:** Download-Link nur eingeloggt; nach Logout Link ungültig / 401.

---

## 8. HTTPS

Vercel liefert HTTPS automatisch für `*.vercel.app` und Custom Domains.

---

## 9. Lokaler Smoke-Test vor Push (optional)

```bash
cd postbox-manager
npm run build
npm run start
```

Mit Production-`.env` nicht committen – nur lokal testen. **Test:** gleiche Checks wie auf Vercel (ohne Tunnel nötig).

---

## 10. Checkliste „Go-Live“

- [ ] RLS + Storage-Audit-SQL grün  
- [ ] Supabase Redirect URLs = Production-Domain  
- [ ] Vercel Env gesetzt, kein Service Role im Web-Build  
- [ ] Zwei-Nutzer-Isolation getestet  
- [ ] `npm audit` bekannt (siehe `SECURITY_REVIEW.md`)

---

## Referenz

- Sicherheitsreview: `SECURITY_REVIEW.md`  
- Allgemeine Infos: `INFO.md`
