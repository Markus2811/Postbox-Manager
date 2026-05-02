# Postbox Manager – Projektstand (Info)

Stand: Beschreibung des **aktuellen** MVP nach dem, was im Code umgesetzt ist. Abschnitt „Geplante Erweiterungen“ ist ein Merkzettel für später.

---

## Zweck

Web-App für **private Post / Dokumente**: Upload (PDF, JPEG, PNG), serverseitige **KI-Analyse** (OpenAI), strukturierte Metadaten in der Datenbank, **Dashboard** mit Liste, Suche und Filtern, **Detailseite** pro Dokument, einfache **Fragen-Antwort**-Seite über gespeicherte Metadaten. Auslegung **multi-tenant** über Supabase Auth + Row Level Security (RLS).

---

## Technik

| Bereich | Technologie |
|--------|-------------|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS |
| Daten & Auth | Supabase (Postgres, Auth, Storage), RLS |
| Datenabruf | TanStack React Query (Provider im Root-Layout) |
| KI | OpenAI API (`OPENAI_API_KEY`, optional `OPENAI_MODEL`) |
| PDF-Text | `pdf-parse` (v2), Bilder: Vision, falls nötig |

Konfiguration: `postbox-manager/.env.local` (nicht versioniert) – u. a. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, OpenAI-Variablen. **Production / zweites Vercel-Projekt:** deutsch inkl. RLS- und Auth-URL-Checks → `PRODUCTION_DEPLOY.md`. **Englisch, vendor-offizielle Checkliste (SaaS / Cloud):** `SAAS_CLOUD_SETUP.md`. **Lokal speichern + zu Vercel (Git oder CLI):** `VERCEL_Lokal_Deploy.md`.

**Auth / E-Mail:** Kommt keine Bestätigungsmail oder blockiert der Login nach Registrierung → im Supabase-Dashboard **Authentication → Providers → Email** die Option **Confirm email** für Tests deaktivieren; für Produktion eigenes **SMTP** hinterlegen (siehe Supabase-Doku). Hilfs-SQL im Ordner `supabase/`: `auth_check_user.sql` (Status), `auth_manual_confirm_email.sql` (Bestätigung setzen; E-Mail im Skript anpassen).

Datenbank-Setup für **Hosted Supabase**: einmalig SQL aus `supabase/apply_postbox_to_cloud.sql` im SQL-Editor des Projekts ausführen (Tabellen, RLS, Storage-Bucket `documents`).

**Alle Nutzer & App-Daten zu Auth löschen (nur bewusst):** `supabase/cloud_reset_auth_and_app_data.sql` im SQL-Editor ausführen (`DELETE FROM auth.users`; CASCADE auf `documents` / `document_metadata`). **Storage** nicht per SQL löschbar – Reste im Bucket `documents` ggf. im Dashboard unter Storage oder per Storage-API (Service Role) entfernen.

---

## Wichtige Routen

| Route | Funktion |
|-------|----------|
| `/` | Startseite (nicht eingeloggt: CTAs; eingeloggt: Redirect zum Dashboard) |
| `/login`, `/signup` | E-Mail/Passwort; bei bestehender Session auf `/login` Hinweis + Abmelden |
| `/auth/callback` | Nach E-Mail-Bestätigung oder OAuth: Session per Code/`token_hash` setzen, Redirect z. B. ins Dashboard |
| `/dashboard` | Dokumentliste, Kategorie-Filter, Suche (`?q=`), Kurz-Insights (Kacheln: Handlung, Frist 30 Tage, Anzahl), Links zu Filtern (`?todo=1`, `?frist=1`) |
| `/upload` | Drag & Drop + Dateiauswahl, optionaler Zusatztext für alle Uploads der Sitzung, nach Upload automatische Analyse |
| `/documents/[id]` | Detail, Metadaten, Download (signierte URL), erneut analysieren inkl. optionalem Text |
| `/fragen` | Formular: Frage an KI, Kontext aus den letzten Dokument-Metadaten (`POST /api/documents/ask`) |
| `/fristen` | Fristen & To-dos: heute, 7/30 Tage, ohne Frist aber Handlung; nur eigene Dokumente |
| `/finanzen` | Beträge nach Monat, anstehende Zahlungen, Betrag ohne Frist, Gruppierung Absender/Typ |
| `/vertraege` | Vertrags-ähnliche Dokumente; Hinweisblock bei Kündigungs-/Frist-Stichworten im Text |
| `/analytics` | Kennzahlen: Gruppierung nach Dokumenttyp (KI) und Kategorie, Status, Fristen, Kurz-Insights |

**API (Auswahl):** `POST /api/auth/login`, `POST /api/auth/signup`, `POST /api/auth/logout`, `POST /api/documents/analyze`, `GET /api/documents/[id]/download`, `POST /api/documents/ask`.

Alte Pfade: `/auth/anmelden` → `/login`, `/auth/registrieren` → `/signup`; übrige `/auth/*` (außer `/auth/callback`) → `/login`. Technisch: Next.js-**Proxy** (`src/proxy.ts`, Session-Update). Geschützt: u. a. `/dashboard`, `/upload`, `/documents/*`, `/fragen`, `/fristen`, `/finanzen`, `/vertraege`, `/analytics`.

**Hilfsfunktionen (Auswahl):** `src/lib/documents/queries.ts` (`getDocumentsWithMetadata`), `metadata-helpers.ts` (Vertrag, Fristen, Sortierung), `analytics.ts` (Kennzahlen für `/analytics`), `format.ts` (Datum, Währung, `todayYmd`).

**Test-PDFs (synthetisch):** `npm run generate-test-pdfs` schreibt lokal auf diesen PC unter **`%USERPROFILE%\Downloads\postbox-test-documents`** (Windows) bzw. `~/Downloads/postbox-test-documents` – inkl. `manifest.json` (nur Fantasiedaten). Optional: `POSTBOX_TEST_PDF_OUT` auf einen anderen absoluten Ordner setzen.

---

## Datenmodell (Kurz)

- **`documents`:** u. a. `user_id`, `storage_path`, `original_filename`, `mime_type`, `display_name`, `category`, `status` (`uploaded` → `processing` → `processed` / `failed`), **`content_hash`** (SHA-256 des Dateiinhalts; Duplikate pro Nutzer unabhängig vom Dateinamen). SQL für gehostetes Supabase: `supabase/migrations/20260502120000_documents_content_hash.sql` im SQL-Editor ausführen (oder gleicher Block am Ende von `apply_postbox_to_cloud.sql`).
- **`document_metadata`:** u. a. `document_type`, `sender`, `document_date`, `due_date`, `amount`, `currency`, `summary`, `action_required`, `confidence`, `raw_ai_json`; pro Dokument ein Datensatz (Unique auf `document_id`).

**Storage:** Bucket `documents`, Pfad `/{user_id}/{document_id}/original.{ext}`.

**Kategorien (UI):** feste deutsche Labels (Rechnungen, Verträge, …), aus dem KI-`document_type` abgeleitet; `display_name` wird regelbasiert generiert (Datum, Absender, Typ, Kurztext).

---

## Skripte (npm)

Im Ordner `postbox-manager`: u. a. **`npm run dev:tunnel`** (Next + Cloudflare Quick Tunnel), **`npm run dev:lt`** (Next + **localtunnel**, Workaround wenn `trycloudflare` DNS blockiert), **`npm run dev:ngrok`** (Next + **ngrok**, nach Installation + Authtoken), alternativ getrennt **`npm run dev`** + **`npm run tunnel`** / **`tunnel:lt`** / **`tunnel:ngrok`**, `npm run build`, `npm run lint`, `npm run generate-test-pdfs`; bei lokalem Supabase (Docker): `npm run supabase:start` / `supabase:status` / `supabase:reset`. **`npm run test:auth`** legt absichtlich einen **echten** Auth-Nutzer an (E-Mail `postbox-cli-smoke-…@gmail.com`) – nicht mit der Web-Registrierung verwechseln; Testnutzer im Dashboard löschen, wenn nicht gewünscht. **`npm run admin:delete-docs -- <email>`** leert alle Dokumente + Storage-Dateien eines Nutzers: entweder **`SUPABASE_SERVICE_ROLE_KEY`** in `.env.local`, oder **`POSTBOX_PURGE_EMAIL`** (gleiche E-Mail wie im Aufruf) + **`POSTBOX_PURGE_PASSWORD`** (Kontopasswort) ohne Service Role.

**Windows PowerShell:** Wenn `npm run …` mit *Ausführung von Skripts … deaktiviert* / `PSSecurityException` scheitert, stattdessen **`npm.cmd`** nutzen – umgeht `npm.ps1`, z. B. **`npm.cmd run dev`**, **`npm.cmd run dev:tunnel`**, **`npm.cmd run dev:lt`**, **`npm.cmd run tunnel`**, **`npm.cmd run admin:delete-docs -- markus.greil@hotmail.de`**, **`npm.cmd run generate-test-pdfs`**. Port **3000** muss für `dev` / `dev:tunnel` / `tunnel` frei sein (alten `next dev` beenden; `netstat -ano | findstr :3000`).

---

## Öffentlicher Zugriff (lokal + Cloudflare Tunnel)

Die App bleibt auf deinem Rechner (`next dev` auf Port **3000**). **Cloudflare Tunnel** (`cloudflared`) leitet von einer öffentlichen **HTTPS**-Adresse auf `http://127.0.0.1:3000` weiter (praktisch für Login/Signup von außen).

**`DNS_PROBE_FINISHED_NXDOMAIN` oder „Seite nicht erreichbar“ für `*.trycloudflare.com`:** Die Subdomain lebt **nur**, solange **`cloudflared`** für genau diesen Quick-Tunnel läuft. Terminal/Cursor zu, Rechner aus, oder nur den Tunnel beendet → DNS verschwindet, alte URLs sind **unwiderruflich tot** (kein Bug). Lösung: **`npm run dev:tunnel`** neu starten und die **neue** URL aus der Konsole verwenden (nicht Lesezeichen von gestern).

**Workaround (App soll von außen erreichbar sein, Cloudflare-URL „stirbt“ oder DNS klappt nicht):**

1. **Gleiche Domain, aber Tunnel war zu:** Immer nur die URL aus der **laufenden** Sitzung nutzen; `dev:tunnel` / `dev:lt` offen lassen.
2. **DNS/Filter blockiert `*.trycloudflare.com`:** Rechner/Router auf **1.1.1.1** oder **8.8.8.8** als DNS testen **oder** statt Cloudflare **`npm run dev:lt`** (anderer Anbieter, meist **`https://….loca.lt`** in der Konsole; Next.js erlaubt `*.loca.lt` bereits). Beim ersten Aufruf kann eine **Zwischenseite** (IP/Klick) erscheinen – kurz bestätigen.
3. **Stabilere öffentliche URL ohne Quick-Tunnel:** [ngrok](https://ngrok.com/) installieren, einmal `ngrok config add-authtoken …`, dann **`npm run dev:ngrok`** (oder nur `npm run tunnel:ngrok`, wenn `npm run dev` schon läuft). Redirect-URLs in Supabase auf die jeweilige **`*.ngrok-free.app`**-Basis anpassen.

1. **Cloudflared installieren** (einmalig), z. B. Windows: [Installationsanleitung](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/) oder `winget install --id Cloudflare.cloudflared` (falls verfügbar).
2. **Empfohlen – ein Terminal:** `npm run dev:tunnel` → startet Next, wartet bis Port 3000 antwortet, startet dann den Tunnel und zeigt die **https-URL** in den `tunnel`-Zeilen.
3. **Alternativ – zwei Terminals:** `npm run dev`, danach **`npm run tunnel`**. Für Tunnel-Hosts ist `allowedDevOrigins` gesetzt (`*.trycloudflare.com` u. a.) – sonst blockiert Next.js im Dev-Modus API-Aufrufe von der Tunnel-URL, während `localhost` weiter funktioniert.  
   Nur wenn Cloudflare bei dir nicht funktioniert: **`npm run tunnel:lt`** (localtunnel, `.loca.lt`) – dort kann eine **Browser-Zwischenseite** mit **IP-Eingabe** oder Klick-Bestätigung erscheinen.
4. **Supabase (Hosted):** [Authentication → URL Configuration](https://supabase.com/dashboard/project/_/auth/url-configuration)  
   - **Site URL** ggf. auf die Tunnel-URL setzen (oder `http://localhost:3000` lassen und nur Redirects erweitern – je nach gewünschtem Verhalten).  
   - Unter **Redirect URLs** die exakte Tunnel-URL (mit `https://`, ohne trailing slash) und bei wechselnden Quick-Tunnels jeweils die neue URL eintragen, sonst können **Login, Signup und E-Mail-Links** blockiert werden. Zusätzlich **`…/auth/callback`** (lokal z. B. `http://localhost:3000/auth/callback`) erlauben, damit die **E-Mail-Bestätigung** nach der Registrierung funktioniert.

**Hinweis:** Quick Tunnels (`trycloudflare`) sind für Tests gedacht; die URL ändert sich typischerweise bei jedem Tunnel-Neustart. **Ohne laufenden `npm run tunnel`** existiert die alte Subdomain nicht mehr – der Browser meldet dann z. B. `DNS_PROBE_FINISHED_NXDOMAIN`. Für eine **feste Domain** brauchst du ein Cloudflare-Konto und einen [benannten Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) mit konfigurierter Public Hostname.

**Tunnel-URL „funktioniert nicht“ (502, leer, hängt):** `npm run tunnel` leitet immer auf **`http://127.0.0.1:3000`**. Der Dev-Server muss **genau dort** lauschen (`npm run dev` ist dafür auf Port **3000** festgelegt). Wenn Port 3000 schon belegt ist, startet Next nicht – dann den anderen Prozess beenden (z. B. alten `next dev` schließen, unter Windows ggf. `netstat -ano | findstr :3000` und passende PID mit Task-Manager beenden). **`npm run dev:tunnel`** meldet in dem Fall `EADDRINUSE` – ebenfalls: nur **eine** Next-Instanz auf 3000, dann erneut starten. **Reihenfolge (ohne `dev:tunnel`):** zuerst `npm run dev` (warten bis „Ready“), danach `npm run tunnel` und **nur die URL aus dieser Tunnel-Sitzung** verwenden.

---

## Geplante Erweiterungen (Wunsch, noch nicht umgesetzt)

1. **Organisation / Archiv:** z. B. echte Ordner-/Archivlogik, Drag-Sortierung oder feste Nutzer-Ordner (bisher keine eigene Ordner-DB).

2. **Insights-Unterseite:** eine **eigene Unterseite** mit erweiterter **Insights-Ansicht** (über Dashboard-Kacheln und die neuen Auswertungsseiten hinaus; z. B. Trends, Export – genaue Ausprägung offen).

---

*Diese Datei beschreibt nur den Ist-Stand und Wünsche; sie ersetzt keine technische Spezifikation oder Vertragsdokumentation.*
