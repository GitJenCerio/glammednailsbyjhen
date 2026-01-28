/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year - images are static
    // Enable optimization for local images
    unoptimized: false,
    // Ensure all image extensions are supported
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  compress: true,
  poweredByHeader: false,
  // Performance optimizations
  swcMinify: true,
  reactStrictMode: true,
  // Optimize production builds
  productionBrowserSourceMaps: false,
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Webpack configuration to fix es-toolkit/compat/get import issue
  webpack: (config, { isServer }) => {
    const path = require('path');
    config.resolve.alias = {
      ...config.resolve.alias,
      'es-toolkit/compat/get': path.resolve(__dirname, 'node_modules/es-toolkit/compat/get.js'),
    };
    return config;
  },
}

module.exports = nextConfig

