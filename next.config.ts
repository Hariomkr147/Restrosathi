import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  agentRules: false,
  experimental: { cpus: 2, serverActions: { bodySizeLimit: "100kb" } },
};

export default createNextIntlPlugin()(nextConfig);
