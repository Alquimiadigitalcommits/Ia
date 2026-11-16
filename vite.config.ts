import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// La app vive en app/ y se publica desde dist/. Las variables VITE_* se leen del entorno
// (en Netlify: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY, que son públicas por diseño).
export default defineConfig({
  root: "app",
  envDir: "..",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true, sourcemap: true },
});
