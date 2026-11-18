import { crearApp } from "./app.js";
import { config } from "./config.js";
import { pool, migrar, uno } from "./db.js";
import { limpiarSesionesVencidas } from "./auth.js";

async function iniciar() {
  try {
    await migrar();
  } catch (e) {
    console.error(`No se pudo preparar la base de datos (${config.databaseUrl.replace(/:[^:@/]+@/, ":***@")}):\n  ${e.message}`);
    console.error("¿Está PostgreSQL encendido y existe la base de datos? Revisa DATABASE_URL en el README.");
    process.exit(1);
  }

  await limpiarSesionesVencidas();
  setInterval(() => limpiarSesionesVencidas().catch(() => {}), 6 * 60 * 60 * 1000).unref();

  const servidor = crearApp().listen(config.puerto, async () => {
    console.log(`Renty escuchando en http://localhost:${config.puerto}`);
    const { n } = await uno("SELECT COUNT(*) AS n FROM usuarios");
    if (n === 0) console.log("La base de datos está vacía. Ejecuta `npm run seed` para cargar datos de ejemplo, o `npm run crear-admin` para crear el primer administrador.");
  });

  const cerrar = () => servidor.close(() => pool.end().then(() => process.exit(0)));
  process.on("SIGINT", cerrar);
  process.on("SIGTERM", cerrar);
}

iniciar();
