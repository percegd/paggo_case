
/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: `https://paggo-case-o4s3.onrender.com/:path*`, // Proxy to Render Backend
            },
        ];
    },
};

export default nextConfig;
