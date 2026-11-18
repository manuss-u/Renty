// Administración: moderación de propiedades y gestión de cuentas. Solo rol "admin".
import { Router } from "express";
import { q, uno, parametros } from "../db.js";
import { requiere, cerrarSesionesDe } from "../auth.js";
import { HttpError, noEncontrado, v, validar } from "../errores.js";
import { ROLES } from "../catalogos.js";
import { hidratar } from "../propiedades-repo.js";
import { eliminarPropiedad } from "./propiedades.js";

const r = Router();
r.use("/admin", requiere("admin"));

const numero = (x) => { const n = Number(x); return Number.isInteger(n) && n > 0 ? n : 0; };
const patron = (texto) => `%${String(texto).trim().slice(0, 80).replace(/[\\%_]/g, (c) => "\\" + c)}%`;

/* ---------- Resumen ---------- */
r.get("/admin/resumen", async (_req, res) => {
  const [usuarios, propiedades, actividad] = await Promise.all([
    uno(`SELECT
        COUNT(*) FILTER (WHERE rol = 'arrendatario') AS arrendatarios,
        COUNT(*) FILTER (WHERE rol = 'propietario') AS propietarios,
        COUNT(*) FILTER (WHERE rol = 'inmobiliaria') AS inmobiliarias,
        COUNT(*) FILTER (WHERE rol = 'admin') AS admins,
        COUNT(*) FILTER (WHERE NOT activo) AS suspendidos,
        COUNT(*) FILTER (WHERE creado >= now() - interval '7 days') AS nuevos_7d
      FROM usuarios`),
    uno(`SELECT
        COUNT(*) FILTER (WHERE moderacion = 'pendiente') AS pendientes,
        COUNT(*) FILTER (WHERE moderacion = 'aprobada' AND estado = 'activa') AS publicadas,
        COUNT(*) FILTER (WHERE moderacion = 'rechazada') AS rechazadas,
        COUNT(*) FILTER (WHERE estado = 'pausada') AS pausadas,
        COUNT(*) AS total
      FROM propiedades`),
    uno(`SELECT
        (SELECT COUNT(*) FROM conversaciones WHERE creado >= now() - interval '7 days') AS conversaciones_7d,
        (SELECT COUNT(*) FROM visitas WHERE creado >= now() - interval '7 days') AS visitas_7d`)
  ]);
  res.json({ usuarios, propiedades, actividad });
});

/* ---------- Propiedades ---------- */
// GET /api/admin/propiedades?moderacion=pendiente&q=&pagina=
r.get("/admin/propiedades", async (req, res) => {
  const p = parametros();
  const where = ["TRUE"];
  if (["pendiente", "aprobada", "rechazada"].includes(req.query.moderacion)) where.push(`p.moderacion = ${p.add(req.query.moderacion)}`);
  if (req.query.q) {
    const t = p.add(patron(req.query.q));
    where.push(`(unaccent(p.titulo || ' ' || p.zona || ' ' || p.ciudad) ILIKE unaccent(${t}) OR unaccent(u.nombre) ILIKE unaccent(${t}) OR u.email ILIKE ${t})`);
  }
  if (numero(req.query.publicador)) where.push(`p.publicador_id = ${p.add(numero(req.query.publicador))}`);
  const porPagina = 20, pagina = Math.max(numero(req.query.pagina), 1);
  // Las pendientes, de la más antigua a la más nueva (orden de llegada); el resto, recientes primero
  const orden = req.query.moderacion === "pendiente" ? "p.actualizado ASC" : "p.actualizado DESC";

  const filas = await q(`
    SELECT p.*, u.nombre AS pub_nombre, u.rol AS pub_rol, u.email AS pub_email, u.activo AS pub_activo,
      m.nombre AS moderador_nombre, COUNT(*) OVER() AS total
    FROM propiedades p JOIN usuarios u ON u.id = p.publicador_id LEFT JOIN usuarios m ON m.id = p.moderado_por
    WHERE ${where.join(" AND ")} ORDER BY ${orden}, p.id LIMIT ${p.add(porPagina)} OFFSET ${p.add((pagina - 1) * porPagina)}`, p.valores);

  const extra = new Map(filas.map((f) => [f.id, f]));
  const propiedades = (await hidratar(filas, null, { privado: true })).map((x) => {
    const f = extra.get(x.id);
    return { ...x, actualizado: f.actualizado, moderador: f.moderador_nombre, publicador: { ...x.publicador, email: f.pub_email, activo: f.pub_activo } };
  });
  res.json({ total: filas[0]?.total ?? 0, pagina, por_pagina: porPagina, propiedades });
});

async function moderar(id, adminId, moderacion, motivo = null) {
  const fila = await uno(`
    UPDATE propiedades SET moderacion = $2, motivo_rechazo = $3, moderado_por = $4, moderado_en = now()
    WHERE id = $1 RETURNING id, moderacion, motivo_rechazo, moderado_en`, [Number(id) || 0, moderacion, motivo, adminId]);
  if (!fila) throw noEncontrado("Propiedad", true);
  return fila;
}

r.post("/admin/propiedades/:id/aprobar", async (req, res) => {
  res.json(await moderar(req.params.id, req.usuario.id, "aprobada"));
});

r.post("/admin/propiedades/:id/rechazar", async (req, res) => {
  const { motivo } = validar(req.body, { motivo: v.texto({ min: 5, max: 500 }) });
  res.json(await moderar(req.params.id, req.usuario.id, "rechazada", motivo));
});

// Destacar en la portada
r.patch("/admin/propiedades/:id", async (req, res) => {
  const { destacada } = validar(req.body, { destacada: v.booleano() });
  const fila = await uno("UPDATE propiedades SET destacada = $2 WHERE id = $1 RETURNING id, destacada", [Number(req.params.id) || 0, destacada]);
  if (!fila) throw noEncontrado("Propiedad", true);
  res.json(fila);
});

r.delete("/admin/propiedades/:id", async (req, res) => {
  const fila = await uno("SELECT id FROM propiedades WHERE id = $1", [Number(req.params.id) || 0]);
  if (!fila) throw noEncontrado("Propiedad", true);
  await eliminarPropiedad(fila.id);
  res.status(204).end();
});

/* ---------- Usuarios ---------- */
// GET /api/admin/usuarios?rol=&estado=activo|suspendido&q=&pagina=
r.get("/admin/usuarios", async (req, res) => {
  const p = parametros();
  const where = ["TRUE"];
  if (ROLES.includes(req.query.rol)) where.push(`u.rol = ${p.add(req.query.rol)}`);
  if (req.query.estado === "activo") where.push("u.activo");
  if (req.query.estado === "suspendido") where.push("NOT u.activo");
  if (req.query.q) {
    const t = p.add(patron(req.query.q));
    where.push(`(unaccent(u.nombre) ILIKE unaccent(${t}) OR u.email ILIKE ${t} OR COALESCE(u.nit, '') ILIKE ${t})`);
  }
  const porPagina = 25, pagina = Math.max(numero(req.query.pagina), 1);
  const filas = await q(`
    SELECT u.id, u.email, u.nombre, u.responsable, u.telefono, u.nit, u.rol, u.activo, u.creado,
      (SELECT COUNT(*) FROM propiedades WHERE publicador_id = u.id) AS propiedades,
      (SELECT MAX(creado) FROM sesiones WHERE usuario_id = u.id) AS ultimo_ingreso,
      COUNT(*) OVER() AS total
    FROM usuarios u WHERE ${where.join(" AND ")}
    ORDER BY u.creado DESC, u.id DESC LIMIT ${p.add(porPagina)} OFFSET ${p.add((pagina - 1) * porPagina)}`, p.valores);
  res.json({ total: filas[0]?.total ?? 0, pagina, por_pagina: porPagina, usuarios: filas.map(({ total, ...u }) => u) });
});

// Suspender o reactivar. Al suspender se cierran sus sesiones y sus propiedades dejan de verse.
r.patch("/admin/usuarios/:id", async (req, res) => {
  const id = Number(req.params.id) || 0;
  const { activo } = validar(req.body, { activo: v.booleano() });
  if (id === req.usuario.id) throw new HttpError(400, "No puedes suspender tu propia cuenta");
  const fila = await uno("UPDATE usuarios SET activo = $2 WHERE id = $1 RETURNING id, activo", [id, activo]);
  if (!fila) throw noEncontrado("Usuario");
  if (!activo) await cerrarSesionesDe(id);
  res.json(fila);
});

export default r;
