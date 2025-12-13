
/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: `${process.env.BACKEND_URL || 'http://localhost:3001'}/:path*`, // Proxy to Backend
            },
        ];
    },
};

export default nextConfig;
