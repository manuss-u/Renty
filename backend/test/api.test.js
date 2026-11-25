// Pruebas de la API contra una base PostgreSQL
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "postgres://renty:renty@localhost:5432/renty_test";
process.env.UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "renty-test-"));

const { pool, migrar, q } = await import("../src/db.js");
const { hashPassword } = await import("../src/auth.js");
const { crearApp } = await import("../src/app.js");

let servidor, base;
before(async () => {
  if (!/_test\b|test_/.test(new URL(process.env.DATABASE_URL).pathname))
    throw new Error("Por seguridad, las pruebas solo corren en una base cuyo nombre contenga 'test'");
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await migrar({ silencioso: true });
  await q("INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES ('admin@prueba.co', $1, 'Admin', 'admin')", [await hashPassword("clave-segura")]);
  servidor = crearApp().listen(0);
  await new Promise((r) => servidor.once("listening", r));
  base = `http://localhost:${servidor.address().port}/api`;
});
after(async () => {
  servidor.close();
  await pool.end();
  fs.rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
});

function cliente() {
  let cookie = "";
  return async (ruta, { method = "GET", body, form } = {}) => {
    const headers = cookie ? { cookie } : {};
    if (body) headers["content-type"] = "application/json";
    const res = await fetch(base + ruta, { method, headers, body: form ?? (body && JSON.stringify(body)) });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: res.status, datos: res.status === 204 ? null : await res.json() };
  };
}

const registrar = async (rol, email, extra = {}) => {
  const c = cliente();
  const r = await c("/auth/registro", { method: "POST", body: { rol, email, password: "clave-segura", nombre: "Persona Prueba", telefono: "3001234567", ...extra } });
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  return c;
};

const propiedad = (extra = {}) => {
  const fd = new FormData();
  const datos = { operacion: "renta", tipo: "apartamento", titulo: "Apartamento de prueba", descripcion: "Descripción suficientemente larga para pasar la validación del servidor.",
    ciudad: "Bogotá", zona: "Chapinero", direccion: "Calle 1 # 2-3", precio: "2000000", hab: "2", banos: "1", area: "60", ...extra };
  for (const [k, v] of Object.entries(datos)) [].concat(v).forEach((x) => fd.append(k, x));
  return fd;
};

let arr, prop, inmo, admin, idProp, idInmo;

const ingresar = async (email) => {
  const c = cliente();
  assert.equal((await c("/auth/login", { method: "POST", body: { email, password: "clave-segura" } })).status, 200);
  return c;
};

test("registro valida y no permite correos repetidos", async () => {
  const c = cliente();
  let r = await c("/auth/registro", { method: "POST", body: { rol: "admin", email: "malo", password: "123" } });
  assert.equal(r.status, 400);
  assert.ok(r.datos.detalles.email && r.datos.detalles.rol && r.datos.detalles.password);

  r = await c("/auth/registro", { method: "POST", body: { rol: "admin", email: "colado@prueba.co", password: "clave-segura", nombre: "Colado", telefono: "3001234567" } });
  assert.equal(r.status, 400, "nadie puede registrarse como administrador");
  admin = await ingresar("admin@prueba.co");

  arr = await registrar("arrendatario", "ana@prueba.co");
  prop = await registrar("propietario", "pedro@prueba.co");
  r = await cliente()("/auth/registro", { method: "POST", body: { rol: "propietario", email: "PEDRO@prueba.co", password: "clave-segura", nombre: "Otro", telefono: "3001234567" } });
  assert.equal(r.status, 409);

  r = await cliente()("/auth/registro", { method: "POST", body: { rol: "inmobiliaria", email: "inmo@prueba.co", password: "clave-segura", nombre: "Resp", telefono: "3001234567" } });
  assert.equal(r.status, 400, "la inmobiliaria necesita empresa y NIT");
  inmo = await registrar("inmobiliaria", "inmo@prueba.co", { empresa: "Casa Viva", nit: "900123" });
  assert.equal((await inmo("/auth/yo")).datos.usuario.nombre, "Casa Viva");
});

test("login rechaza contraseña incorrecta y logout cierra la sesión", async () => {
  const c = cliente();
  assert.equal((await c("/auth/login", { method: "POST", body: { email: "ana@prueba.co", password: "otra" } })).status, 401);
  assert.equal((await c("/auth/login", { method: "POST", body: { email: "ana@prueba.co", password: "clave-segura" } })).status, 200);
  assert.equal((await c("/auth/yo")).datos.usuario.rol, "arrendatario");
  await c("/auth/logout", { method: "POST" });
  assert.equal((await c("/favoritos")).status, 401);
});

test("solo propietarios e inmobiliarias publican, con validación", async () => {
  assert.equal((await arr("/propiedades", { method: "POST", form: propiedad() })).status, 403);
  assert.equal((await cliente()("/propiedades", { method: "POST", form: propiedad() })).status, 401);
  const mala = await prop("/propiedades", { method: "POST", form: propiedad({ precio: "-5", ciudad: "Narnia" }) });
  assert.equal(mala.status, 400);
  assert.ok(mala.datos.detalles.precio && mala.datos.detalles.ciudad);

  const fd = propiedad({ amen: ["Mascotas", "Balcón"] });
  fd.append("fotos", new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==", "base64")], { type: "image/png" }), "a.png");
  const r = await prop("/propiedades", { method: "POST", form: fd });
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  assert.deepEqual(r.datos.amenidades, ["Mascotas", "Balcón"]);
  assert.equal(r.datos.fotos.length, 1);
  idProp = r.datos.id;

  const txt = propiedad();
  txt.append("fotos", new Blob(["<script>"], { type: "text/html" }), "x.html");
  assert.equal((await prop("/propiedades", { method: "POST", form: txt })).status, 400);

  idInmo = (await inmo("/propiedades", { method: "POST", form: propiedad({ operacion: "venta", tipo: "casa", ciudad: "Cali", zona: "Pance", precio: "500000000", hab: "4" }) })).datos.id;
});

test("las propiedades nuevas esperan la aprobación de un administrador", async () => {
  assert.equal((await cliente()("/propiedades")).datos.total, 0, "pendientes no son públicas");
  assert.equal((await cliente()("/propiedades/" + idProp)).status, 404);
  assert.equal((await prop("/propiedades/" + idProp)).datos.moderacion, "pendiente", "su dueño sí la ve");
  assert.equal((await prop("/admin/propiedades")).status, 403, "solo administradores moderan");

  const cola = (await admin("/admin/propiedades?moderacion=pendiente")).datos;
  assert.equal(cola.total, 2);
  assert.equal(cola.propiedades[0].direccion, "Calle 1 # 2-3", "el administrador ve la dirección para verificar");

  assert.equal((await admin(`/admin/propiedades/${idInmo}/rechazar`, { method: "POST", body: { motivo: "" } })).status, 400, "rechazar exige motivo");
  await admin(`/admin/propiedades/${idInmo}/rechazar`, { method: "POST", body: { motivo: "Faltan fotos de la fachada" } });
  const rechazada = (await inmo("/mis-propiedades")).datos[0];
  assert.equal(rechazada.moderacion, "rechazada");
  assert.equal(rechazada.motivo_rechazo, "Faltan fotos de la fachada");

  for (const id of [idProp, idInmo]) assert.equal((await admin(`/admin/propiedades/${id}/aprobar`, { method: "POST" })).datos.moderacion, "aprobada");
  assert.equal((await cliente()("/propiedades")).datos.total, 2);
});

test("la búsqueda aplica los filtros y oculta la dirección", async () => {
  const q = async (s) => (await cliente()("/propiedades?" + s)).datos;
  assert.equal((await q("")).total, 2);
  assert.equal((await q("operacion=renta&ciudad=Bogot%C3%A1&amen=Mascotas")).total, 1);
  assert.equal((await q("amen=Mascotas&amen=Piscina")).total, 0);
  assert.equal((await q("tipo=casa&tipo=apartamento")).total, 2);
  assert.equal((await q("hab=3")).total, 1);
  assert.equal((await q("max=3000000")).total, 1);
  assert.equal((await q("pub=inmobiliaria")).propiedades[0].publicador.nombre, "Casa Viva");
  assert.equal((await q("q=chapinero")).total, 1);
  assert.equal((await q("q=%25")).total, 0, "los comodines de LIKE se escapan");
  assert.equal((await q("orden=precio-desc")).propiedades[0].tipo, "casa");

  const publica = (await cliente()("/propiedades/" + idProp)).datos;
  assert.equal(publica.direccion, undefined);
  assert.equal((await prop("/propiedades/" + idProp)).datos.direccion, "Calle 1 # 2-3");
});

test("solo quien publica puede editar, pausar o borrar", async () => {
  assert.equal((await inmo("/propiedades/" + idProp, { method: "PATCH", body: { estado: "pausada" } })).status, 403);
  assert.equal((await prop("/propiedades/" + idProp, { method: "PATCH", body: { estado: "pausada" } })).status, 200);
  assert.equal((await cliente()("/propiedades/" + idProp)).status, 404, "pausada no es pública");
  assert.equal((await prop("/propiedades/" + idProp)).status, 200, "pero su dueño sí la ve");
  await prop("/propiedades/" + idProp, { method: "PATCH", body: { estado: "activa" } });

  const r = await prop("/propiedades/" + idProp, { method: "PUT", form: propiedad({ titulo: "Título editado" }) });
  assert.equal(r.datos.titulo, "Título editado");
  assert.equal(r.datos.fotos.length, 1, "las fotos se conservan al editar");
  assert.equal(r.datos.moderacion, "pendiente", "editar la devuelve a revisión");
  assert.equal((await cliente()("/propiedades/" + idProp)).status, 404);
  await admin(`/admin/propiedades/${idProp}/aprobar`, { method: "POST" });
});

test("favoritos, visitas y mensajes", async () => {
  assert.equal((await arr("/favoritos/" + idProp, { method: "PUT" })).status, 200);
  assert.equal((await arr("/propiedades")).datos.propiedades.find((p) => p.id === idProp).es_favorito, true);
  assert.equal((await prop("/favoritos")).status, 403);

  assert.equal((await arr("/visitas", { method: "POST", body: { propiedad_id: idProp, fecha: "2001-01-01" } })).status, 400);
  const v = await arr("/visitas", { method: "POST", body: { propiedad_id: idProp, fecha: "2099-05-01", hora: "10:00" } });
  assert.equal(v.status, 201);
  assert.equal((await prop("/visitas")).datos.length, 1);
  assert.equal((await arr("/visitas/" + v.datos.id, { method: "PATCH", body: { estado: "confirmada" } })).status, 400, "el arrendatario no confirma");
  assert.equal((await inmo("/visitas/" + v.datos.id, { method: "PATCH", body: { estado: "confirmada" } })).status, 404, "otra cuenta no la ve");
  assert.equal((await prop("/visitas/" + v.datos.id, { method: "PATCH", body: { estado: "confirmada" } })).datos.estado, "confirmada");

  const convs = (await prop("/conversaciones")).datos;
  assert.equal(convs.length, 1, "la visita abrió una conversación");
  await prop(`/conversaciones/${convs[0].id}/mensajes`, { method: "POST", body: { texto: "¡Te espero!" } });
  assert.equal((await arr("/panel/resumen")).datos.no_leidos, 2, "la confirmación automática y el mensaje");
  const msgs = (await arr(`/conversaciones/${convs[0].id}/mensajes`)).datos;
  assert.equal(msgs.at(-1).texto, "¡Te espero!");
  assert.equal((await arr("/panel/resumen")).datos.no_leidos, 0, "leer marca como leídos");
  assert.equal((await inmo(`/conversaciones/${convs[0].id}/mensajes`)).status, 404, "una conversación ajena no se puede leer");
});

test("agentes de inmobiliaria", async () => {
  const a = await inmo("/agentes", { method: "POST", body: { nombre: "Agente Uno", email: "a1@casaviva.co" } });
  assert.equal(a.status, 201);
  assert.equal((await inmo("/agentes", { method: "POST", body: { nombre: "Otra", email: "A1@casaviva.co" } })).status, 409);
  assert.equal((await prop("/agentes")).status, 403);
  const mia = (await inmo("/mis-propiedades")).datos[0];
  assert.equal((await inmo("/propiedades/" + mia.id, { method: "PATCH", body: { agente_id: a.datos.id } })).status, 200);
  assert.equal((await inmo("/agentes")).datos[0].propiedades, 1);
});

test("búsquedas guardadas cuentan resultados", async () => {
  const b = await arr("/busquedas", { method: "POST", body: { nombre: "Casas", filtros: "tipo=casa" } });
  assert.equal(b.status, 201);
  const lista = (await arr("/busquedas")).datos;
  assert.equal(lista[0].total, 1);
  assert.equal((await arr("/busquedas/" + b.datos.id, { method: "DELETE" })).status, 204);
});

test("el administrador destaca propiedades y suspende cuentas", async () => {
  await admin(`/admin/propiedades/${idInmo}`, { method: "PATCH", body: { destacada: true } });
  assert.equal((await cliente()("/propiedades?destacada=1")).datos.propiedades[0].id, idInmo);

  const r = (await admin("/admin/resumen")).datos;
  assert.equal(r.usuarios.inmobiliarias, 1);
  assert.equal(r.propiedades.publicadas, 2);

  const { usuarios } = (await admin("/admin/usuarios?q=casa viva")).datos;
  assert.equal(usuarios.length, 1);
  const idUsuarioInmo = usuarios[0].id;
  assert.equal((await admin("/admin/usuarios/" + idUsuarioInmo, { method: "PATCH", body: { activo: "quizás" } })).status, 400);
  await admin("/admin/usuarios/" + idUsuarioInmo, { method: "PATCH", body: { activo: false } });
  assert.equal((await inmo("/auth/yo")).datos.usuario, null, "la suspensión cierra sus sesiones");
  assert.equal((await cliente()("/auth/login", { method: "POST", body: { email: "inmo@prueba.co", password: "clave-segura" } })).status, 403);
  assert.equal((await cliente()("/propiedades")).datos.total, 1, "sus propiedades dejan de verse");
  await admin("/admin/usuarios/" + idUsuarioInmo, { method: "PATCH", body: { activo: true } });
  assert.equal((await cliente()("/propiedades")).datos.total, 2);

  const yo = (await admin("/auth/yo")).datos.usuario.id;
  assert.equal((await admin("/admin/usuarios/" + yo, { method: "PATCH", body: { activo: false } })).status, 400, "no puede suspenderse a sí mismo");
});

test("ids inválidos no rompen el servidor", async () => {
  assert.equal((await cliente()("/propiedades/99999999999")).status, 400);
  assert.equal((await cliente()("/propiedades/abc")).status, 404);
});

test("borrar una propiedad elimina sus fotos del disco", async () => {
  const antes = fs.readdirSync(process.env.UPLOADS_DIR).length;
  assert.equal((await prop("/propiedades/" + idProp, { method: "DELETE" })).status, 204);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(fs.readdirSync(process.env.UPLOADS_DIR).length, antes - 1);
});
