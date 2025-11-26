import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  dts: false,
  outDir: "lib",
  clean: true,
  target: "es2022",
});
