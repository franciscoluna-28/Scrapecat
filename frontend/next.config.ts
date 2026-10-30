import path from "node:path";
import type { NextConfig } from "next";

const dockerStandalone = process.env.NEXT_OUTPUT === "standalone";

const nextConfig: NextConfig = dockerStandalone
  ? {
      output: "standalone",
      outputFileTracingRoot: path.join(__dirname, ".."),
    }
  : {};

export default nextConfig;
