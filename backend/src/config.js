import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Toda la configuración sale de variables de entorno, con valores por defecto para desarrollo.
export const config = {
  puerto: Number(process.env.PORT) || 3000,
  produccion: process.env.NODE_ENV === "production",
  databaseUrl: process.env.DATABASE_URL || "postgres://renty:renty@localhost:5432/renty",
  // Proveedores en la nube (Neon, Supabase, RDS…) suelen exigir SSL: DATABASE_SSL=true
  databaseSsl: process.env.DATABASE_SSL === "true",
  migracionesDir: path.join(raiz, "backend", "migraciones"),
  uploadsDir: process.env.UPLOADS_DIR || path.join(raiz, "backend", "uploads"),
  frontendDir: path.join(raiz, "frontend"),
  sesionDias: Number(process.env.SESION_DIAS) || 14,
  maxFotos: 12,
  maxFotoMB: 5
};
