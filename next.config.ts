import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Serve images straight from TMDB instead of through Vercel's optimizer.
    // TMDB already hosts every poster at the widths we ask for (w185, w342…)
    // on its own CDN, and Vercel's free plan only includes a limited number of
    // image optimizations a month — a busy week of browsing could use them up.
    unoptimized: true,
    // Only TMDB's image server is allowed (matters again if optimization is
    // ever switched back on).
    remotePatterns: [new URL("https://image.tmdb.org/t/p/**")],
  },
};

export default nextConfig;
