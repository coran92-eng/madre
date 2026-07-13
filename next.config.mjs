/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PDFs and other employee documents are served through an authenticated
  // route handler, never from /public.
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb", // payslip / contract PDF uploads
    },
  },
};

export default nextConfig;
