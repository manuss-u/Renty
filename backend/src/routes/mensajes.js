import { Router } from "express";
import { q, uno, transaccion, pool } from "../db.js";
import { requiere } from "../auth.js";
import { noEncontrado, v, validar } from "../errores.js";
import { VISIBLE } from "../propiedades-repo.js";

const r = Router();

export async function obtenerOCrearConversacion(propiedad, arrendatarioId, c = pool) {
  const fila = await uno(`
    INSERT INTO conversaciones (propiedad_id, arrendatario_id, publicador_id) VALUES ($1, $2, $3)
    ON CONFLICT (propiedad_id, arrendatario_id) DO UPDATE SET propiedad_id = EXCLUDED.propiedad_id
    RETURNING id`, [propiedad.id, arrendatarioId, propiedad.publicador_id], c);
  return fila.id;
}

export async function agregarMensaje(conversacionId, autorId, texto, c = pool) {
  return uno("INSERT INTO mensajes (conversacion_id, autor_id, texto) VALUES ($1, $2, $3) RETURNING id, autor_id, texto, creado",
    [conversacionId, autorId, texto], c);
}

// Propiedad visible al público
export async function propiedadVisible(id, c = pool) {
  return uno(`SELECT p.id, p.publicador_id FROM propiedades p JOIN usuarios u ON u.id = p.publicador_id WHERE p.id = $1 AND ${VISIBLE}`, [id], c);
}

async function conversacionDe(id, usuario) {
  const c = await uno("SELECT * FROM conversaciones WHERE id = $1", [Number(id) || 0]);
  if (!c || (c.arrendatario_id !== usuario.id && c.publicador_id !== usuario.id)) throw noEncontrado("Conversación", true);
  return c;
}

r.get("/conversaciones", requiere(), async (req, res) => {
  const filas = await q(`
    SELECT c.id, c.propiedad_id, p.titulo AS propiedad_titulo,
      CASE WHEN c.arrendatario_id = $1 THEN up.id ELSE ua.id END AS otro_id,
      CASE WHEN c.arrendatario_id = $1 THEN up.nombre ELSE ua.nombre END AS otro_nombre,
      m.texto AS ultimo_texto, m.creado AS ultimo_creado, m.autor_id AS ultimo_autor,
      (SELECT COUNT(*) FROM mensajes x WHERE x.conversacion_id = c.id AND x.autor_id <> $1 AND NOT x.leido) AS no_leidos
    FROM conversaciones c
    JOIN propiedades p ON p.id = c.propiedad_id
    JOIN usuarios ua ON ua.id = c.arrendatario_id
    JOIN usuarios up ON up.id = c.publicador_id
    LEFT JOIN LATERAL (SELECT * FROM mensajes WHERE conversacion_id = c.id ORDER BY id DESC LIMIT 1) m ON TRUE
    WHERE c.arrendatario_id = $1 OR c.publicador_id = $1
    ORDER BY m.id DESC NULLS LAST`, [req.usuario.id]);
  res.json(filas.map((f) => ({
    id: f.id,
    propiedad: { id: f.propiedad_id, titulo: f.propiedad_titulo },
    con: { id: f.otro_id, nombre: f.otro_nombre },
    ultimo: f.ultimo_texto ? { texto: f.ultimo_texto, creado: f.ultimo_creado, mio: f.ultimo_autor === req.usuario.id } : null,
    no_leidos: f.no_leidos
  })));
});

// El interesado inicia o retoma la conversación
r.post("/conversaciones", requiere("arrendatario"), async (req, res) => {
  const d = validar(req.body, { propiedad_id: v.entero({ min: 1 }), texto: v.texto({ max: 2000 }) });
  const p = await propiedadVisible(d.propiedad_id);
  if (!p) throw noEncontrado("Propiedad", true);
  const id = await transaccion(async (c) => {
    const conv = await obtenerOCrearConversacion(p, req.usuario.id, c);
    await agregarMensaje(conv, req.usuario.id, d.texto, c);
    return conv;
  });
  res.status(201).json({ id });
});

// Devuelve solo los mensajes nuevos
r.get("/conversaciones/:id/mensajes", requiere(), async (req, res) => {
  const c = await conversacionDe(req.params.id, req.usuario);
  const despues = Number(req.query.despues) || 0;
  const mensajes = await q("SELECT id, autor_id, texto, creado FROM mensajes WHERE conversacion_id = $1 AND id > $2 ORDER BY id", [c.id, despues]);
  await q("UPDATE mensajes SET leido = TRUE WHERE conversacion_id = $1 AND autor_id <> $2 AND NOT leido", [c.id, req.usuario.id]);
  res.json(mensajes.map((m) => ({ id: m.id, texto: m.texto, creado: m.creado, mio: m.autor_id === req.usuario.id })));
});

r.post("/conversaciones/:id/mensajes", requiere(), async (req, res) => {
  const c = await conversacionDe(req.params.id, req.usuario);
  const { texto } = validar(req.body, { texto: v.texto({ max: 2000 }) });
  const m = await agregarMensaje(c.id, req.usuario.id, texto);
  res.status(201).json({ id: m.id, texto: m.texto, creado: m.creado, mio: true });
});

export default r;
