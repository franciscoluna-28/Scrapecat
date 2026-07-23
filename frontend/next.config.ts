import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fabric/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
    ],
  },
};

export default nextConfig;
