// Conexión a PostgreSQL, ayudas para consultas y migraciones.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { config } from "./config.js";

// BIGINT y COUNT(*) llegan como texto: se convierten a número (los precios caben de sobra en 2^53).
pg.types.setTypeParser(pg.types.builtins.INT8, Number);
// Las fechas sin hora (DATE) se dejan como "AAAA-MM-DD" para que no cambien con la zona horaria.
pg.types.setTypeParser(pg.types.builtins.DATE, (s) => s);

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10
});

pool.on("error", (err) => console.error("Error en una conexión inactiva de PostgreSQL:", err.message));

/** Ejecuta una consulta y devuelve las filas. `c` permite usarla dentro de una transacción. */
export async function q(texto, params = [], c = pool) {
  return (await c.query(texto, params)).rows;
}

/** Primera fila o null. */
export async function uno(texto, params = [], c = pool) {
  return (await c.query(texto, params)).rows[0] ?? null;
}

/** Ejecuta `fn(cliente)` dentro de BEGIN/COMMIT; si algo falla hace ROLLBACK. */
export async function transaccion(fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/**
 * Arma parámetros posicionales ($1, $2…) a medida que se construye una consulta dinámica.
 *   const p = parametros(); where.push(`ciudad = ${p.add("Cali")}`); q(sql, p.valores)
 */
export function parametros(iniciales = []) {
  const valores = [...iniciales];
  return { valores, add: (v) => (valores.push(v), `$${valores.length}`) };
}

/** Aplica, en orden, los archivos .sql de backend/migraciones que aún no se han ejecutado. */
export async function migrar({ silencioso = false } = {}) {
  const c = await pool.connect();
  try {
    // Evita que dos procesos migren al mismo tiempo
    await c.query("SELECT pg_advisory_lock(727001)");
    await c.query(`CREATE TABLE IF NOT EXISTS migraciones (nombre TEXT PRIMARY KEY, aplicada TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const hechas = new Set((await c.query("SELECT nombre FROM migraciones")).rows.map((r) => r.nombre));
    const archivos = fs.readdirSync(config.migracionesDir).filter((f) => f.endsWith(".sql")).sort();
    for (const f of archivos) {
      if (hechas.has(f)) continue;
      const sql = fs.readFileSync(path.join(config.migracionesDir, f), "utf8");
      await c.query("BEGIN");
      try {
        await c.query(sql);
        await c.query("INSERT INTO migraciones (nombre) VALUES ($1)", [f]);
        await c.query("COMMIT");
        if (!silencioso) console.log(`Migración aplicada: ${f}`);
      } catch (e) {
        await c.query("ROLLBACK");
        throw new Error(`Falló la migración ${f}: ${e.message}`);
      }
    }
  } finally {
    await c.query("SELECT pg_advisory_unlock(727001)").catch(() => {});
    c.release();
  }
}
