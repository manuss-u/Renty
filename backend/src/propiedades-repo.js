// Consultas de propiedades compartidas por varias rutas
import { q, uno, parametros } from "./db.js";
import { TIPOS, CIUDADES, AMENIDADES } from "./catalogos.js";

const comoLista = (x) => (x === undefined || x === "" ? [] : Array.isArray(x) ? x : [x]);
const numero = (x) => { const n = Number(x); return Number.isFinite(n) && n > 0 ? n : 0; };

// Condición para que el público vea una propiedad
export const VISIBLE = "p.estado = 'activa' AND p.moderacion = 'aprobada' AND u.activo";

export function construirFiltro(f = {}, p = parametros()) {
  const where = [VISIBLE];

  if (["renta", "venta"].includes(f.operacion)) where.push(`p.operacion = ${p.add(f.operacion)}`);
  if (CIUDADES.includes(f.ciudad)) where.push(`p.ciudad = ${p.add(f.ciudad)}`);

  const tipos = comoLista(f.tipo).filter((t) => t in TIPOS);
  if (tipos.length) where.push(`p.tipo = ANY(${p.add(tipos)})`);

  const texto = String(f.q ?? "").trim().slice(0, 80);
  if (texto) {
    const patron = `%${texto.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
    where.push(`unaccent(p.titulo || ' ' || p.zona || ' ' || p.ciudad || ' ' || p.descripcion) ILIKE unaccent(${p.add(patron)})`);
  }

  if (numero(f.min)) where.push(`p.precio >= ${p.add(numero(f.min))}`);
  if (numero(f.max)) where.push(`p.precio <= ${p.add(numero(f.max))}`);
  if (numero(f.hab)) where.push(`p.hab >= ${p.add(numero(f.hab))}`);
  if (numero(f.banos)) where.push(`p.banos >= ${p.add(numero(f.banos))}`);
  if (numero(f.area)) where.push(`p.area >= ${p.add(numero(f.area))}`);

  // Todas las comodidades pedidas deben estar presentes
  const amen = [...new Set(comoLista(f.amen).filter((a) => AMENIDADES.includes(a)))];
  if (amen.length) {
    where.push(`(SELECT COUNT(*) FROM propiedad_amenidades pa WHERE pa.propiedad_id = p.id AND pa.amenidad = ANY(${p.add(amen)})) = ${amen.length}`);
  }

  const pub = comoLista(f.pub).filter((x) => x === "propietario" || x === "inmobiliaria");
  if (pub.length === 1) where.push(`u.rol = ${p.add(pub[0])}`);

  if (f.destacada === "1" || f.destacada === true) where.push("p.destacada");
  if (numero(f.excluir)) where.push(`p.id <> ${p.add(numero(f.excluir))}`);
  if (f.desde) where.push(`p.creado > ${p.add(f.desde)}`);

  return { where: where.join(" AND "), valores: p.valores, p };
}

const ORDENES = {
  reciente: "p.creado DESC, p.id DESC",
  "precio-asc": "p.precio ASC, p.id",
  "precio-desc": "p.precio DESC, p.id",
  "area-desc": "p.area DESC, p.id"
};

export const SELECT_PROP = `
  SELECT p.*, u.nombre AS pub_nombre, u.rol AS pub_rol
  FROM propiedades p JOIN usuarios u ON u.id = p.publicador_id`;

export async function buscar(f = {}, usuario = null) {
  const { where, valores, p } = construirFiltro(f);
  const porPagina = Math.min(Math.max(numero(f.limite) || 24, 1), 60);
  const pagina = Math.max(numero(f.pagina) || 1, 1);
  const orden = ORDENES[f.orden] || ORDENES.reciente;

  // COUNT(*) OVER() trae el total en la misma consulta que la página
  const lim = p.add(porPagina), off = p.add((pagina - 1) * porPagina);
  const filas = await q(`
    SELECT p.*, u.nombre AS pub_nombre, u.rol AS pub_rol, COUNT(*) OVER() AS total
    FROM propiedades p JOIN usuarios u ON u.id = p.publicador_id
    WHERE ${where} ORDER BY ${orden} LIMIT ${lim} OFFSET ${off}`, valores);

  const total = filas[0]?.total ?? (pagina > 1 ? await contar(f) : 0);
  return { total, pagina, por_pagina: porPagina, propiedades: await hidratar(filas, usuario) };
}

export async function contar(f = {}) {
  const { where, valores } = construirFiltro(f);
  return (await uno(`SELECT COUNT(*) AS n FROM propiedades p JOIN usuarios u ON u.id = p.publicador_id WHERE ${where}`, valores)).n;
}

export async function filaPorId(id) {
  return uno(`
    SELECT p.*, u.nombre AS pub_nombre, u.rol AS pub_rol, u.activo AS pub_activo
    FROM propiedades p JOIN usuarios u ON u.id = p.publicador_id WHERE p.id = $1`, [id]);
}

/** Convierte filas de la BD al formato que consume el front. `privado` agrega datos para el dueño o un administrador. */
export async function hidratar(filas, usuario = null, { privado = false } = {}) {
  if (!filas.length) return [];
  const ids = filas.map((f) => f.id);

  const [amenidades, fotos, favoritos] = await Promise.all([
    q("SELECT propiedad_id, amenidad FROM propiedad_amenidades WHERE propiedad_id = ANY($1)", [ids]),
    q("SELECT id, propiedad_id, archivo FROM fotos WHERE propiedad_id = ANY($1) ORDER BY orden, id", [ids]),
    usuario?.rol === "arrendatario"
      ? q("SELECT propiedad_id FROM favoritos WHERE usuario_id = $1 AND propiedad_id = ANY($2)", [usuario.id, ids])
      : []
  ]);

  const amen = new Map(), fts = new Map();
  for (const r of amenidades) (amen.get(r.propiedad_id) ?? amen.set(r.propiedad_id, []).get(r.propiedad_id)).push(r.amenidad);
  for (const r of fotos) (fts.get(r.propiedad_id) ?? fts.set(r.propiedad_id, []).get(r.propiedad_id)).push({ id: r.id, url: `/uploads/${r.archivo}` });
  const favs = new Set(favoritos.map((r) => r.propiedad_id));

  return filas.map((p) => {
    const lista = fts.get(p.id) || [];
    const out = {
      id: p.id,
      titulo: p.titulo,
      descripcion: p.descripcion,
      operacion: p.operacion,
      tipo: p.tipo,
      ciudad: p.ciudad,
      zona: p.zona,
      precio: p.precio,
      administracion: p.administracion,
      hab: p.hab,
      banos: p.banos,
      area: p.area,
      parqueaderos: p.parqueaderos,
      amenidades: (amen.get(p.id) || []).sort((a, b) => AMENIDADES.indexOf(a) - AMENIDADES.indexOf(b)),
      fotos: lista,
      img: lista[0]?.url || "",
      destacada: p.destacada,
      estado: p.estado,
      fecha: p.creado,
      es_favorito: favs.has(p.id),
      publicador: { id: p.publicador_id, nombre: p.pub_nombre, tipo: p.pub_rol }
    };
    if (privado) Object.assign(out, { direccion: p.direccion, moderacion: p.moderacion, motivo_rechazo: p.motivo_rechazo, moderado_en: p.moderado_en, vistas: p.vistas });
    return out;
  });
}
