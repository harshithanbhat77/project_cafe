import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone, so the Docker image doesn't need node_modules.
  output: 'standalone',
  // Don't write AGENTS.md / CLAUDE.md into the repo on `next dev`.
  agentRules: false,
  poweredByHeader: false,
}

export default nextConfig
