import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
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
