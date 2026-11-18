import crypto from "node:crypto";
import { promisify } from "node:util";
import { q, uno } from "./db.js";
import { config } from "./config.js";
import { HttpError, prohibido } from "./errores.js";

const scrypt = promisify(crypto.scrypt);
const COOKIE = "renty_sesion";

/* ---------- Contraseñas (scrypt, incluido en Node) ---------- */
export async function hashPassword(password) {
  const sal = crypto.randomBytes(16);
  const hash = await scrypt(password, sal, 64);
  return `scrypt$${sal.toString("hex")}$${hash.toString("hex")}`;
}

export async function verificarPassword(password, guardado) {
  const [alg, salHex, hashHex] = String(guardado).split("$");
  if (alg !== "scrypt" || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const hash = await scrypt(password, Buffer.from(salHex, "hex"), esperado.length);
  return crypto.timingSafeEqual(hash, esperado);
}

// Hash fijo para comparar cuando el correo no existe, y así no revelar qué correos están registrados por el tiempo de respuesta.
let hashFalso;
export async function verificarContraHashFalso(password) {
  hashFalso ??= await hashPassword("contraseña-que-no-existe");
  await verificarPassword(password, hashFalso);
  return false;
}

/* ---------- Sesiones (token aleatorio en cookie httpOnly; en la BD solo su hash) ---------- */
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

export async function crearSesion(res, usuarioId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + config.sesionDias * 864e5);
  await q("INSERT INTO sesiones (token_hash, usuario_id, expira) VALUES ($1, $2, $3)", [sha256(token), usuarioId, expira]);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: config.produccion, expires: expira, path: "/" });
}

export async function cerrarSesion(req, res) {
  const token = leerCookie(req);
  if (token) await q("DELETE FROM sesiones WHERE token_hash = $1", [sha256(token)]);
  res.clearCookie(COOKIE, { path: "/" });
}

export async function cerrarSesionesDe(usuarioId) {
  await q("DELETE FROM sesiones WHERE usuario_id = $1", [usuarioId]);
}

function leerCookie(req) {
  const header = req.headers.cookie || "";
  for (const parte of header.split(";")) {
    const [k, ...resto] = parte.trim().split("=");
    if (k === COOKIE) return decodeURIComponent(resto.join("="));
  }
  return null;
}

/** Middleware: carga req.usuario si hay sesión válida de una cuenta activa (no obliga a tenerla). */
export async function cargarUsuario(req, _res, next) {
  req.usuario = null;
  const token = leerCookie(req);
  if (token) {
    req.usuario = await uno(`
      SELECT u.id, u.email, u.nombre, u.responsable, u.telefono, u.nit, u.rol
      FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = $1 AND s.expira > now() AND u.activo`, [sha256(token)]);
  }
  next();
}

/** Middleware: exige sesión y, opcionalmente, uno de los roles indicados. */
export const requiere = (...roles) => (req, _res, next) => {
  if (!req.usuario) return next(new HttpError(401, "Debes iniciar sesión"));
  if (roles.length && !roles.includes(req.usuario.rol)) return next(prohibido());
  next();
};

export async function limpiarSesionesVencidas() {
  await q("DELETE FROM sesiones WHERE expira < now()");
}

/** Lo que se expone del usuario al front. */
export const usuarioPublico = (u) => u && ({ id: u.id, email: u.email, nombre: u.nombre, responsable: u.responsable, telefono: u.telefono, rol: u.rol });
