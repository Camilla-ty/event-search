import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/companies",
        destination: "/sponsors",
        permanent: true,
      },
      {
        source: "/companies/:slug",
        destination: "/sponsors/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
