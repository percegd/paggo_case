
/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: `${process.env.BACKEND_URL || 'https://paggo-case-o4s3.onrender.com'}/:path*`, // Proxy to Backend (or Render fallback)
            },
        ];
    },
};

export default nextConfig;
