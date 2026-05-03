/**
 * Deterministic checks for document naming (no test runner dependency).
 *   npx tsx scripts/document-naming-selftest.ts
 */
import assert from "node:assert/strict";
import {
  buildDocumentNamesFromAnalysis,
  cleanSender,
  generateDocumentNames,
  normalizeCategory,
} from "../src/lib/documents/document-naming";

const board = "Dies ist eine Bordkarte für Flug am 28.04.2026";
const boardNames = generateDocumentNames({
  category: "other",
  sender: null,
  topic: board,
  date: "2026-04-28",
});
assert.equal(boardNames.machine_name, "Sonstiges_Unbekannt_Bordkarte_Flug_2026-04-28");
assert.equal(boardNames.display_name, "Bordkarte – Flug 28.04.2026");

assert.equal(normalizeCategory("Rechnungen"), "Rechnung");
assert.equal(normalizeCategory("bank"), "Bank");
assert.equal(cleanSender("Muster GmbH"), "Muster");
assert.equal(cleanSender("A B C AG"), "A B");

const inv = generateDocumentNames({
  category: "Rechnung",
  sender: "OnlineMarkt",
  topic: "Gebühr Kleinanzeigen Mai",
  date: "2026-05-24",
});
assert.ok(inv.machine_name.startsWith("Rechnung_OnlineMarkt_"));
assert.ok(inv.display_name.includes("Rechnung –"));
assert.ok(inv.display_name.includes("24.05.2026"));
assert.ok(!inv.machine_name.includes("__"));

const again = generateDocumentNames({
  category: "other",
  sender: null,
  topic: board,
  date: "2026-04-28",
});
assert.equal(again.machine_name, boardNames.machine_name);

const fromAnalysis = buildDocumentNamesFromAnalysis({
  documentType: "other",
  categoryLabel: "Sonstiges",
  sender: null,
  summary: board,
  documentDate: null,
  uploadDate: new Date("2026-01-15T12:00:00.000Z"),
  extractedText: "",
});
assert.equal(fromAnalysis.machine_name, boardNames.machine_name);

console.log("document-naming-selftest: ok");
