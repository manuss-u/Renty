// Aplica las migraciones pendientes de backend/migraciones.   npm run migrate
import { migrar, pool } from "../src/db.js";

try {
  await migrar();
  console.log("Base de datos al día.");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
