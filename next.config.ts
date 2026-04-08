import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
  async redirects() {
    return [
      { source: '/notes', destination: '/todo', permanent: true },
      { source: '/notes/:subjectId', destination: '/todo/:subjectId', permanent: true },
      { source: '/notes/:subjectId/:noteId', destination: '/todo/:subjectId/:noteId', permanent: true },
    ];
  },
};

export default nextConfig;
