import type { NextConfig } from "next";

const is_production = process.env.NODE_ENV === "production";
const base_path = is_production ? "/cars-reliability" : "";

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
