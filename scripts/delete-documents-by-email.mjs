/**
 * Löscht alle Dokumente (Postgres + Storage) für eine E-Mail.
 *
 * Variante A: SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Variante B: POSTBOX_PURGE_EMAIL (= dieselbe E-Mail wie im Aufruf) + POSTBOX_PURGE_PASSWORD
 *
 *   node --env-file=.env.local scripts/delete-documents-by-email.mjs markus.greil@hotmail.de
 *   (PowerShell: npm.cmd run admin:delete-docs -- …)
 */

import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] || "").trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const purgeEmail = (process.env.POSTBOX_PURGE_EMAIL || "").trim().toLowerCase();
const purgePwd = (process.env.POSTBOX_PURGE_PASSWORD || "").trim();

if (!email || !url || !anon) {
  console.error(
    "Aufruf: node --env-file=.env.local scripts/delete-documents-by-email.mjs <email>\n" +
      "Benötigt NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
  process.exit(1);
}

async function countDocs(sb, userId) {
  const { count, error } = await sb
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) return { n: null, error };
  return { n: count ?? 0, error: null };
}

/** Alle direkten Kinder eines Storage-Prefixes (paginiert, Limit 1000 pro Seite). */
async function listAllChildren(sb, prefix) {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb.storage.from("documents").list(prefix, {
      limit: 1000,
      offset,
    });
    if (error) return { data: null, error };
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < 1000) break;
    offset += 1000;
  }
  return { data: out, error: null };
}

async function removeAllStorageForUser(sb, userId) {
  const { data: top, error: l1e } = await listAllChildren(sb, userId);
  if (l1e) {
    console.warn("Storage list", userId + ":", l1e.message);
    return 0;
  }
  let removed = 0;
  for (const entry of top || []) {
    const name = entry.name;
    if (!name) continue;
    const prefix = `${userId}/${name}`;
    const { data: files, error: l2e } = await listAllChildren(sb, prefix);
    if (l2e) {
      console.warn("Storage list", prefix + ":", l2e.message);
      continue;
    }
    const paths = (files || []).map((f) => `${prefix}/${f.name}`);
    if (paths.length) {
      const { error: re } = await sb.storage.from("documents").remove(paths);
      if (re) console.warn("remove", re.message);
      else removed += paths.length;
    }
  }
  return removed;
}

async function purgeAsUser() {
  if (email !== purgeEmail || !purgePwd) {
    console.error(
      "Ohne SUPABASE_SERVICE_ROLE_KEY: setze POSTBOX_PURGE_EMAIL (gleich wie <email>) und POSTBOX_PURGE_PASSWORD in .env.local."
    );
    process.exit(1);
  }
  const sb = createClient(url, anon);
  const { data: auth, error: signErr } = await sb.auth.signInWithPassword({
    email: purgeEmail,
    password: purgePwd,
  });
  if (signErr || !auth.user) {
    console.error("Login fehlgeschlagen:", signErr?.message ?? "kein User");
    process.exit(2);
  }
  const userId = auth.user.id;
  console.log("Angemeldet als:", purgeEmail, "→ user_id:", userId);

  const before = await countDocs(sb, userId);
  console.log("Dokumente in DB (vorher):", before.n ?? "?", before.error?.message ?? "");

  const removed = await removeAllStorageForUser(sb, userId);
  console.log("Storage-Dateien entfernt:", removed);

  const { error: de } = await sb.from("documents").delete().eq("user_id", userId);
  if (de) {
    console.error("documents delete:", de.message);
    process.exit(4);
  }
  const after = await countDocs(sb, userId);
  console.log("Dokumente in DB (nachher):", after.n ?? "?", after.error?.message ?? "");

  await sb.auth.signOut().catch(() => {});
  console.log("Fertig. In der Web-App: Abmelden/neu anmelden oder Seite hart neu laden (Strg+F5).");
}

async function purgeAsAdmin() {
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId = null;
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("listUsers:", error.message);
      process.exit(2);
    }
    const u = data.users.find((x) => (x.email || "").toLowerCase() === email);
    if (u) {
      userId = u.id;
      break;
    }
    if (data.users.length < 200) break;
    page += 1;
  }

  if (!userId) {
    console.error("Kein Auth-Nutzer mit exakt dieser E-Mail:", email);
    console.error(
      "Hinweis: In der App steht oben „Angemeldet als …“ – die Löschung gilt nur für die E-Mail im Befehl."
    );
    process.exit(3);
  }

  console.log("Gefunden:", email, "→ user_id:", userId);

  const before = await countDocs(admin, userId);
  console.log("Dokumente in DB (vorher):", before.n ?? "?", before.error?.message ?? "");

  const removed = await removeAllStorageForUser(admin, userId);
  console.log("Storage-Dateien entfernt:", removed);

  const { error: de } = await admin.from("documents").delete().eq("user_id", userId);
  if (de) {
    console.error("documents delete:", de.message);
    process.exit(4);
  }

  const after = await countDocs(admin, userId);
  console.log("Dokumente in DB (nachher):", after.n ?? "?", after.error?.message ?? "");

  console.log("Fertig. In der Web-App: Abmelden/neu anmelden oder Seite hart neu laden (Strg+F5).");
}

if (serviceKey) {
  await purgeAsAdmin();
} else {
  await purgeAsUser();
}
