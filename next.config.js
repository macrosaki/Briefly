/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack config (Next.js 16 uses Turbopack by default)
  turbopack: {},
  // Exclude src directory from TypeScript compilation
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;

