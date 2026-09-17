import type { NextConfig } from "next";

/**
 * La app vive detrás de un Cloudflare Worker que solo proxyea
 * `cristributario.cl/agendar*` y `cristributario.cl/agendamiento-exitoso*`.
 * Por eso los assets de Next (/_next/...) se sirven bajo /agendar/_assets
 * y los route handlers viven en /agendar/api/*.
 */
const nextConfig: NextConfig = {
  assetPrefix: "/agendar/_assets",
  poweredByHeader: false,
};

export default nextConfig;
