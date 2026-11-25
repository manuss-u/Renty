// Carga datos de ejemplo. Borra todo lo que haya en la base de datos.
import { pool, migrar, transaccion } from "./db.js";
import { hashPassword } from "./auth.js";

const PASSWORD_DEMO = "renty123";

const haceDias = (d, horas = 0) => new Date(Date.now() - d * 864e5 - horas * 36e5);
const enDias = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

const USUARIOS = [
  { clave: "camila", email: "arrendatario@renty.app", nombre: "Camila Torres", rol: "arrendatario", telefono: "300 555 0101" },
  { clave: "laura", email: "propietario@renty.app", nombre: "Laura Gómez", rol: "propietario", telefono: "301 555 0102" },
  { clave: "admin", email: "admin@renty.app", nombre: "Equipo Renty", rol: "admin", telefono: "601 555 0100" },
  { clave: "arrayan", email: "inmobiliaria@renty.app", nombre: "Inmobiliaria Arrayán", responsable: "Marcela Duque", nit: "900123456-7", rol: "inmobiliaria", telefono: "604 555 0103" },
  { clave: "andres", email: "andres.rojas@renty.app", nombre: "Andrés Rojas", rol: "propietario", telefono: "302 555 0104" },
  { clave: "habitat", email: "contacto@habitatnorte.co", nombre: "Hábitat Norte", responsable: "Óscar Lozano", nit: "901765432-1", rol: "inmobiliaria", telefono: "602 555 0105" },
  { clave: "julian", email: "julian.perez@renty.app", nombre: "Julián Pérez", rol: "arrendatario", telefono: "310 555 0106" },
  { clave: "maria", email: "maria.ospina@renty.app", nombre: "María Ospina", rol: "arrendatario", telefono: "311 555 0107" },
  { clave: "ricardo", email: "ricardo.salazar@renty.app", nombre: "Ricardo Salazar", rol: "arrendatario", telefono: "312 555 0108" }
];

const AGENTES = [
  { clave: "daniela", de: "arrayan", nombre: "Daniela Ruiz", email: "daniela@arrayan.co", estado: "activo" },
  { clave: "santiago", de: "arrayan", nombre: "Santiago Mejía", email: "santiago@arrayan.co", estado: "activo" },
  { clave: "paula", de: "arrayan", nombre: "Paula Cárdenas", email: "paula@arrayan.co", estado: "activo" },
  { clave: "felipe", de: "arrayan", nombre: "Felipe Arango", email: "felipe@arrayan.co", estado: "invitado" }
];

const PROPIEDADES = [
  { clave: 1, pub: "laura", titulo: "Apartamento luminoso con balcón", operacion: "renta", tipo: "apartamento", ciudad: "Bogotá", zona: "Chapinero Alto", direccion: "Cra 4 # 57-20, apto 702",
    precio: 2400000, administracion: 350000, hab: 2, banos: 2, area: 68, parqueaderos: 1, amen: ["Mascotas", "Balcón", "Ascensor", "Parqueadero", "Vigilancia 24h"], destacada: 1, dias: 10, vistas: 642,
    descripcion: "Apartamento exterior en piso 7 con luz natural todo el día, cocina abierta y balcón con vista a los cerros. A dos cuadras de la carrera Séptima, cerca de cafés, supermercados y transporte." },
  { clave: 2, pub: "arrayan", agente: "daniela", titulo: "Casa familiar con jardín", operacion: "venta", tipo: "casa", ciudad: "Medellín", zona: "Envigado", direccion: "Cl 37 Sur # 43-15",
    precio: 780000000, hab: 4, banos: 3, area: 210, parqueaderos: 2, amen: ["Mascotas", "Parqueadero", "Zona BBQ"], destacada: 1, dias: 13, vistas: 410,
    descripcion: "Casa de dos niveles en barrio residencial tranquilo, con jardín trasero, estudio independiente y garaje para dos vehículos. Colegios y parques a poca distancia." },
  { clave: 3, pub: "laura", titulo: "Estudio amoblado cerca al metro", operacion: "renta", tipo: "estudio", ciudad: "Medellín", zona: "Laureles", direccion: "Cq 74 # 39-50, apto 301",
    precio: 1350000, administracion: 120000, hab: 1, banos: 1, area: 34, amen: ["Amoblado", "Ascensor", "Gimnasio", "Vigilancia 24h"], destacada: 1, dias: 8, vistas: 518,
    descripcion: "Estudio listo para habitar, con cama doble, escritorio, cocina equipada e internet incluido. Ideal para estudiantes o profesionales. Estación del metro a 5 minutos caminando." },
  { clave: 4, pub: "arrayan", agente: "santiago", titulo: "Apartamento con vista al mar", operacion: "venta", tipo: "apartamento", ciudad: "Cartagena", zona: "Bocagrande", direccion: "Av San Martín # 6-120, apto 1504",
    precio: 950000000, hab: 3, banos: 3, area: 140, parqueaderos: 1, amen: ["Piscina", "Gimnasio", "Balcón", "Ascensor", "Parqueadero", "Vigilancia 24h"], destacada: 1, dias: 21, vistas: 733,
    descripcion: "Piso alto con vista directa al mar desde la sala y la habitación principal. Edificio con piscina, gimnasio y acceso a la playa a una cuadra." },
  { clave: 5, pub: "habitat", titulo: "Local comercial sobre avenida principal", operacion: "renta", tipo: "local", ciudad: "Cali", zona: "Granada", direccion: "Av 9 Norte # 15-40",
    precio: 4800000, hab: 0, banos: 1, area: 95, parqueaderos: 2, amen: ["Parqueadero", "Vigilancia 24h"], destacada: 0, dias: 17, vistas: 205,
    descripcion: "Local a nivel de calle con vitrina de 8 metros, alto flujo peatonal y zona gastronómica consolidada. Apto para restaurante, café o tienda." },
  { clave: 6, pub: "arrayan", agente: "paula", titulo: "Oficina moderna en centro empresarial", operacion: "renta", tipo: "oficina", ciudad: "Bogotá", zona: "Chicó", direccion: "Cl 93 # 11-26, of. 504",
    precio: 3600000, administracion: 620000, hab: 0, banos: 2, area: 80, parqueaderos: 2, amen: ["Ascensor", "Parqueadero", "Vigilancia 24h"], destacada: 0, dias: 19, vistas: 151,
    descripcion: "Oficina en planta libre con sala de juntas, recepción y dos baños. Edificio con lobby, seguridad y parqueadero de visitantes." },
  { clave: 7, pub: "habitat", titulo: "Casa campestre con piscina", operacion: "venta", tipo: "casa", ciudad: "Cali", zona: "Pance", direccion: "Condominio Los Samanes, casa 12",
    precio: 1250000000, hab: 5, banos: 4, area: 380, parqueaderos: 3, amen: ["Piscina", "Mascotas", "Parqueadero", "Zona BBQ"], destacada: 0, dias: 29, vistas: 340,
    descripcion: "Casa en condominio campestre con lote de 1.200 m², piscina privada, kiosco y zonas verdes. A 15 minutos de universidades y centros comerciales." },
  { clave: 8, pub: "arrayan", agente: "santiago", titulo: "Apartamento para estrenar", operacion: "venta", tipo: "apartamento", ciudad: "Barranquilla", zona: "Alto Prado", direccion: "Cra 53 # 76-90, apto 802",
    precio: 420000000, hab: 3, banos: 2, area: 92, parqueaderos: 1, amen: ["Ascensor", "Parqueadero", "Piscina", "Gimnasio"], destacada: 0, dias: 15, vistas: 288,
    descripcion: "Apartamento nuevo con acabados de primera, cocina integral y aire acondicionado en todas las habitaciones. Conjunto con piscina y gimnasio." },
  { clave: 9, pub: "andres", titulo: "Apartaestudio a pasos de universidades", operacion: "renta", tipo: "estudio", ciudad: "Bogotá", zona: "Teusaquillo", direccion: "Cl 39 # 17-22, int. 2",
    precio: 1100000, hab: 1, banos: 1, area: 30, amen: ["Amoblado", "Mascotas"], destacada: 0, dias: 1, vistas: 97,
    descripcion: "Apartaestudio independiente en casa remodelada, con entrada propia, cocina y lavadora. Servicios incluidos en el canon." },
  { clave: 10, pub: "laura", titulo: "Casa esquinera con patio", operacion: "renta", tipo: "casa", ciudad: "Barranquilla", zona: "Villa Santos", direccion: "Cl 98 # 52-11",
    precio: 3200000, hab: 3, banos: 3, area: 160, parqueaderos: 1, amen: ["Mascotas", "Parqueadero", "Zona BBQ"], destacada: 0, dias: 24, vistas: 124, estado: "pausada",
    descripcion: "Casa en esquina con buena ventilación, patio amplio, cuarto de servicio y garaje cubierto. Sector residencial con vigilancia de cuadra." },
  { clave: 11, pub: "arrayan", agente: "daniela", titulo: "Dúplex con terraza", operacion: "renta", tipo: "apartamento", ciudad: "Medellín", zona: "El Poblado", direccion: "Cra 37 # 8A-50, PH 1",
    precio: 3900000, administracion: 420000, hab: 3, banos: 3, area: 125, parqueaderos: 2, amen: ["Balcón", "Ascensor", "Parqueadero", "Gimnasio", "Piscina", "Vigilancia 24h"], destacada: 1, dias: 3, vistas: 389,
    descripcion: "Dúplex en último piso con terraza privada, doble altura en la sala y habitación principal con vestier. Unidad cerrada con zonas comunes completas." },
  { clave: 12, pub: "andres", titulo: "Apartamento remodelado", operacion: "venta", tipo: "apartamento", ciudad: "Bogotá", zona: "Cedritos", direccion: "Cl 140 # 13-45, apto 503",
    precio: 365000000, hab: 2, banos: 2, area: 61, parqueaderos: 1, amen: ["Ascensor", "Parqueadero", "Mascotas"], destacada: 1, dias: 6, vistas: 256,
    descripcion: "Apartamento con cocina y baños renovados, pisos en madera laminada y depósito. Cerca de parques, comercio y estación de TransMilenio." },
  // Esperando revisión de un administrador
  { clave: 13, pub: "andres", titulo: "Habitación amoblada en casa compartida", operacion: "renta", tipo: "estudio", ciudad: "Bogotá", zona: "La Soledad", direccion: "Cra 24 # 41-18",
    precio: 850000, hab: 1, banos: 1, area: 18, amen: ["Amoblado"], dias: 0.2, moderacion: "pendiente",
    descripcion: "Habitación amoblada con baño compartido en casa tranquila. Incluye servicios, internet y uso de cocina. Ideal para estudiante." },
  { clave: 14, pub: "habitat", titulo: "Bodega con oficina en zona industrial", operacion: "venta", tipo: "local", ciudad: "Cali", zona: "Acopi", direccion: "Cl 15 # 26-101, bodega 4",
    precio: 1450000000, hab: 0, banos: 2, area: 620, parqueaderos: 4, amen: ["Parqueadero", "Vigilancia 24h"], dias: 1, moderacion: "pendiente",
    descripcion: "Bodega de 620 m² con mezzanine de oficinas, muelle de carga y acceso para tractomulas. Sector con vigilancia privada." },
  // Rechazada: quien publica ve el motivo en su panel
  { clave: 15, pub: "laura", titulo: "Apto barato!!! llamar ya", operacion: "renta", tipo: "apartamento", ciudad: "Bogotá", zona: "Centro", direccion: "Cl 19 # 5-30",
    precio: 900000, hab: 1, banos: 1, area: 40, amen: [], dias: 2, moderacion: "rechazada",
    motivo: "El título no describe la propiedad y la descripción incluye datos de contacto. Edítala y vuelve a enviarla.",
    descripcion: "Apartamento en el centro, llamar al 300 000 0000 para más información y precio especial de contado." }
];

// [propiedad, interesado, [ [autor 'a'=arrendatario | 'p'=publicador, texto, haceHoras] ... ]]
const CONVERSACIONES = [
  [1, "camila", [["a", "Hola, me interesa el apartamento. ¿Sigue disponible?", 30], ["p", "Hola, Camila. Sí, está disponible. ¿Te gustaría visitarlo?", 29], ["a", "Sí, ¿podría ser este fin de semana en la mañana?", 28]]],
  [11, "camila", [["a", "Buenas tardes, ¿el canon incluye administración?", 6], ["p", "Buenas tardes. La administración es aparte: $420.000 al mes.", 1]]],
  [3, "julian", [["a", "Buenas, ¿aceptan mascotas pequeñas?", 3]]],
  [1, "maria", [["a", "¿Qué documentos necesito para aplicar?", 50], ["p", "Cédula, carta laboral y los dos últimos extractos bancarios.", 48]]],
  [4, "ricardo", [["a", "Hola, quisiera conocer el apartamento. ¿Tiene parqueadero cubierto?", 20], ["p", "Hola, Ricardo. Sí, parqueadero cubierto y depósito.", 18]]],
  [2, "maria", [["a", "¿El precio es negociable?", 40], ["p", "Hay un margen pequeño. ¿Quieres agendar una visita?", 36]]],
  [8, "julian", [["a", "¿Cuándo entregan el apartamento?", 100]]]
];

const VISITAS = [
  { prop: 1, quien: "camila", en: 3, hora: "10:00", estado: "confirmada" },
  { prop: 9, quien: "camila", en: 6, hora: "16:30", estado: "pendiente" },
  { prop: 1, quien: "maria", en: 5, hora: "17:00", estado: "pendiente" },
  { prop: 3, quien: "julian", en: 4, hora: "11:30", estado: "pendiente" },
  { prop: 4, quien: "ricardo", en: 2, hora: "15:00", estado: "pendiente" }
];

async function main() {
  await migrar({ silencioso: true });
  const hash = await hashPassword(PASSWORD_DEMO);

  await transaccion(async (c) => {
    const ins = async (sql, params) => (await c.query(sql, params)).rows[0]?.id;
    await c.query(`TRUNCATE mensajes, conversaciones, visitas, busquedas, favoritos, fotos, propiedad_amenidades,
                   propiedades, agentes, sesiones, usuarios RESTART IDENTITY CASCADE`);

    const u = {};
    for (const x of USUARIOS)
      u[x.clave] = await ins("INSERT INTO usuarios (email, password_hash, nombre, responsable, telefono, nit, rol, creado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
        [x.email, hash, x.nombre, x.responsable ?? null, x.telefono, x.nit ?? null, x.rol, haceDias(60)]);

    const ag = {};
    for (const x of AGENTES)
      ag[x.clave] = await ins("INSERT INTO agentes (inmobiliaria_id, nombre, email, estado) VALUES ($1, $2, $3, $4) RETURNING id", [u[x.de], x.nombre, x.email, x.estado]);

    const p = {};
    for (const x of PROPIEDADES) {
      const moderacion = x.moderacion ?? "aprobada";
      const creado = haceDias(x.dias);
      const id = await ins(`INSERT INTO propiedades (publicador_id, agente_id, titulo, descripcion, operacion, tipo, ciudad, zona, direccion, precio, administracion,
          hab, banos, area, parqueaderos, estado, destacada, vistas, moderacion, motivo_rechazo, moderado_por, moderado_en, creado, actualizado)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $23) RETURNING id`,
        [u[x.pub], x.agente ? ag[x.agente] : null, x.titulo, x.descripcion, x.operacion, x.tipo, x.ciudad, x.zona, x.direccion, x.precio, x.administracion ?? null,
          x.hab, x.banos, x.area, x.parqueaderos ?? 0, x.estado ?? "activa", !!x.destacada, x.vistas ?? 0,
          moderacion, x.motivo ?? null, moderacion === "pendiente" ? null : u.admin, moderacion === "pendiente" ? null : creado, creado]);
      p[x.clave] = id;
      if (x.amen.length) await c.query("INSERT INTO propiedad_amenidades (propiedad_id, amenidad) SELECT $1, unnest($2::text[])", [id, x.amen]);
    }

    for (const k of [2, 3, 11]) await c.query("INSERT INTO favoritos (usuario_id, propiedad_id) VALUES ($1, $2)", [u.camila, p[k]]);

    const busq = [
      ["Apartamento en renta en Bogotá con mascotas", "operacion=renta&ciudad=Bogot%C3%A1&tipo=apartamento&hab=2&max=2800000&amen=Mascotas", 12, 20],
      ["Estudio amoblado en Bogotá", "operacion=renta&ciudad=Bogot%C3%A1&tipo=estudio&amen=Amoblado", 4, 15],
      ["Casa en venta con 3+ habitaciones", "operacion=venta&tipo=casa&hab=3&amen=Parqueadero", 2, 9]
    ];
    for (const [nombre, filtros, revision, creado] of busq)
      await c.query("INSERT INTO busquedas (usuario_id, nombre, filtros, ultima_revision, creado) VALUES ($1, $2, $3, $4, $5)", [u.camila, nombre, filtros, haceDias(revision), haceDias(creado)]);

    const pubDe = (k) => u[PROPIEDADES.find((x) => x.clave === k).pub];
    for (const [k, quien, msgs] of CONVERSACIONES) {
      const conv = await ins("INSERT INTO conversaciones (propiedad_id, arrendatario_id, publicador_id, creado) VALUES ($1, $2, $3, $4) RETURNING id",
        [p[k], u[quien], pubDe(k), haceDias(0, msgs[0][2])]);
      for (const [i, [autor, texto, horas]] of msgs.entries())
        await c.query("INSERT INTO mensajes (conversacion_id, autor_id, texto, leido, creado) VALUES ($1, $2, $3, $4, $5)",
          [conv, autor === "a" ? u[quien] : pubDe(k), texto, i < msgs.length - 1, haceDias(0, horas)]);
    }

    for (const x of VISITAS)
      await c.query("INSERT INTO visitas (propiedad_id, arrendatario_id, fecha, hora, estado, creado) VALUES ($1, $2, $3, $4, $5, $6)",
        [p[x.prop], u[x.quien], enDias(x.en), x.hora, x.estado, haceDias(1)]);
  });

  console.log("Datos de ejemplo cargados.");
  console.log(`Cuentas de demostración (contraseña: ${PASSWORD_DEMO}):`);
  for (const rol of ["arrendatario", "propietario", "inmobiliaria", "admin"])
    console.log(`  ${rol.padEnd(13)} ${USUARIOS.find((x) => x.rol === rol).email}`);
}

main()
  .catch((e) => { console.error("No se pudieron cargar los datos:", e.message); process.exitCode = 1; })
  .finally(() => pool.end());
