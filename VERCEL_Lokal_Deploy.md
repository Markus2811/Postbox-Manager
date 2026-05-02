# Projekt lokal speichern und zu Vercel bringen

## Wo liegt das Projekt schon?

Der Code liegt **bereits lokal** auf deinem Rechner, z. B.:

`c:\Users\ElenaHaegler\telegram-haushalts-assistent\postbox-manager\`

In Cursor: **Datei → Alle speichern** (oder `Strg+K`, dann `S`), damit alle offenen Änderungen auf die Festplatte geschrieben sind. Es gibt keinen separaten „Export nach Vercel“-Button – Vercel bezieht den Stand aus **Git** oder aus der **Vercel CLI**.

---

## Wichtig: Vercel „lädt“ keinen Projektordner per ZIP hoch

Der übliche und stabile Weg ist: **Git-Repository** (GitHub, GitLab, Bitbucket) mit deinem Code verbinden und in Vercel **Root Directory** = `postbox-manager` setzen (wenn das Repo-Root der Ordner **über** `postbox-manager` ist).

Alternativ ohne Git-Host: **Vercel CLI** im Ordner `postbox-manager` (`npx vercel`).

---

## Variante A — Git + GitHub (empfohlen)

### Repository nur für die App (empfohlen für [Markus2811/Postbox-Manager](https://github.com/Markus2811/Postbox-Manager))

Wenn auf GitHub das leere Repo **`Postbox-Manager`** existiert und **nur** die Next.js-App drin sein soll:

1. **[Git für Windows](https://git-scm.com/download/win)** installieren, danach **PowerShell neu starten**.
2. Im Ordner `postbox-manager` das Skript ausführen:

   ```powershell
   cd c:\Users\ElenaHaegler\telegram-haushalts-assistent\postbox-manager
   .\push-to-github.ps1
   ```

   Beim ersten `git push` meldet sich Git ggf. zur **Anmeldung bei GitHub** (Browser oder [Personal Access Token](https://github.com/settings/tokens)).

3. In **Vercel** → *Add New Project* → **`Markus2811/Postbox-Manager`** importieren → **Root Directory leer lassen** (Repo-Root = App) → Umgebungsvariablen setzen → Deploy.

### Monorepo-Variante (gesamter Ordner `telegram-haushalts-assistent` als ein Git-Repo)

Dann in Vercel **Root Directory** = `postbox-manager` setzen. Initialisierung z. B.:

```powershell
cd c:\Users\ElenaHaegler\telegram-haushalts-assistent
git init
git add .
git commit -m "Initial commit: Postbox Manager"
git remote add origin https://github.com/DEIN-USER/DEIN-REPO.git
git branch -M main
git push -u origin main
```

**Hinweis:** `.env.local` mit echten Keys **nicht** committen (liegt in `.gitignore`). Auf Vercel trägst du die Werte unter *Environment Variables* ein.

---

## Variante B — Nur Vercel CLI (ohne GitHub)

Im Ordner `postbox-manager`:

```powershell
cd c:\Users\ElenaHaegler\telegram-haushalts-assistent\postbox-manager
npx vercel
```

Der Assistent verknüpft das Verzeichnis mit einem Vercel-Projekt und lädt den aktuellen Stand hoch. Für dauerhafte Updates: erneut `npx vercel` oder `npx vercel --prod`.

---

## Nach dem ersten Deploy

- Supabase **Site URL** und **Redirect URL** `https://…/auth/callback` an die echte Vercel-URL anpassen (siehe `SAAS_CLOUD_SETUP.md` / `PRODUCTION_DEPLOY.md`).
