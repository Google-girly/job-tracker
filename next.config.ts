import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Room for a resume + cover letter (10 MB each) in one form submit.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
