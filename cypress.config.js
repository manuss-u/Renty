import { execFileSync } from "node:child_process";
import { defineConfig } from "cypress";
import { E2E_DATABASE_URL, E2E_PUERTO } from "./cypress/bd.js";

export default defineConfig({
  e2e: {
    baseUrl: `http://localhost:${E2E_PUERTO}`,
    specPattern: "cypress/e2e/**/*.cy.js",
    viewportWidth: 1280,
    viewportHeight: 900,
    video: false,
    defaultCommandTimeout: 8000,
    setupNodeEvents(on) {
      on("task", {
        // Deja la base de pruebas con los datos de ejemplo de `npm run seed`
        reiniciarDatos() {
          execFileSync(process.execPath, ["backend/src/seed.js"], {
            env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
            stdio: "pipe"
          });
          return null;
        }
      });
    }
  }
});
