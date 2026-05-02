import { NextResponse } from "next/server";

/**
 * Lightweight liveness for uptime monitors. Intentionally no DB call —
 * DB outages should not flip this to 503 unless you add a separate deep check.
 *
 * `vercelEnv` / `gitSha` help confirm which deployment answered (no secrets).
 */
export function GET() {
  const vercelEnv = process.env.VERCEL_ENV;
  const gitSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  return NextResponse.json(
    {
      ok: true,
      service: "postbox-manager",
      ...(vercelEnv ? { vercelEnv } : {}),
      ...(gitSha ? { gitSha } : {}),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
