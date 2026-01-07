/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude Worker source code from Next.js build
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },
  // Exclude src directory from TypeScript compilation
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;

