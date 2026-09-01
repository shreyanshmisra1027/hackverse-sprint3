const esbuild = require("esbuild");
const path = require("path");

const ROOT = __dirname;
const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "public");

async function build() {
  await esbuild.build({
    entryPoints: [path.join(SRC, "network", "app.ts")],
    bundle: true,
    format: "iife",
    target: "es2020",
    outfile: path.join(OUT, "app-bundle.js"),
    platform: "browser",
    sourcemap: false,
    minify: process.env.NODE_ENV === "production",
    define: {
      "process.env.NODE_ENV": JSON.stringify(
        process.env.NODE_ENV || "development"
      ),
    },
  });

  console.log("✅ Build complete → public/app-bundle.js");
}

build().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});
