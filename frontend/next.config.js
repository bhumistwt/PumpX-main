/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: config => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    // Ensure @popperjs/core resolves to the CJS bundle that doesn't rely on missing lib files
    config.resolve = config.resolve || {}
    config.resolve.alias = Object.assign({}, config.resolve.alias, {
      '@popperjs/core': require.resolve('@popperjs/core/dist/cjs/popper.js')
    })
    return config
  },
};

module.exports = nextConfig;
