import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const indexHtml = join(dist, "index.html");
if (!existsSync(indexHtml)) {
  console.error("dist/index.html not found — run vite build first");
  process.exit(1);
}

copyFileSync(indexHtml, join(dist, "404.html"));
mkdirSync(join(dist, "vaquinhas"), { recursive: true });
copyFileSync(indexHtml, join(dist, "vaquinhas", "index.html"));
console.log("SPA fallback ready: dist/404.html and dist/vaquinhas/index.html");
