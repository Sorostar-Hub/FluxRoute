/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@fluxroute/sdk'],
  webpack: (config, { isServer }) => {
    // Handle node modules that need special treatment
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    
    // External Stellar SDK to avoid bundling issues
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push('@stellar/stellar-sdk');
    }
    
    return config;
  },
  // Disable static optimization for pages using client-side features
  experimental: {
    outputFileTracingExcludes: {
      '/**': ['./node_modules/@stellar/**'],
    },
  },
};

export default nextConfig;
