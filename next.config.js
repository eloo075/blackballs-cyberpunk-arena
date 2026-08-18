const path = require('path');
const webpack = require('webpack');

const emptyModule = path.join(__dirname, 'lib/empty-module.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // Fix wrong workspace root when another lockfile exists in a parent folder.
  outputFileTracingRoot: path.join(__dirname),
  turbopack: {
    resolveAlias: {
      '@react-native-async-storage/async-storage': './lib/empty-module.js',
    },
  },
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
    };
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^@x402\//, emptyModule),
    );
    return config;
  },
};

module.exports = nextConfig;
