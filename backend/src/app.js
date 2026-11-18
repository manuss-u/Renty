import express from "express";
import multer from "multer";
import { config } from "./config.js";
import { cargarUsuario } from "./auth.js";
import { HttpError } from "./errores.js";
import rutasAuth from "./routes/auth.js";
import rutasPropiedades from "./routes/propiedades.js";
import rutasArrendatario from "./routes/arrendatario.js";
import rutasVisitas from "./routes/visitas.js";
import rutasMensajes from "./routes/mensajes.js";
import rutasPanel from "./routes/panel.js";
import rutasAdmin from "./routes/admin.js";

export function crearApp() {
  const app = express();
  app.disable("x-powered-by");
  if (config.produccion) app.set("trust proxy", 1);

  app.use((_req, res, next) => {
    res.set({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Frame-Options": "DENY" });
    next();
  });

  /* ---------- API ---------- */
  const api = express.Router();
  api.use(express.json({ limit: "100kb" }));
  api.use(cargarUsuario);
  api.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  api.get("/salud", (_req, res) => res.json({ ok: true }));
  api.use("/auth", rutasAuth);
  api.use(rutasPropiedades, rutasArrendatario, rutasVisitas, rutasMensajes, rutasPanel, rutasAdmin);
  api.use((_req, _res, next) => next(new HttpError(404, "Ruta no encontrada")));
  app.use("/api", api);

  /* ---------- Archivos ---------- */
  app.use("/uploads", express.static(config.uploadsDir, { maxAge: "7d", index: false }));
  app.use(express.static(config.frontendDir, { extensions: ["html"] }));

  /* ---------- Errores ---------- */
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    let status = err.status || err.statusCode || 500;
    let error = err.message;
    if (err instanceof multer.MulterError) {
      status = 400;
      error = err.code === "LIMIT_FILE_SIZE" ? `Cada foto debe pesar máximo ${config.maxFotoMB} MB`
        : err.code === "LIMIT_FILE_COUNT" ? `Máximo ${config.maxFotos} fotos por propiedad` : "No se pudieron recibir las fotos";
    } else if (err.type === "entity.parse.failed") {
      error = "El cuerpo de la petición no es JSON válido";
    } else if (err.code === "ECONNREFUSED" || err.code === "57P01" || err.code === "3D000" || err.code === "28P01") {
      // PostgreSQL apagado, base de datos inexistente o credenciales malas
      console.error("No hay conexión con PostgreSQL:", err.message);
      status = 503;
      error = "El servicio no está disponible en este momento. Inténtalo de nuevo en unos minutos.";
    } else if (err.code === "22003" || err.code === "22P02") {
      // Número fuera de rango o con formato inválido (p. ej. un id gigante en la URL)
      status = 400;
      error = "Algún valor enviado no es válido";
    } else if (status >= 500) {
      console.error(err);
      error = "Ocurrió un error en el servidor";
    }
    if (!req.path.startsWith("/api")) return res.status(status).type("text").send(error);
    res.status(status).json({ error, ...(err.detalles ? { detalles: err.detalles } : {}) });
  });

  return app;
}
