/** @type {import('next').NextConfig} */
const nextConfig = {
    allowedDevOrigins: [
	"aetherion.local",
	"192.168.4.31",
    ],
  transpilePackages: ["@organic-llm/morph-physics"],
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "@radix-ui/react-icons"],
  },
};

module.exports = nextConfig;
