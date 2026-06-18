/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

/** Decode Clerk Frontend API host from publishable key (e.g. central-fawn-21.clerk.accounts.dev). */
function getClerkFapiOrigin() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) return null;

  const encoded = key.split("_").slice(2).join("_");
  if (!encoded) return null;

  try {
    const host = Buffer.from(encoded, "base64").toString("utf8").replace(/\$/, "");
    return host ? `https://${host}` : null;
  } catch {
    return null;
  }
}

const clerkFapiOrigin = getClerkFapiOrigin();

const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  isDev ? "'unsafe-eval'" : null,
  clerkFapiOrigin,
  "https://*.clerk.accounts.dev",
  "https://clerk.com",
  "https://*.clerk.com",
  "https://challenges.cloudflare.com",
  "https://va.vercel-scripts.com",
].filter(Boolean);

const connectSrc = [
  "'self'",
  "https:",
  "wss:",
  clerkFapiOrigin,
  "https://clerk-telemetry.com",
  "https://*.clerk-telemetry.com",
].filter(Boolean);

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSrc.join(" ")}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://geistfont.vercel.app",
  "img-src 'self' data: blob: https: https://img.clerk.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src ${connectSrc.join(" ")}`,
  "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig = {
  allowedDevOrigins: ["aetherion.local"],
  transpilePackages: ["@organic-llm/morph-physics"],
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "@radix-ui/react-icons"],
  },
  async headers() {
    return [
      {
        // Apply document security headers to HTML routes only — not static CSS/JS/font assets.
        source:
          "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)$).*)",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
