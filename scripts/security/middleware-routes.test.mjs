/**
 * Node built-in test runner – keine zusätzlichen Test-Dependencies.
 * Ausführen: npm run test:security
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const middlewarePath = path.join(root, "src", "lib", "supabase", "middleware.ts");
const mw = fs.readFileSync(middlewarePath, "utf8");

describe("middleware auth coverage", () => {
  it("schützt /dokumentenliste (Defense in Depth neben Page-redirect)", () => {
    assert.match(
      mw,
      /path\.startsWith\("\/dokumentenliste"\)/,
      "needsAuth soll /dokumentenliste enthalten"
    );
  });

  it("lässt /auth/callback für E-Mail-Bestätigung zu", () => {
    assert.match(mw, /\/auth\/callback/);
  });
});
