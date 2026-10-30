import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Matches Vercel's 4.5 MB request body limit; files are capped at 4 MB each in lib/documents.ts.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
};

export default nextConfig;
