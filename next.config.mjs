/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/tilllinnochendastlinn",
        destination: "/tilllinnochendastlinn.html",
      },
    ];
  },
};

export default nextConfig;
