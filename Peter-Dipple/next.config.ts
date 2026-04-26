import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: [
    "192.168.0.84",
    "192.168.0.84:3000",
    "localhost",
    "localhost:3000",
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "192.168.0.84",
        "192.168.0.84:3000",
        "localhost:3000",
      ],
    },
  },
};

export default nextConfig;