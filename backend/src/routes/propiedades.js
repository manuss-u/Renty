import { Router } from "express";
import { q, uno, transaccion } from "../db.js";
import { requiere } from "../auth.js";
import { config } from "../config.js";
import { TIPOS, CIUDADES, AMENIDADES } from "../catalogos.js";
import { HttpError, noEncontrado, prohibido, v, validar } from "../errores.js";
import { buscar, filaPorId, hidratar } from "../propiedades-repo.js";
import { subirFotos, borrarArchivos } from "../subidas.js";

const r = Router();
const PUBLICAN = ["propietario", "inmobiliaria"];

const esquema = {
  operacion: v.opcion(["renta", "venta"]),
  tipo: v.opcion(Object.keys(TIPOS)),
  titulo: v.texto({ min: 5, max: 70 }),
  descripcion: v.texto({ min: 40, max: 3000 }),
  ciudad: v.opcion(CIUDADES),
  zona: v.texto({ max: 80 }),
  direccion: v.texto({ max: 150 }),
  precio: v.entero({ min: 1000, max: 1e13 }),
  administracion: v.entero({ min: 0, max: 1e9, opcional: true }),
  hab: v.entero({ min: 0, max: 30 }),
  banos: v.entero({ min: 0, max: 30 }),
  area: v.entero({ min: 5, max: 1e6 }),
  parqueaderos: v.entero({ min: 0, max: 50, opcional: true }),
  amen: v.lista(AMENIDADES)
};

/** Carga la propiedad y comprueba que el usuario sea quien la publicó. */
async function propiaOFalla(id, usuario) {
  const p = await uno("SELECT * FROM propiedades WHERE id = $1", [Number(id) || 0]);
  if (!p) throw noEncontrado("Propiedad", true);
  if (p.publicador_id !== usuario.id) throw prohibido("Solo quien publicó la propiedad puede modificarla");
  return p;
}

async function guardarAmenidades(c, id, lista) {
  await q("DELETE FROM propiedad_amenidades WHERE propiedad_id = $1", [id], c);
  if (lista.length) await q("INSERT INTO propiedad_amenidades (propiedad_id, amenidad) SELECT $1, unnest($2::text[])", [id, lista], c);
}

async function guardarFotos(c, id, archivos) {
  if (!archivos.length) return;
  const { n } = await uno("SELECT COALESCE(MAX(orden), -1) + 1 AS n FROM fotos WHERE propiedad_id = $1", [id], c);
  await q(`INSERT INTO fotos (propiedad_id, archivo, orden)
           SELECT $1, archivo, $3 + ord - 1 FROM unnest($2::text[]) WITH ORDINALITY AS t(archivo, ord)`,
    [id, archivos.map((f) => f.filename), n], c);
}

// Si algo falla después de subir, se borran los archivos recién guardados.
const conLimpieza = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) { borrarArchivos((req.files || []).map((f) => f.filename)); throw e; }
};

/* ---------- Públicas ---------- */

// GET /api/propiedades?operacion=renta&ciudad=Bogotá&tipo=casa&tipo=apartamento&min=&max=&hab=&banos=&area=&amen=Mascotas&pub=propietario&q=&orden=&limite=&pagina=
r.get("/propiedades", async (req, res) => {
  res.json(await buscar(req.query, req.usuario));
});

r.get("/propiedades/:id", async (req, res) => {
  const fila = await filaPorId(Number(req.params.id) || 0);
  const esDueno = fila && req.usuario?.id === fila.publicador_id;
  const esAdmin = req.usuario?.rol === "admin";
  const visible = fila && fila.estado === "activa" && fila.moderacion === "aprobada" && fila.pub_activo;
  if (!fila || (!visible && !esDueno && !esAdmin)) throw noEncontrado("Propiedad", true);
  if (!esDueno && !esAdmin) await q("UPDATE propiedades SET vistas = vistas + 1 WHERE id = $1", [fila.id]);
  const [p] = await hidratar([fila], req.usuario, { privado: esDueno || esAdmin });
  res.json(p);
});

/* ---------- De quien publica ---------- */

r.get("/mis-propiedades", requiere(...PUBLICAN), async (req, res) => {
  const filas = await q(`
    SELECT p.*, u.nombre AS pub_nombre, u.rol AS pub_rol, a.nombre AS agente_nombre,
      (SELECT COUNT(*) FROM conversaciones c WHERE c.propiedad_id = p.id) AS contactos,
      (SELECT COUNT(*) FROM visitas vi WHERE vi.propiedad_id = p.id AND vi.estado = 'pendiente') AS visitas_pendientes
    FROM propiedades p JOIN usuarios u ON u.id = p.publicador_id LEFT JOIN agentes a ON a.id = p.agente_id
    WHERE p.publicador_id = $1 ORDER BY p.creado DESC, p.id DESC`, [req.usuario.id]);
  const extra = new Map(filas.map((f) => [f.id, f]));
  res.json((await hidratar(filas, req.usuario, { privado: true })).map((p) => {
    const f = extra.get(p.id);
    return { ...p, contactos: f.contactos, visitas_pendientes: f.visitas_pendientes, agente: f.agente_id ? { id: f.agente_id, nombre: f.agente_nombre } : null };
  }));
});

// Las propiedades nuevas quedan pendientes hasta que un administrador las apruebe.
r.post("/propiedades", requiere(...PUBLICAN), subirFotos, conLimpieza(async (req, res) => {
  const d = validar(req.body, esquema);
  const id = await transaccion(async (c) => {
    const { id } = await uno(`
      INSERT INTO propiedades (publicador_id, operacion, tipo, titulo, descripcion, ciudad, zona, direccion, precio, administracion, hab, banos, area, parqueaderos)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
      [req.usuario.id, d.operacion, d.tipo, d.titulo, d.descripcion, d.ciudad, d.zona, d.direccion, d.precio,
        d.operacion === "renta" ? d.administracion : null, d.hab, d.banos, d.area, d.parqueaderos ?? 0], c);
    await guardarAmenidades(c, id, d.amen);
    await guardarFotos(c, id, req.files || []);
    return id;
  });
  const [p] = await hidratar([await filaPorId(id)], req.usuario, { privado: true });
  res.status(201).json(p);
}));

// Editar devuelve la propiedad a revisión: así nadie cambia el anuncio después de aprobado sin que se revise otra vez.
r.put("/propiedades/:id", requiere(...PUBLICAN), subirFotos, conLimpieza(async (req, res) => {
  const actual = await propiaOFalla(req.params.id, req.usuario);
  const d = validar(req.body, esquema);
  const quitar = [].concat(req.body.eliminar_fotos ?? []).map(Number).filter(Boolean);

  const archivosQuitados = await transaccion(async (c) => {
    await q(`
      UPDATE propiedades SET operacion=$2, tipo=$3, titulo=$4, descripcion=$5, ciudad=$6, zona=$7, direccion=$8, precio=$9,
        administracion=$10, hab=$11, banos=$12, area=$13, parqueaderos=$14, actualizado=now(),
        moderacion='pendiente', motivo_rechazo=NULL, moderado_por=NULL, moderado_en=NULL
      WHERE id=$1`,
      [actual.id, d.operacion, d.tipo, d.titulo, d.descripcion, d.ciudad, d.zona, d.direccion, d.precio,
        d.operacion === "renta" ? d.administracion : null, d.hab, d.banos, d.area, d.parqueaderos ?? 0], c);
    await guardarAmenidades(c, actual.id, d.amen);
    const borrados = quitar.length
      ? (await q("DELETE FROM fotos WHERE propiedad_id = $1 AND id = ANY($2) RETURNING archivo", [actual.id, quitar], c)).map((f) => f.archivo)
      : [];
    await guardarFotos(c, actual.id, req.files || []);
    const { n } = await uno("SELECT COUNT(*) AS n FROM fotos WHERE propiedad_id = $1", [actual.id], c);
    if (n > config.maxFotos) throw new HttpError(400, `Máximo ${config.maxFotos} fotos por propiedad`);
    return borrados;
  });
  borrarArchivos(archivosQuitados);

  const [p] = await hidratar([await filaPorId(actual.id)], req.usuario, { privado: true });
  res.json(p);
}));

// Cambios rápidos desde el panel: pausar/activar o asignar agente (no requieren nueva revisión)
r.patch("/propiedades/:id", requiere(...PUBLICAN), async (req, res) => {
  const actual = await propiaOFalla(req.params.id, req.usuario);
  const d = validar(req.body, {
    estado: v.opcion(["activa", "pausada"]),
    agente_id: v.entero({ min: 1, opcional: true })
  }, { parcial: true });

  if ("agente_id" in d) {
    if (req.usuario.rol !== "inmobiliaria") throw prohibido("Solo las inmobiliarias asignan agentes");
    if (d.agente_id && !(await uno("SELECT 1 FROM agentes WHERE id = $1 AND inmobiliaria_id = $2", [d.agente_id, req.usuario.id])))
      throw new HttpError(400, "Ese agente no pertenece a tu equipo");
  }
  if ("estado" in d) await q("UPDATE propiedades SET estado = $2, actualizado = now() WHERE id = $1", [actual.id, d.estado]);
  if ("agente_id" in d) await q("UPDATE propiedades SET agente_id = $2 WHERE id = $1", [actual.id, d.agente_id]);
  res.json({ id: actual.id, ...d });
});

r.delete("/propiedades/:id", requiere(...PUBLICAN), async (req, res) => {
  const actual = await propiaOFalla(req.params.id, req.usuario);
  await eliminarPropiedad(actual.id);
  res.status(204).end();
});

/** Borra la propiedad (y en cascada sus fotos, visitas y mensajes) y los archivos del disco. */
export async function eliminarPropiedad(id) {
  const archivos = (await q("SELECT archivo FROM fotos WHERE propiedad_id = $1", [id])).map((f) => f.archivo);
  await q("DELETE FROM propiedades WHERE id = $1", [id]);
  borrarArchivos(archivos);
}

export default r;
