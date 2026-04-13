import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Monorepo: trace from repo root (Vercel sets cwd to apps/funnel-dashboard)
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
};

export default nextConfig;
