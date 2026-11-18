// Subida de fotos con multer: solo imágenes, nombre aleatorio, tamaño limitado.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import { config } from "./config.js";
import { HttpError } from "./errores.js";

fs.mkdirSync(config.uploadsDir, { recursive: true });

const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

export const subirFotos = multer({
  storage: multer.diskStorage({
    destination: config.uploadsDir,
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + EXT[file.mimetype])
  }),
  limits: { fileSize: config.maxFotoMB * 1024 * 1024, files: config.maxFotos, fields: 60 },
  fileFilter: (_req, file, cb) =>
    EXT[file.mimetype] ? cb(null, true) : cb(new HttpError(400, "Solo se aceptan fotos JPG, PNG o WebP"))
}).array("fotos", config.maxFotos);

export function borrarArchivos(nombres) {
  for (const n of nombres) {
    const ruta = path.join(config.uploadsDir, path.basename(n));
    fs.rm(ruta, { force: true }, () => {});
  }
}
