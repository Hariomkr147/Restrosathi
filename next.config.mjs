import createNextIntlPlugin from "next-intl/plugin";

const nextConfig = {
  output: process.env.PLAYWRIGHT_TEST ? undefined : "standalone",
  agentRules: false,
  experimental: { cpus: 2, serverActions: { bodySizeLimit: "100kb" } },
};

export default createNextIntlPlugin()(nextConfig);
