import type { NextConfig } from "next";

/** Nur in Production (`next build` / Vercel), nicht im Dev-Server – vermeidet Konflikte mit HMR/Tunnel. */
const productionSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  /**
   * Ohne diese Einträge blockiert `next dev` Anfragen von anderen Hostnamen (DNS-Rebind-Schutz).
   * Sonst funktionieren localhost:3000, aber Cloudflare-Quick-Tunnel / localtunnel nicht zuverlässig.
   * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
   */
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.trycloudflare.dev",
    "*.loca.lt",
    "*.localtunnel.me",
    "*.ngrok-free.app",
    "*.ngrok.io",
    "*.ngrok.app",
  ],
  async headers() {
    if (process.env.NODE_ENV !== "production") {
      return [];
    }
    return [
      {
        source: "/:path*",
        headers: productionSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
