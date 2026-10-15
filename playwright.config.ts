import { readFileSync, existsSync } from "fs";
import { defineConfig, devices } from "@playwright/test";

// mesmo leitor manual de .env.local usado nos scripts em scripts/*.mjs —
// evita depender do pacote dotenv só para isto.
const envPath = ".env.local";
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    if (!line.includes("=") || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    if (!(key in process.env)) process.env[key] = line.slice(i + 1).trim();
  }
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    // Um usuário por combinação de módulos (PD0.3); perfil sem variável é pulado.
    { name: "perfis", testMatch: /perfis\.setup\.ts/ },
    {
      name: "guest",
      testDir: "./e2e/guest",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "authenticated",
      testDir: "./e2e/authenticated",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
    {
      name: "modulos",
      testDir: "./e2e/modulos",
      // O storageState vem de cada perfil, por test.use no spec.
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["perfis"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
