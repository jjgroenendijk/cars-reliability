import type { NextConfig } from "next";

const base_path = "";

const nextConfig: NextConfig = {
  output: "export",
  reactCompiler: true,
  images: {
    unoptimized: true,
  },
  basePath: base_path,
  env: {
    NEXT_PUBLIC_BASE_PATH: base_path,
  },
};

export default nextConfig;
