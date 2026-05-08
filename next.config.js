/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["aetherion.local"],
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "@radix-ui/react-icons"],
  },
};

module.exports = nextConfig;
