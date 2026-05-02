# Security Review – Postbox Manager (Next.js / Supabase / OpenAI)

Stand der Analyse: Code- und Konfigurationsreview im Repo; **Hosted-Supabase** muss separat per SQL/Dashboard verifiziert werden (siehe Phase 4 / manuelle Checkliste).

---

## PHASE 1 – Security Inventory

### Projektstruktur (relevant)

| Bereich | Pfade / Artefakte |
|--------|-------------------|
| App Router | `src/app/**` (Pages, Layouts, `api/*/route.ts`) |
| Proxy (Session) | `src/proxy.ts` → `src/lib/supabase/middleware.ts` |
| Supabase Server | `src/lib/supabase/server.ts` (Cookie-basierter `createServerClient`) |
| Supabase Browser | `src/lib/supabase/client.ts` (nur `NEXT_PUBLIC_*`) |
| Server Actions | u. a. `src/app/dashboard/workspace-actions.ts`, `src/app/dokumentenliste/actions.ts` |
| API Routes | `src/app/api/auth/{login,logout,signup}/route.ts`, `src/app/api/documents/analyze`, `ask`, `[id]/download` |
| DB/RLS Referenz | `supabase/apply_postbox_to_cloud.sql`, Migrationen unter `supabase/migrations/` |
| Upload UI | `src/app/upload/upload-client.tsx` (Client + direkter Storage-Upload) |
| KI | `src/lib/ai/analyze-with-openai.ts`, API `analyze` + `ask` |
| Admin/CLI | `scripts/delete-documents-by-email.mjs`, `scripts/loadtest-upload-analyze.ts`, `scripts/test-auth-signup-login.mjs` |

### Sicherheitsrelevante Stellen (Kurzliste)

1. **Session & Cookies:** `@supabase/ssr` in Middleware, Login/Signup/Logout Routes setzen Cookies explizit.
2. **Geschützte UI-Routen:** Middleware `needsAuth` + serverseitiges `getUser()` + `redirect` auf vielen Pages.
3. **API-Routen:** Jede sensitive Route nutzt `createClient()` + `auth.getUser()`; **Middleware leitet `/api/*` nicht zwingend zu Login** – Schutz primär in den Handlern (korrekt umgesetzt, aber fehleranfällig bei neuen Routen).
4. **Multi-Tenancy im Code:** `.eq("user_id", user.id)` bzw. `userId` aus Session in Queries (`list-documents`, `queries`, `document-detail-fetch`, API-Routen).
5. **RLS (DB):** In `apply_postbox_to_cloud.sql` dokumentiert: `documents`, `document_metadata`, `storage.objects` mit `auth.uid()`-Policies.
6. **Storage:** Bucket `documents` als **nicht public** angelegt; Pfade `{user_id}/{document_id}/original.{ext}`; Policies prüfen ersten Ordner = `auth.uid()::text`.
7. **Signed URLs:** `GET /api/documents/[id]/download` erzeugt `createSignedUrl` serverseitig (TTL 120s).
8. **Upload-Validierung:** MIME-Whitelist, Extension-Check, 45MB Limit, `original_filename` aus `File` (von RLS/Insert begrenzt; kein Pfad-Traversal im generierten `storagePath`).
9. **Secrets:** `OPENAI_API_KEY` nur Server; kein `NEXT_PUBLIC_OPENAI_*`; Service Role nur in Skript-Doku, nicht im App-Bundle.
10. **Logging:** Keine `console.log` in `src/` (Grep); Fehlerantworten geben teils **Roh-Fehlermeldungen** zurück (siehe Findings).
11. **Security Headers:** Keine explizite CSP / Permissions-Policy in `next.config.ts` (nur `allowedDevOrigins` für Dev-Tunnel).
12. **Rate Limiting:** Nicht implementiert für Upload/Analyse/Fragen.
13. **Dependencies:** `npm audit`: 2 moderate (PostCSS via Next – siehe unten).

---

## PHASE 2 – Kritische Checks (Definition / Abdeckung)

| # | Thema | Automatisiert im Repo | Manuell / Hosted |
|---|--------|------------------------|------------------|
| 1 | Auth: unauthenticated → keine sensiblen APIs | Teilweise: Code-Review + `test:security` für Middleware-Pfade | E2E: HTTP 401 ohne Cookie auf `/api/documents/*` |
| 2 | Kein `user_id` aus Client für Ownership | Upload nutzt `userId` Prop (von Server-Page); **RLS** muss Fremd-`user_id` blockieren | Policy-Test in SQL |
| 3 | User A ≠ User B Daten | Queries + RLS | Pen-Test mit zwei echten Accounts |
| 4 | RLS aktiv & Policies | SQL-Skript `supabase/security_rls_audit.sql` | Im Dashboard ausführen |
| 5 | Storage isoliert, nicht public | SQL + Code-Pfad | Storage-Bucket-Policy prüfen |
| 6 | Keine Secrets im Client | Grep / Review | Build-Output prüfen |
| 7 | Rate Limits / Größe / MIME | Client + `maxDuration` | WAF / API-Gateway optional |
| 8 | Keine PII in Logs | Grep | Prod-Logging Policy |
| 9 | Security Headers | Fehlt im Code | `next.config` headers oder Reverse-Proxy |
| 10 | npm audit / .gitignore | `npm audit`; `.env*` ignored | CI einbinden |

---

## PHASE 3 – Implementierte Tests / Skripte

| Artefakt | Zweck |
|----------|--------|
| `npm run test:security` | Node-Test: Middleware deckt u. a. `/dokumentenliste` ab |
| `supabase/security_rls_audit.sql` | Read-only SQL für RLS/Bucket/Storage-Policies im Supabase SQL Editor |

**Nicht** implementiert (Empfehlung für später): Playwright gegen laufende `next dev` + zwei Testuser; dediziertes Rate-Limiting; OWASP ZAP o. Ä.

---

## PHASE 4 – Findings & Risiken

### Kritisch

- **Keine kritischen** Funde im Sinne von „öffentlicher Bucket“ oder „Service Role im Browser“ im geprüften Quellcode.

### Hoch

1. **Fehlende Rate Limits** (`/api/documents/analyze`, `/api/documents/ask`, Upload): Missbrauch (Kosten, DoS gegen OpenAI/Supabase) durch authentisierte Nutzer oder gestohlene Session möglich.  
   *Empfehlung:* IP/User-Limiter (Edge Middleware, API Gateway, Upstash Ratelimit, Supabase Edge Functions).

2. **Abhängigkeit von korrekt angewendeter Hosted-SQL:** Wenn `apply_postbox_to_cloud.sql` auf dem Projekt **nicht** oder veraltet ausgeführt wurde, fehlen RLS/Policies trotz sicherem Code.  
   *Empfehlung:* `security_rls_audit.sql` auf Produktion laufen lassen; Ergebnisse dokumentieren.

### Mittel

1. **Fehlerdetails an Client:** z. B. `ask/route.ts` `error.message`, `analyze` Catch mit `e.message`, Download `signError?.message` – können interne Details preisgeben.  
   *Empfehlung:* Generische Meldung nach außen, Details nur serverseitig loggen (strukturiert, ohne Dokumentinhalt).

2. **`POST /api/documents/analyze` Response:** enthält vollständiges `analysis`-Objekt (Kann PII aus Dokument enthalten) – beabsichtigt für UI, aber **nicht** für öffentliche Logs/Analytics speichern.

3. **Login-Response:** `supabaseHost` im JSON (öffentlicher Projekt-Host aus URL) – geringes Informations-Leak; für Support ok, optional entfernen.

4. **Security Headers fehlen:** Keine CSP, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options` in Next-Config.  
   *Empfehlung:* `headers()` in `next.config.ts` oder Reverse-Proxy (nginx, Vercel).

5. **Middleware `/api/*`:** `getUser()` wird ausgeführt, aber **kein** Redirect für unauthenticated API-Calls – korrekt, solange jede Route prüft. Neues API-Route-File leicht ohne Auth zu schreiben.  
   *Empfehlung:* Lint-Regel oder kleines Helper-`requireUser(supabase)`-Pattern.

6. **`npm audit`:** 2× **moderate** (PostCSS XSS-Stringify; via `next`). Fix mit `npm audit fix --force` würde laut npm auf **Next 9** downgraden → **nicht** blind ausführen; auf Next-Patches warten oder Risiko dokumentieren.

### Niedrig

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` im Client: erwartbar; Schutz über RLS, nicht über Geheimhaltung des Anon-Keys.
- Tunnel-Dev-Hosts in `allowedDevOrigins`: nur Dev.

---

## PHASE 5 – Minimal Fixes (in diesem Review umgesetzt)

| Änderung | Datei | Begründung |
|----------|--------|------------|
| `/dokumentenliste` in `needsAuth` aufgenommen | `src/lib/supabase/middleware.ts` | Defense in Depth (Page hatte bereits `redirect`, Middleware war lückenhaft). |

Weitere Code-Härtungen (Fehlertexte, Rate Limits, CSP) bewusst **nicht** blind geändert – siehe Empfehlungen oben.

---

## Priorisierte To-dos vor Production / Beta

1. Supabase: `security_rls_audit.sql` ausführen; sicherstellen, dass `documents.public = false` und alle Policies wie in `apply_postbox_to_cloud.sql`.
2. Rate Limiting für teure Endpunkte (OpenAI, große Uploads).
3. Fehlerantworten für APIs vereinheitlichen (keine Roh-DB/OpenAI-Messages).
4. Security-Header setzen (mindestens `X-Content-Type-Options: nosniff`, `Referrer-Policy`, restriktive `Permissions-Policy`).
5. `npm audit` / Next-Updates tracken; kein `--force` ohne Major-Review.
6. Optional: Playwright-Smoke „401 ohne Session“ für alle `src/app/api/**` außer Auth-Public.

---

## Manuelle Supabase-Checks (Pflicht)

- [ ] **Authentication → URL Configuration:** Site URL + Redirect URLs für Produktions-Domain + `/auth/callback`.
- [ ] **RLS:** Für `public.documents`, `public.document_metadata`: `relrowsecurity = true` (siehe Audit-SQL).
- [ ] **Policies:** SELECT/INSERT/UPDATE/DELETE nur mit `auth.uid()` (Audit-SQL).
- [ ] **Storage:** Bucket `documents` **nicht** public; vier `documents_storage_*` Policies aktiv.
- [ ] **E-Mail Auth:** Confirm email / SMTP je nach Beta-Bedarf.
- [ ] **Leaked Password Protection / MFA:** für echte Nutzer erwägen (Supabase Auth Settings).

---

## Beta-Einschätzung (5–10 private Testnutzer)

**Bedingt ja**, wenn:

- Hosted-DB **verifiziert** RLS + private Storage wie in `apply_postbox_to_cloud.sql`,
- OpenAI- und Supabase-Kontingente beobachtet werden (fehlendes Rate Limit),
- Testnutzer **vertrauenswürdig** sind und bewusst sensible Dokumente hochladen.

Ohne verifizierte RLS auf dem Live-Projekt: **nein**.

---

## Anhang: Befehle

```bash
npm audit
npm run test:security
```

SQL-Audit: `supabase/security_rls_audit.sql` im Supabase SQL Editor.
