import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Base pública (ex.: `/financas/` no GitHub Pages). Variável lida no `vite build`. */
function publicBase(): string {
  const raw = process.env.VITE_BASE?.trim();
  if (!raw) return "/";
  const withLeading = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

export default defineConfig({
  base: publicBase(),
  plugins: [react()],
});