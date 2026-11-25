import { Router } from "express";
import { q, uno, transaccion } from "../db.js";
import { requiere } from "../auth.js";
import { HttpError, noEncontrado, v, validar } from "../errores.js";
import { obtenerOCrearConversacion, agregarMensaje, propiedadVisible } from "./mensajes.js";

const r = Router();

const SELECT = `
  SELECT vi.*, p.titulo AS propiedad_titulo, p.zona, p.ciudad, p.publicador_id,
         ua.nombre AS arrendatario_nombre, ua.telefono AS arrendatario_telefono, up.nombre AS publicador_nombre
  FROM visitas vi
  JOIN propiedades p ON p.id = vi.propiedad_id
  JOIN usuarios ua ON ua.id = vi.arrendatario_id
  JOIN usuarios up ON up.id = p.publicador_id`;

const formato = (x) => ({
  id: x.id, fecha: x.fecha, hora: x.hora, mensaje: x.mensaje, estado: x.estado, creado: x.creado,
  propiedad: { id: x.propiedad_id, titulo: x.propiedad_titulo, zona: x.zona, ciudad: x.ciudad },
  arrendatario: { id: x.arrendatario_id, nombre: x.arrendatario_nombre, telefono: x.arrendatario_telefono },
  publicador: { id: x.publicador_id, nombre: x.publicador_nombre }
});

// Solicitudes recibidas
r.get("/visitas", requiere("arrendatario", "propietario", "inmobiliaria"), async (req, res) => {
  const columna = req.usuario.rol === "arrendatario" ? "vi.arrendatario_id" : "p.publicador_id";
  const filas = await q(`${SELECT} WHERE ${columna} = $1 ORDER BY (vi.fecha < CURRENT_DATE), vi.fecha, vi.hora`, [req.usuario.id]);
  res.json(filas.map(formato));
});

r.post("/visitas", requiere("arrendatario"), async (req, res) => {
  const d = validar(req.body, {
    propiedad_id: v.entero({ min: 1 }),
    fecha: v.fecha(),
    hora: v.hora({ opcional: true }),
    mensaje: v.texto({ max: 1000, opcional: true })
  });
  if (d.fecha < new Date().toISOString().slice(0, 10)) throw new HttpError(400, "Revisa los datos enviados", { fecha: "La fecha no puede ser anterior a hoy" });
  const p = await propiedadVisible(d.propiedad_id);
  if (!p) throw noEncontrado("Propiedad", true);

  const id = await transaccion(async (c) => {
    const { id } = await uno("INSERT INTO visitas (propiedad_id, arrendatario_id, fecha, hora, mensaje) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [p.id, req.usuario.id, d.fecha, d.hora, d.mensaje], c);
    const conv = await obtenerOCrearConversacion(p, req.usuario.id, c);
    await agregarMensaje(conv, req.usuario.id, ` Solicitud de visita para el ${d.fecha}${d.hora ? " a las " + d.hora : ""}.${d.mensaje ? "\n" + d.mensaje : ""}`, c);
    return id;
  });

  res.status(201).json(formato(await uno(`${SELECT} WHERE vi.id = $1`, [id])));
});

// Quien publica confirma o pide reprogramar y el arrendatario puede cancelar.
r.patch("/visitas/:id", requiere(), async (req, res) => {
  const x = await uno(`${SELECT} WHERE vi.id = $1`, [Number(req.params.id) || 0]);
  if (!x) throw noEncontrado("Visita", true);
  const esPub = x.publicador_id === req.usuario.id;
  const esArr = x.arrendatario_id === req.usuario.id;
  if (!esPub && !esArr) throw noEncontrado("Visita", true);

  const { estado } = validar(req.body, { estado: v.opcion(esPub ? ["confirmada", "reprogramar"] : ["cancelada"]) });
  const textos = {
    confirmada: ` Visita confirmada para el ${x.fecha}${x.hora ? " a las " + x.hora : ""}.`,
    reprogramar: " Esa fecha no me queda bien. ¿Podemos buscar otra?",
    cancelada: " Cancelé la solicitud de visita."
  };
  await transaccion(async (c) => {
    await q("UPDATE visitas SET estado = $2 WHERE id = $1", [x.id, estado], c);
    const conv = await obtenerOCrearConversacion({ id: x.propiedad_id, publicador_id: x.publicador_id }, x.arrendatario_id, c);
    await agregarMensaje(conv, req.usuario.id, textos[estado], c);
  });

  res.json(formato({ ...x, estado }));
});

export default r;
