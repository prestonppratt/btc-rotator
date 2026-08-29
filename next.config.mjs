/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: false,
  outputFileTracingRoot: new URL(".", import.meta.url).pathname,
};
export default nextConfig;
