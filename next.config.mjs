/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // "standalone" produce un build autocontenido (node_modules mínimos) para
  // el Dockerfile. Solo se activa ahí (DOCKER_BUILD=1); en desarrollo local,
  // Netlify o Vercel se usa el build normal.
  output: process.env.DOCKER_BUILD ? "standalone" : undefined,
  // PDFs and other employee documents are served through an authenticated
  // route handler, never from /public.
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb", // payslip / contract PDF uploads
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
