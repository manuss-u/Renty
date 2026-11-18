// Favoritos y búsquedas guardadas (solo arrendatarios)
import { Router } from "express";
import { q, uno } from "../db.js";
import { requiere } from "../auth.js";
import { noEncontrado, v, validar } from "../errores.js";
import { contar, hidratar, VISIBLE } from "../propiedades-repo.js";

const r = Router();
const soloArr = requiere("arrendatario");

/* ---------- Favoritos ---------- */
r.get("/favoritos", soloArr, async (req, res) => {
  const filas = await q(`
    SELECT p.*, u.nombre AS pub_nombre, u.rol AS pub_rol
    FROM favoritos f JOIN propiedades p ON p.id = f.propiedad_id JOIN usuarios u ON u.id = p.publicador_id
    WHERE f.usuario_id = $1 AND ${VISIBLE} ORDER BY f.creado DESC`, [req.usuario.id]);
  res.json(await hidratar(filas, req.usuario));
});

r.put("/favoritos/:id", soloArr, async (req, res) => {
  const id = Number(req.params.id) || 0;
  if (!(await uno(`SELECT 1 FROM propiedades p JOIN usuarios u ON u.id = p.publicador_id WHERE p.id = $1 AND ${VISIBLE}`, [id])))
    throw noEncontrado("Propiedad", true);
  await q("INSERT INTO favoritos (usuario_id, propiedad_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [req.usuario.id, id]);
  res.json({ propiedad_id: id, favorito: true });
});

r.delete("/favoritos/:id", soloArr, async (req, res) => {
  const id = Number(req.params.id) || 0;
  await q("DELETE FROM favoritos WHERE usuario_id = $1 AND propiedad_id = $2", [req.usuario.id, id]);
  res.json({ propiedad_id: id, favorito: false });
});

/* ---------- Búsquedas guardadas ---------- */
const filtrosDe = (qs) => {
  const sp = new URLSearchParams(qs);
  return Object.fromEntries([...new Set(sp.keys())].map((k) => {
    const vals = sp.getAll(k);
    return [k, vals.length > 1 ? vals : vals[0]];
  }));
};

r.get("/busquedas", soloArr, async (req, res) => {
  const filas = await q("SELECT * FROM busquedas WHERE usuario_id = $1 ORDER BY creado DESC", [req.usuario.id]);
  res.json(await Promise.all(filas.map(async (b) => {
    const f = filtrosDe(b.filtros);
    const [total, nuevas] = await Promise.all([contar(f), contar({ ...f, desde: b.ultima_revision })]); // nuevas: publicadas desde la última vez que la abrió
    return { id: b.id, nombre: b.nombre, filtros: b.filtros, creado: b.creado, total, nuevas };
  })));
});

r.post("/busquedas", soloArr, async (req, res) => {
  const d = validar(req.body, { nombre: v.texto({ max: 120 }), filtros: v.texto({ max: 1000, opcional: true }) });
  const filtros = new URLSearchParams(d.filtros || "").toString();
  const { id } = await uno("INSERT INTO busquedas (usuario_id, nombre, filtros) VALUES ($1, $2, $3) RETURNING id", [req.usuario.id, d.nombre, filtros]);
  res.status(201).json({ id, nombre: d.nombre, filtros });
});

// Marca la búsqueda como revisada (pone en cero el contador de nuevas)
r.post("/busquedas/:id/revisada", soloArr, async (req, res) => {
  const filas = await q("UPDATE busquedas SET ultima_revision = now() WHERE id = $1 AND usuario_id = $2 RETURNING id", [Number(req.params.id) || 0, req.usuario.id]);
  if (!filas.length) throw noEncontrado("Búsqueda", true);
  res.status(204).end();
});

r.delete("/busquedas/:id", soloArr, async (req, res) => {
  const filas = await q("DELETE FROM busquedas WHERE id = $1 AND usuario_id = $2 RETURNING id", [Number(req.params.id) || 0, req.usuario.id]);
  if (!filas.length) throw noEncontrado("Búsqueda", true);
  res.status(204).end();
});

export default r;
