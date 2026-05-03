/**
 * Lasttest: 4 PDFs (13–16) hochladen + Analyse wie in der App.
 * Konto: zuerst POSTBOX_MARKUS_EMAIL/PASSWORD, sonst POSTBOX_LOADTEST_*,
 * sonst gespeicherte Zugangsdaten in reports/.markus-loadtest-creds.json,
 * sonst automatische Registrierung (nur wenn Supabase ohne E-Mail-Bestätigung Session liefert).
 *
 * HTML-Bericht: reports/loadtest-last.html
 *
 *   npm run generate-test-pdfs
 *   npm run loadtest:four
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { performance } from "perf_hooks";
import { analyzeWithOpenAI } from "../src/lib/ai/analyze-with-openai";
import { categoryFromDocumentType } from "../src/lib/documents/categories";
import { buildDocumentNamesFromAnalysis } from "../src/lib/documents/document-naming";
import { extractDocumentContent } from "../src/lib/documents/extract-content";

const NEW_FILES = [
  "13-bankkonto-mitteilung-synth.pdf",
  "14-amt-brief-synth.pdf",
  "15-krankenkasse-synth.pdf",
  "16-steuer-vorauszahlung-synth.pdf",
];

const CREDS_FILE = "reports/.markus-loadtest-creds.json";
const HTML_FILE = "reports/loadtest-last.html";
/** Passwort nur für automatisch erzeugtes Lasttest-Konto (kein Produktivnutzer). */
const AUTO_MARKUS_PASSWORD = "LoadtestMarkus2026!Postbox";

type Creds = { email: string; password: string };

type DocRow = {
  file: string;
  documentId: string;
  msExtract: number;
  msOpenAI: number;
  msDb: number;
  msTotal: number;
};

type ReportPayload = {
  generatedAt: string;
  accountLabel: string;
  emailMasked: string;
  credsSource: string;
  parallelExtractMs: number;
  parallelCpuUser: number;
  parallelCpuSystem: number;
  memBefore: ReturnType<typeof memMb>;
  memAfterParallel: ReturnType<typeof memMb>;
  sequentialWallMs: number;
  sequentialCpuUser: number;
  sequentialCpuSystem: number;
  memAfterSequential: ReturnType<typeof memMb>;
  rows: DocRow[];
  /** Logische CPU-Kerne (os.cpus().length), mind. 1. */
  logicalCpuCount: number;
  /** Installierter RAM laut Betriebssystem (MiB, gerundet). */
  totalRamMb: number;
  error?: string;
};

function resolveTestPdfDir(): string {
  if (process.platform === "win32" && process.env.USERPROFILE) {
    return path.join(process.env.USERPROFILE, "Downloads", "postbox-test-documents");
  }
  return path.join(os.homedir(), "Downloads", "postbox-test-documents");
}

function resolveProjectPath(rel: string): string {
  return path.join(process.cwd(), rel);
}

function memMb() {
  const u = process.memoryUsage();
  return {
    heapUsedMb: Math.round(u.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(u.heapTotal / 1024 / 1024),
    rssMb: Math.round(u.rss / 1024 / 1024),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** CPU-Sekunden des Node-Prozesses ÷ Wandzeit = „Kern-Äquivalente“ im Mittel (kann &gt;1 sein). */
function processCpuCoreEquiv(userUs: number, systemUs: number, wallMs: number): number {
  const wallSec = wallMs / 1000;
  if (wallSec <= 0) return 0;
  return (userUs + systemUs) / 1e6 / wallSec;
}

/** Anteil der gesamten theoretischen CPU-Leistung, den nur dieser Prozess „beansprucht“ hätte (0–100 %). */
function processShareOfAllCoresPercent(coreEquiv: number, logicalCpus: number): number {
  if (logicalCpus <= 0) return 0;
  return Math.min(100, (coreEquiv / logicalCpus) * 100);
}

function deNum(n: number, frac = 1): string {
  return n.toFixed(frac).replace(".", ",");
}

function maskEmail(email: string): string {
  const [a, d] = email.split("@");
  if (!d) return "***";
  const head = a.length > 2 ? `${a.slice(0, 2)}…` : "…";
  return `${head}@${d}`;
}

function readCredsFile(): Creds | null {
  const p = resolveProjectPath(CREDS_FILE);
  if (!fs.existsSync(p)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(p, "utf8")) as Creds;
    if (j?.email && j?.password) return { email: j.email.trim(), password: j.password };
  } catch {
    return null;
  }
  return null;
}

function writeCredsFile(c: Creds): void {
  const p = resolveProjectPath(CREDS_FILE);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(c, null, 2), "utf8");
}

async function resolveCredentials(
  supabase: SupabaseClient
): Promise<{ creds: Creds; source: string }> {
  const mE = process.env.POSTBOX_MARKUS_EMAIL?.trim();
  const mP = process.env.POSTBOX_MARKUS_PASSWORD?.trim();
  if (mE && mP) return { creds: { email: mE, password: mP }, source: "POSTBOX_MARKUS_* (Umgebung)" };

  const lE = process.env.POSTBOX_LOADTEST_EMAIL?.trim();
  const lP = process.env.POSTBOX_LOADTEST_PASSWORD?.trim();
  if (lE && lP) return { creds: { email: lE, password: lP }, source: "POSTBOX_LOADTEST_* (Umgebung)" };

  const saved = readCredsFile();
  if (saved) return { creds: saved, source: "reports/.markus-loadtest-creds.json" };

  const email = `postbox-markus-loadtest-${Date.now()}@gmail.com`;
  const password = AUTO_MARKUS_PASSWORD;
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    throw new Error(
      `Auto-Registrierung fehlgeschlagen: ${error.message}. Bitte POSTBOX_MARKUS_EMAIL/PASSWORD setzen oder E-Mail-Bestätigung in Supabase für Tests deaktivieren.`
    );
  }
  if (!data.session) {
    throw new Error(
      "Auto-Registrierung: keine Session (vermutlich E-Mail-Bestätigung aktiv). Im Supabase-Dashboard Auth → E-Mail-Bestätigung für Tests aus oder POSTBOX_MARKUS_EMAIL/PASSWORD setzen."
    );
  }
  writeCredsFile({ email, password });
  return { creds: { email, password }, source: "neu registriert (Lasttest-Konto „Markus“)" };
}

function writeHtmlReport(payload: ReportPayload): void {
  const out = resolveProjectPath(HTML_FILE);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const nCores = Math.max(1, payload.logicalCpuCount);
  const totalRam = Math.max(1, payload.totalRamMb);
  const rssPeak = payload.memAfterParallel.rssMb;
  const rssEnd = payload.memAfterSequential.rssMb;
  const peakRamPct = (rssPeak / totalRam) * 100;
  const endRamPct = (rssEnd / totalRam) * 100;

  const parWall = Math.max(1, payload.parallelExtractMs);
  const parEquiv = processCpuCoreEquiv(payload.parallelCpuUser, payload.parallelCpuSystem, parWall);
  const parPct = processShareOfAllCoresPercent(parEquiv, nCores);
  const parCpuS = (payload.parallelCpuUser + payload.parallelCpuSystem) / 1e6;

  const seqWall = Math.max(1, payload.sequentialWallMs);
  const seqEquiv = processCpuCoreEquiv(payload.sequentialCpuUser, payload.sequentialCpuSystem, seqWall);
  const seqPct = processShareOfAllCoresPercent(seqEquiv, nCores);
  const seqCpuS = (payload.sequentialCpuUser + payload.sequentialCpuSystem) / 1e6;

  const maxAi = Math.max(1, ...payload.rows.map((r) => r.msOpenAI));
  const rowsHtml = payload.rows
    .map((r) => {
      const w = Math.round((r.msOpenAI / maxAi) * 100);
      return `<tr>
  <td>${escapeHtml(r.file)}</td>
  <td><code>${escapeHtml(r.documentId)}</code></td>
  <td class="num">${r.msExtract}</td>
  <td class="num">${r.msOpenAI}<div class="bar" style="width:${w}%"></div></td>
  <td class="num">${r.msDb}</td>
  <td class="num">${r.msTotal}</td>
</tr>`;
    })
    .join("\n");

  const errBlock = payload.error
    ? `<section class="err"><h2>Fehler</h2><pre>${escapeHtml(payload.error)}</pre></section>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Postbox Lasttest – Performance</title>
  <style>
    :root { font-family: system-ui, sans-serif; background: #fafafa; color: #18181b; }
    body { max-width: 960px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 1.35rem; }
    h2 { font-size: 1.05rem; margin-top: 1.5rem; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px #0001; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e4e4e7; }
    th { background: #f4f4f5; font-size: 0.75rem; text-transform: uppercase; letter-spacing: .04em; color: #71717a; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .bar { height: 6px; background: #6366f1; border-radius: 3px; margin-top: 6px; max-width: 100%; }
    .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap: 12px; margin: 16px 0; }
    .tile { background: #fff; border-radius: 12px; padding: 14px 16px; box-shadow: 0 1px 3px #0001; }
    .tile p { margin: 0; font-size: 0.8rem; color: #71717a; }
    .tile strong { font-size: 1.25rem; display: block; margin-top: 4px; }
    .note { font-size: 0.9rem; color: #52525b; line-height: 1.5; }
    .err { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin-top: 16px; }
    pre { white-space: pre-wrap; word-break: break-all; font-size: 0.85rem; }
    code { font-size: 0.72rem; }
  </style>
</head>
<body>
  <h1>Postbox Manager – Lasttest &amp; Laufzeit</h1>
  <p class="note">Erzeugt am <strong>${escapeHtml(payload.generatedAt)}</strong> auf diesem Rechner (Node.js).</p>
  <p class="note">Konto: <strong>${escapeHtml(payload.accountLabel)}</strong> (${escapeHtml(payload.emailMasked)}) · Quelle: ${escapeHtml(payload.credsSource)}</p>

  ${errBlock}

  <h2>CPU, RAM &amp; GPU – verständlich</h2>
  <p class="note"><strong>Wichtig:</strong> Gemessen wird nur der <strong>Node.js-Prozess</strong> dieses Lasttests, <strong>nicht</strong> die komplette Windows-Auslastung (Task-Manager-Gesamt). Andere Programme fließen nicht ein.</p>

  <h3>CPU (Prozessor)</h3>
  <p class="note">Dein Rechner meldet <strong>${nCores}</strong> logische CPU(s). Daraus abgeleitete Größen:</p>
  <table>
    <thead><tr><th>Phase</th><th>Wandzeit</th><th>CPU-Zeit nur Node</th><th>Ø „aktive Kerne“</th><th>Anteil aller Kerne*</th></tr></thead>
    <tbody>
      <tr>
        <td>Parallel PDF-Extraktion</td>
        <td class="num">${payload.parallelExtractMs} ms</td>
        <td class="num">${deNum(parCpuS, 2)} s</td>
        <td class="num">≈ ${deNum(parEquiv, 2)}</td>
        <td class="num">≈ ${deNum(parPct, 1)} %</td>
      </tr>
      <tr>
        <td>Sequentiell Upload + Analyse</td>
        <td class="num">${payload.sequentialWallMs} ms</td>
        <td class="num">${deNum(seqCpuS, 2)} s</td>
        <td class="num">≈ ${deNum(seqEquiv, 2)}</td>
        <td class="num">≈ ${deNum(seqPct, 1)} %</td>
      </tr>
    </tbody>
  </table>
  <p class="note">* <strong>Anteil aller Kerne</strong> = (Ø aktive Kerne ÷ ${nCores}) × 100 %. Werte über 100 % sind hier begrenzt. Bei der sequentiellen Phase wartet Node meist auf <strong>Netzwerk (OpenAI)</strong> – dann ist die CPU-Zeit klein, die Wandzeit groß („Prozessor wirkt kaum ausgelastet, aber die Aufgabe dauert lange“).</p>

  <h3>RAM (Arbeitsspeicher)</h3>
  <p class="note">Installiert laut System: <strong>≈ ${deNum(totalRam / 1024, 1)} GiB</strong> (${totalRam} MiB). <strong>RSS</strong> = physischer Speicher, den der Node-Prozess gerade beansprucht (nicht nur JavaScript-Heap).</p>
  <ul class="note">
    <li><strong>Peak nach Parallel-PDF:</strong> ${rssPeak} MiB RSS ≈ <strong>${deNum(peakRamPct, 1)} %</strong> des installierten RAM – kurzer Spitzenwert durch paralleles Parsen.</li>
    <li><strong>Nach allen Analysen:</strong> ${rssEnd} MiB RSS ≈ <strong>${deNum(endRamPct, 1)} %</strong> des installierten RAM.</li>
  </ul>

  <h3>GPU (Grafikkarte)</h3>
  <p class="note"><strong>Praktisch keine Auslastung durch diesen Test.</strong> Es läuft kein lokales KI-Modell auf der GPU; OpenAI wird auf den Servern von OpenAI ausgeführt. Auf deinem PC sind nur Netzwerk, Node und <code>pdf-parse</code> beteiligt – typischerweise <strong>0 % sinnvolle GPU-Last</strong> für diesen Workload (Task-Manager „GPU“ bleibt nahezu unberührt).</p>

  <h2>Kurzüberblick</h2>
  <div class="tiles">
    <div class="tile"><p>Parallel PDF-Extraktion (4×)</p><strong>${payload.parallelExtractMs} ms</strong></div>
    <div class="tile"><p>Sequentiell gesamt (4 Pipelines)</p><strong>${(payload.sequentialWallMs / 1000).toFixed(1)} s</strong></div>
    <div class="tile"><p>Summe OpenAI (nur Wartezeit Client)</p><strong>${payload.rows.reduce((a, r) => a + r.msOpenAI, 0)} ms</strong></div>
    <div class="tile"><p>Summe Extraktion</p><strong>${payload.rows.reduce((a, r) => a + r.msExtract, 0)} ms</strong></div>
  </div>

  <h2>Interpretation (Performance)</h2>
  <ul class="note">
    <li><strong>OpenAI</strong> dominiert die Wandzeit beim sequentiellen Teil (Netzwerk + Modell). Die Balken zeigen die relative OpenAI-Dauer pro Dokument.</li>
    <li><strong>pdf-parse</strong> (Extraktion) belastet kurz <strong>CPU und RAM</strong>; parallel sind mehrere Parser gleichzeitig aktiv.</li>
    <li>Die vier PDFs liegen unter <code>Downloads/postbox-test-documents</code> und wurden in dasselbe Konto hochgeladen wie in der Web-App.</li>
  </ul>

  <h2>Details je Dokument</h2>
  <table>
    <thead><tr><th>Datei</th><th>document_id</th><th>Extraktion ms</th><th>OpenAI ms</th><th>DB ms</th><th>Gesamt ms</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <h2>Speicher (Node process.memoryUsage)</h2>
  <table>
    <thead><tr><th>Phase</th><th>RSS MB</th><th>Heap used MB</th></tr></thead>
    <tbody>
      <tr><td>Vor Parallel-Extraktion</td><td class="num">${payload.memBefore.rssMb}</td><td class="num">${payload.memBefore.heapUsedMb}</td></tr>
      <tr><td>Nach Parallel-Extraktion</td><td class="num">${payload.memAfterParallel.rssMb}</td><td class="num">${payload.memAfterParallel.heapUsedMb}</td></tr>
      <tr><td>Nach 4 Analysen</td><td class="num">${payload.memAfterSequential.rssMb}</td><td class="num">${payload.memAfterSequential.heapUsedMb}</td></tr>
    </tbody>
  </table>

  <h2>Rohwerte CPU (Node, Mikrosekunden)</h2>
  <p class="note">Für Nachvollziehbarkeit: Parallel user ${payload.parallelCpuUser}, system ${payload.parallelCpuSystem} · Sequentiell user ${payload.sequentialCpuUser}, system ${payload.sequentialCpuSystem}</p>
</body>
</html>`;

  fs.writeFileSync(out, html, "utf8");
  console.log("\nHTML-Bericht:", out);
}

async function pipelineOne(
  supabase: SupabaseClient,
  userId: string,
  absPath: string,
  originalFilename: string
): Promise<{ msExtract: number; msOpenAI: number; msDb: number; documentId: string }> {
  const buffer = fs.readFileSync(absPath);
  const mime = "application/pdf";
  const docId = randomUUID();
  const storagePath = `${userId}/${docId}/original.pdf`;
  const content_hash = createHash("sha256").update(buffer).digest("hex");

  await supabase.from("documents").insert({
    id: docId,
    user_id: userId,
    storage_path: storagePath,
    original_filename: originalFilename,
    mime_type: mime,
    file_size: buffer.length,
    content_hash,
    status: "uploaded",
  });

  const { error: upErr } = await supabase.storage.from("documents").upload(storagePath, buffer, {
    contentType: mime,
    upsert: false,
  });
  if (upErr) {
    await supabase.from("documents").delete().eq("id", docId);
    throw upErr;
  }

  await supabase.from("documents").update({ status: "processing" }).eq("id", docId).eq("user_id", userId);

  const tExtract0 = performance.now();
  const extracted = await extractDocumentContent(buffer, mime);
  const msExtract = Math.round(performance.now() - tExtract0);

  const tAi0 = performance.now();
  const analysis = await analyzeWithOpenAI({
    text: extracted.text,
    originalFilename,
    mimeType: mime,
    imageBase64: undefined,
  });
  const msOpenAI = Math.round(performance.now() - tAi0);

  const { data: docRow, error: selErr } = await supabase
    .from("documents")
    .select("created_at")
    .eq("id", docId)
    .single();
  if (selErr || !docRow) throw selErr ?? new Error("Dokument nicht lesbar");

  const category = categoryFromDocumentType(analysis.document_type);
  const names = buildDocumentNamesFromAnalysis({
    documentType: analysis.document_type,
    categoryLabel: category,
    sender: analysis.sender,
    summary: analysis.summary,
    documentDate: analysis.document_date,
    uploadDate: new Date(docRow.created_at),
    extractedText: extracted.text,
  });

  const tDb0 = performance.now();
  const { error: upDocErr } = await supabase
    .from("documents")
    .update({
      display_name: names.display_name,
      internal_name: names.machine_name,
      category,
      status: "processed",
    })
    .eq("id", docId)
    .eq("user_id", userId);
  if (upDocErr) throw upDocErr;

  const rawPayload = { ...analysis } as Record<string, unknown>;
  delete rawPayload.image_transcript;
  const transcript = (analysis.image_transcript ?? "").trim();
  const extractedForDb = [extracted.text.trim(), transcript]
    .filter(Boolean)
    .join("\n\n---\n\n")
    .slice(0, 64_000);

  const { error: metaErr } = await supabase.from("document_metadata").upsert(
    {
      document_id: docId,
      user_id: userId,
      document_type: analysis.document_type,
      sender: analysis.sender,
      document_date: analysis.document_date,
      due_date: analysis.due_date,
      amount: analysis.amount,
      currency: analysis.currency,
      summary: analysis.summary,
      action_required: analysis.action_required,
      action_description: analysis.action_description,
      confidence: analysis.confidence,
      raw_ai_json: rawPayload,
      extracted_text: extractedForDb.length > 0 ? extractedForDb : null,
    },
    { onConflict: "document_id" }
  );
  if (metaErr) throw metaErr;

  const msDb = Math.round(performance.now() - tDb0);
  return { msExtract, msOpenAI, msDb, documentId: docId };
}

async function parallelExtractOnly(buffers: Buffer[]): Promise<number> {
  const t0 = performance.now();
  await Promise.all(buffers.map((b) => extractDocumentContent(b, "application/pdf")));
  return Math.round(performance.now() - t0);
}

async function main() {
  const dir = resolveTestPdfDir();
  console.log("Test-PDF-Ordner:", dir);

  for (const f of NEW_FILES) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) {
      console.error("Fehlt:", p);
      console.error("Bitte zuerst: npm run generate-test-pdfs");
      process.exit(1);
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const buffers = NEW_FILES.map((f) => fs.readFileSync(path.join(dir, f)));

  const payload: ReportPayload = {
    generatedAt: new Date().toISOString(),
    accountLabel: "Markus (Lasttest)",
    emailMasked: "—",
    credsSource: "—",
    parallelExtractMs: 0,
    parallelCpuUser: 0,
    parallelCpuSystem: 0,
    memBefore: memMb(),
    memAfterParallel: memMb(),
    sequentialWallMs: 0,
    sequentialCpuUser: 0,
    sequentialCpuSystem: 0,
    memAfterSequential: memMb(),
    rows: [],
    logicalCpuCount: Math.max(1, os.cpus().length),
    totalRamMb: Math.round(os.totalmem() / 1024 / 1024),
  };

  console.log("\n--- Lokaler CPU-Lastcheck: 4× PDF-Textextraktion parallel ---");
  const cpuPar0 = process.cpuUsage();
  payload.memBefore = memMb();
  payload.parallelExtractMs = await parallelExtractOnly(buffers);
  const cpuPar = process.cpuUsage(cpuPar0);
  payload.parallelCpuUser = cpuPar.user;
  payload.parallelCpuSystem = cpuPar.system;
  payload.memAfterParallel = memMb();
  console.log(`Parallel-Extraktion (4 Dateien): ${payload.parallelExtractMs} ms`);
  console.log(`Speicher RSS: ${payload.memBefore.rssMb} → ${payload.memAfterParallel.rssMb} MB`);

  if (!url || !anon) {
    payload.error = "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY fehlen.";
    writeHtmlReport(payload);
    console.warn(payload.error);
    process.exit(1);
  }

  const supabase = createClient(url, anon);
  let creds: Creds;
  let credsSource: string;
  try {
    const r = await resolveCredentials(supabase);
    creds = r.creds;
    credsSource = r.source;
  } catch (e) {
    payload.error = e instanceof Error ? e.message : String(e);
    writeHtmlReport(payload);
    console.error(payload.error);
    process.exit(1);
  }

  payload.credsSource = credsSource;
  payload.emailMasked = maskEmail(creds.email);

  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (authErr || !auth.session?.user) {
    payload.error = `Login fehlgeschlagen: ${authErr?.message ?? "keine Session"}`;
    writeHtmlReport(payload);
    console.error(payload.error);
    process.exit(1);
  }
  const userId = auth.session.user.id;

  console.log("\n--- Sequentiell: Upload + Analyse (4×, Konto Markus / Lasttest) ---");
  const rows: DocRow[] = [];
  const wall0 = performance.now();
  const cpuSeq0 = process.cpuUsage();

  try {
    for (let i = 0; i < NEW_FILES.length; i += 1) {
      const f = NEW_FILES[i]!;
      const abs = path.join(dir, f);
      console.log(`\n[${i + 1}/4] ${f}`);
      const one0 = performance.now();
      const r = await pipelineOne(supabase, userId, abs, f);
      const msTotal = Math.round(performance.now() - one0);
      console.log(
        `  Extraktion ${r.msExtract} ms · OpenAI ${r.msOpenAI} ms · DB ${r.msDb} ms · Gesamt ${msTotal} ms`
      );
      rows.push({ file: f, documentId: r.documentId, msExtract: r.msExtract, msOpenAI: r.msOpenAI, msDb: r.msDb, msTotal });
    }
  } catch (e) {
    payload.error = e instanceof Error ? e.message : String(e);
    payload.rows = rows;
    payload.sequentialWallMs = Math.round(performance.now() - wall0);
    payload.memAfterSequential = memMb();
    writeHtmlReport(payload);
    throw e;
  }

  payload.sequentialWallMs = Math.round(performance.now() - wall0);
  const cpuSeq = process.cpuUsage(cpuSeq0);
  payload.sequentialCpuUser = cpuSeq.user;
  payload.sequentialCpuSystem = cpuSeq.system;
  payload.memAfterSequential = memMb();
  payload.rows = rows;

  console.log("\n=== Zusammenfassung Lasttest ===");
  console.log(`Wandzeit sequentiell: ${payload.sequentialWallMs} ms`);
  console.log(`Speicher danach:`, payload.memAfterSequential);

  const nC = payload.logicalCpuCount;
  const tr = payload.totalRamMb;
  const pe = processCpuCoreEquiv(payload.parallelCpuUser, payload.parallelCpuSystem, payload.parallelExtractMs);
  const se = processCpuCoreEquiv(payload.sequentialCpuUser, payload.sequentialCpuSystem, payload.sequentialWallMs);
  console.log("\n--- Auslastung (nur Node-Prozess, verständlich) ---");
  console.log(`CPU-Kerne (logisch): ${nC} · RAM installiert ≈ ${(tr / 1024).toFixed(1)} GiB`);
  console.log(
    `Parallel-PDF: Ø ≈ ${pe.toFixed(2)} Kern-Äquivalente ≈ ${processShareOfAllCoresPercent(pe, nC).toFixed(1)} % aller Kerne · Peak RSS ${payload.memAfterParallel.rssMb} MiB ≈ ${((payload.memAfterParallel.rssMb / tr) * 100).toFixed(1)} % vom RAM`
  );
  console.log(
    `Sequentiell:  Ø ≈ ${se.toFixed(2)} Kern-Äquivalente ≈ ${processShareOfAllCoresPercent(se, nC).toFixed(1)} % aller Kerne (viel Wartezeit auf OpenAI)`
  );
  console.log("GPU: für diesen Test typischerweise irrelevant (kein lokales GPU-KI).");

  writeHtmlReport(payload);
  await supabase.auth.signOut().catch(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
