import type { NextConfig } from "next";

const enableHttpsHeaders = process.env.SUPERPRINT_ENABLE_HTTPS_HEADERS === "true";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"} https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https://api.stripe.com https://r.stripe.com https://q.stripe.com https://m.stripe.network ws: wss:",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://*.stripe.com",
  "worker-src 'self' blob:",
  "form-action 'self'",
  ...(enableHttpsHeaders ? ["upgrade-insecure-requests"] : [])
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["ws"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
          ...(enableHttpsHeaders ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
          { key: "Content-Security-Policy", value: contentSecurityPolicy }
        ]
      }
    ];
  }
};

export default nextConfig;
