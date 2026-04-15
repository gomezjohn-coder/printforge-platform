/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/v1/checkout',
        destination: `${process.env.ORDER_SERVICE_URL || 'http://order-service:3003'}/api/v1/checkout`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_INTERNAL_URL || 'http://product-service:3001'}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
