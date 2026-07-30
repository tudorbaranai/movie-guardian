import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow posters/backdrops from TMDB's image server. Next.js then resizes
    // and optimises them for us (faster pages, smaller downloads).
    remotePatterns: [new URL("https://image.tmdb.org/t/p/**")],
  },
};

export default nextConfig;
