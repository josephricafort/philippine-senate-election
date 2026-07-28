import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Senator pages/opengraph-images/province-share pages each parse their own slice of the
    // vote dataset during static generation. Next defaults worker count to os.cpus().length - 1,
    // and each worker duplicates whatever it loads — with 260+ statically generated routes,
    // that multiplied per-worker memory blew past the build container's heap limit. Capping
    // workers here bounds peak memory at roughly N worker footprints instead of one per core,
    // at the cost of a slower, more serial build.
    cpus: 2,
  },
};

export default nextConfig;
