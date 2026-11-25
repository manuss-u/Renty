// Arranca Renty para las pruebas de interfaz: base de pruebas, puerto 3100 y fotos en una carpeta temporal.
// Lo usa `npm run test:e2e`; no hace falta ejecutarlo a mano.
import os from "node:os";
import path from "node:path";
import { E2E_DATABASE_URL, E2E_PUERTO } from "./bd.js";

Object.assign(process.env, {
  DATABASE_URL: E2E_DATABASE_URL,
  PORT: String(E2E_PUERTO),
  UPLOADS_DIR: path.join(os.tmpdir(), "renty-e2e-fotos"),
  LIMITE_LOGIN: "10000" // las pruebas inician sesión muchas veces
});

await import("../backend/src/server.js");
