import type { NextConfig } from "next"

const encoreApiUrl =
  process.env.ENCORE_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://staging-railguard-s4ii.encr.app"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${encoreApiUrl}/:path*`,
      },
    ]
  },
}

export default nextConfig
