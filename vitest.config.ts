import { defineConfig } from "vitest/config";

// Las pruebas viven en tests/ (la configuración de Vite apunta a app/ y no sirve aquí).
export default defineConfig({
  test: { root: ".", include: ["tests/**/*.test.ts"], testTimeout: 20_000 },
});
