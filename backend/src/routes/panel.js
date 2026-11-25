import { Router } from "express";
import { q, uno } from "../db.js";
import { requiere } from "../auth.js";
import { HttpError, noEncontrado, v, validar } from "../errores.js";
import { TIPOS, CIUDADES, AMENIDADES } from "../catalogos.js";
import { VISIBLE } from "../propiedades-repo.js";

const r = Router();

// Catálogos
r.get("/catalogos", async (_req, res) => {
  const conteo = Object.fromEntries(Object.keys(TIPOS).map((t) => [t, 0]));
  for (const f of await q(`SELECT p.tipo, COUNT(*) AS n FROM propiedades p JOIN usuarios u ON u.id = p.publicador_id WHERE ${VISIBLE} GROUP BY p.tipo`)) conteo[f.tipo] = f.n;
  res.json({ ciudades: CIUDADES, tipos: TIPOS, amenidades: AMENIDADES, conteo_tipos: conteo });
});

// Resumen de cada panel
r.get("/panel/resumen", requiere("arrendatario", "propietario", "inmobiliaria"), async (req, res) => {
  const yo = req.usuario.id;
  const { no_leidos } = await uno(`
    SELECT COUNT(*) AS no_leidos FROM mensajes m JOIN conversaciones c ON c.id = m.conversacion_id
    WHERE (c.arrendatario_id = $1 OR c.publicador_id = $1) AND m.autor_id <> $1 AND NOT m.leido`, [yo]);

  if (req.usuario.rol === "arrendatario") {
    return res.json({
      ...(await uno(`
        SELECT
          (SELECT COUNT(*) FROM favoritos f JOIN propiedades p ON p.id = f.propiedad_id JOIN usuarios u ON u.id = p.publicador_id WHERE f.usuario_id = $1 AND ${VISIBLE}) AS favoritos,
          (SELECT COUNT(*) FROM busquedas WHERE usuario_id = $1) AS busquedas,
          (SELECT COUNT(*) FROM visitas WHERE arrendatario_id = $1 AND estado IN ('pendiente', 'confirmada') AND fecha >= CURRENT_DATE) AS visitas_proximas`, [yo])),
      no_leidos
    });
  }

  res.json({
    ...(await uno(`
      SELECT
        COUNT(*) AS propiedades,
        COUNT(*) FILTER (WHERE estado = 'activa' AND moderacion = 'aprobada') AS activas,
        COUNT(*) FILTER (WHERE moderacion = 'pendiente') AS en_revision,
        COUNT(*) FILTER (WHERE moderacion = 'rechazada') AS rechazadas,
        COALESCE(SUM(vistas), 0) AS vistas
      FROM propiedades WHERE publicador_id = $1`, [yo])),
    ...(await uno(`
      SELECT
        (SELECT COUNT(*) FROM conversaciones WHERE publicador_id = $1) AS contactos,
        (SELECT COUNT(*) FROM conversaciones WHERE publicador_id = $1 AND creado >= now() - interval '30 days') AS prospectos_30d,
        (SELECT COUNT(*) FROM visitas vi JOIN propiedades p ON p.id = vi.propiedad_id WHERE p.publicador_id = $1 AND vi.estado = 'pendiente' AND vi.fecha >= CURRENT_DATE) AS visitas_pendientes,
        (SELECT COUNT(*) FROM agentes WHERE inmobiliaria_id = $1 AND estado = 'activo') AS agentes`, [yo])),
    no_leidos
  });
});

// Prospectos
r.get("/prospectos", requiere("propietario", "inmobiliaria"), async (req, res) => {
  const filas = await q(`
    SELECT c.id AS conversacion_id, ua.nombre, p.titulo AS propiedad, p.id AS propiedad_id,
      (SELECT MAX(creado) FROM mensajes WHERE conversacion_id = c.id) AS actividad,
      EXISTS (SELECT 1 FROM mensajes WHERE conversacion_id = c.id AND autor_id = c.publicador_id) AS respondido,
      (SELECT estado FROM visitas WHERE propiedad_id = c.propiedad_id AND arrendatario_id = c.arrendatario_id ORDER BY id DESC LIMIT 1) AS visita
    FROM conversaciones c JOIN usuarios ua ON ua.id = c.arrendatario_id JOIN propiedades p ON p.id = c.propiedad_id
    WHERE c.publicador_id = $1 ORDER BY actividad DESC NULLS LAST LIMIT 20`, [req.usuario.id]);
  res.json(filas.map((f) => ({
    ...f,
    estado: f.visita === "confirmada" ? "visita_confirmada" : f.visita === "pendiente" ? "visita_pendiente" : f.respondido ? "en_conversacion" : "nuevo"
  })));
});

// Agentes inmobiliaria
const soloInmo = requiere("inmobiliaria");
const SELECT_AGENTE = `
  SELECT a.id, a.nombre, a.email, a.estado, a.creado,
    (SELECT COUNT(*) FROM propiedades p WHERE p.agente_id = a.id) AS propiedades,
    (SELECT COUNT(*) FROM conversaciones c JOIN propiedades p ON p.id = c.propiedad_id WHERE p.agente_id = a.id) AS prospectos
  FROM agentes a`;

r.get("/agentes", soloInmo, async (req, res) => {
  res.json(await q(`${SELECT_AGENTE} WHERE a.inmobiliaria_id = $1 ORDER BY a.estado = 'invitado', a.nombre`, [req.usuario.id]));
});

r.post("/agentes", soloInmo, async (req, res) => {
  const d = validar(req.body, { nombre: v.texto({ min: 2, max: 100 }), email: v.email() });
  try {
    const { id } = await uno("INSERT INTO agentes (inmobiliaria_id, nombre, email) VALUES ($1, $2, $3) RETURNING id", [req.usuario.id, d.nombre, d.email]);
    res.status(201).json(await uno(`${SELECT_AGENTE} WHERE a.id = $1`, [id]));
  } catch (e) {
    if (e.code === "23505") throw new HttpError(409, "Ese agente ya está en tu equipo", { email: "Ese correo ya está en tu equipo" });
    throw e;
  }
});

r.patch("/agentes/:id", soloInmo, async (req, res) => {
  const d = validar(req.body, { estado: v.opcion(["invitado", "activo"]) });
  const filas = await q("UPDATE agentes SET estado = $1 WHERE id = $2 AND inmobiliaria_id = $3 RETURNING id", [d.estado, Number(req.params.id) || 0, req.usuario.id]);
  if (!filas.length) throw noEncontrado("Agente");
  res.json({ id: filas[0].id, ...d });
});

r.delete("/agentes/:id", soloInmo, async (req, res) => {
  const filas = await q("DELETE FROM agentes WHERE id = $1 AND inmobiliaria_id = $2 RETURNING id", [Number(req.params.id) || 0, req.usuario.id]);
  if (!filas.length) throw noEncontrado("Agente");
  res.status(204).end();
});

export default r;
