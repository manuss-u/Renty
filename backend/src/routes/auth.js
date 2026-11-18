import { Router } from "express";
import rateLimit from "express-rate-limit";
import { q, uno } from "../db.js";
import { HttpError, v, validar } from "../errores.js";
import { ROLES_PUBLICOS } from "../catalogos.js";
import {
  hashPassword, verificarPassword, verificarContraHashFalso,
  crearSesion, cerrarSesion, usuarioPublico
} from "../auth.js";

const r = Router();

// Frena intentos repetidos de adivinar contraseñas
const limite = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LIMITE_LOGIN) || 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." }
});

r.post("/registro", limite, async (req, res) => {
  const base = validar(req.body, {
    rol: v.opcion(ROLES_PUBLICOS),   // nadie puede registrarse como administrador
    email: v.email(),
    password: v.texto({ min: 8, max: 200 }),
    nombre: v.texto({ min: 2, max: 100 }),
    telefono: v.texto({ min: 7, max: 30 })
  });
  const esInmo = base.rol === "inmobiliaria";
  const extra = esInmo ? validar(req.body, { empresa: v.texto({ min: 2, max: 120 }), nit: v.texto({ min: 5, max: 20 }) }) : {};
  if (!/^[0-9 +()-]+$/.test(base.telefono)) throw new HttpError(400, "Revisa los datos enviados", { telefono: "Teléfono no válido" });

  if (await uno("SELECT 1 FROM usuarios WHERE lower(email) = $1", [base.email]))
    throw new HttpError(409, "Ya existe una cuenta con ese correo", { email: "Ya existe una cuenta con ese correo" });

  let u;
  try {
    u = await uno(`
      INSERT INTO usuarios (email, password_hash, nombre, responsable, telefono, nit, rol)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [
      base.email, await hashPassword(base.password),
      esInmo ? extra.empresa : base.nombre, esInmo ? base.nombre : null,
      base.telefono, esInmo ? extra.nit : null, base.rol]);
  } catch (e) {
    // Dos registros simultáneos con el mismo correo: el índice único lo impide
    if (e.code === "23505") throw new HttpError(409, "Ya existe una cuenta con ese correo", { email: "Ya existe una cuenta con ese correo" });
    throw e;
  }

  await crearSesion(res, u.id);
  res.status(201).json({ usuario: usuarioPublico(u) });
});

r.post("/login", limite, async (req, res) => {
  const { email, password } = validar(req.body, { email: v.email(), password: v.texto({ max: 200 }) });
  const u = await uno("SELECT * FROM usuarios WHERE lower(email) = $1", [email]);
  const ok = u ? await verificarPassword(password, u.password_hash) : await verificarContraHashFalso(password);
  if (!ok) throw new HttpError(401, "Correo o contraseña incorrectos");
  if (!u.activo) throw new HttpError(403, "Tu cuenta está suspendida. Escríbenos si crees que es un error.");
  await crearSesion(res, u.id);
  res.json({ usuario: usuarioPublico(u) });
});

r.post("/logout", async (req, res) => {
  await cerrarSesion(req, res);
  res.status(204).end();
});

r.get("/yo", (req, res) => {
  res.json({ usuario: usuarioPublico(req.usuario) });
});

export default r;
