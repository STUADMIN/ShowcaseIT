import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@showcaseit/shared'],
  // Native binaries — must not be bundled into the server chunk
  serverExternalPackages: ['ffmpeg-static', 'docx', 'pdf-lib', 'image-size'],
};

export default nextConfig;
