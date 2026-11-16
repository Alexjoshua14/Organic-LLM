/** @type {import('next').NextConfig} */

const { existsSync } = require("node:fs");
const path = require("node:path");

const profileOverridesPath = existsSync(path.join(__dirname, ".local-profile-overrides.ts"))
  ? "./.local-profile-overrides.ts"
  : "./config/empty-profile-overrides.ts";

/** @type {import('./next.config.local.cjs') | null} */
let localConfig = null;
try {
  // Per-machine dev settings (LAN IP, etc.) — see next.config.local.cjs.example
  localConfig = require("./next.config.local.cjs");
} catch {
  localConfig = null;
}

const { version: appVersion } = require("./package.json");

const nextConfig = {
  // Server Function arguments may contain user/session identifiers or private content.
  logging: {
    serverFunctions: false,
    // The loopback OAuth callback carries a one-time authorization code in its query.
    incomingRequests: { ignore: [/\/api\/subscription-chat\/callback/] },
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  allowedDevOrigins: ["aetherion.local", "192.168.4.31", ...(localConfig?.allowedDevOrigins ?? [])],
  transpilePackages: ["@organic-llm/morph-physics"],
  turbopack: {
    resolveAlias: {
      "@/.local-profile-overrides": profileOverridesPath,
    },
  },
  webpack(config) {
    config.resolve.alias["@/.local-profile-overrides"] = path.resolve(
      __dirname,
      profileOverridesPath
    );

    return config;
  },
  experimental: {
    agentUpgrade: "security",
    optimizePackageImports: ["lucide-react", "framer-motion", "@radix-ui/react-icons"],
  },
};

module.exports = nextConfig;
