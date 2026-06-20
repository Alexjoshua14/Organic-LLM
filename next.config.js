/** @type {import('next').NextConfig} */

/** @type {import('./next.config.local.cjs') | null} */
let localConfig = null;
try {
  // Per-machine dev settings (LAN IP, etc.) — see next.config.local.cjs.example
  localConfig = require("./next.config.local.cjs");
} catch {
  localConfig = null;
}

const nextConfig = {
  allowedDevOrigins: [
    "aetherion.local",
    "192.168.4.31",
    ...(localConfig?.allowedDevOrigins ?? []),
  ],
  transpilePackages: ["@organic-llm/morph-physics"],
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "@radix-ui/react-icons"],
  },
};

module.exports = nextConfig;
