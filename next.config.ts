import type { NextConfig } from "next";

process.env.TZ = process.env.TZ || "Asia/Karachi";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "clsx", "tailwind-merge"],
  },
};

export default nextConfig;
