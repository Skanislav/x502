/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The web package consumes @x502/shared from a workspace dependency; without
  // this, Next's bundler chokes on the workspace symlink during SSR.
  transpilePackages: ["@x502/shared"],
  webpack: (config) => {
    // @x502/shared uses .js suffixes on TS-relative imports (NodeNext convention).
    // Tell webpack to resolve those to the .ts source.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
