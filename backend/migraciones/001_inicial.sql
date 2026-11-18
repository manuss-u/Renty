-- Esquema inicial de Renty (PostgreSQL)

-- Para buscar sin importar tildes ("balcon" encuentra "balcón")
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE usuarios (
  id              SERIAL PRIMARY KEY,
  email           TEXT        NOT NULL,
  password_hash   TEXT        NOT NULL,
  nombre          TEXT        NOT NULL,          -- persona, o razón social si es inmobiliaria
  responsable     TEXT,                          -- solo inmobiliaria: persona de contacto
  telefono        TEXT,
  nit             TEXT,                          -- solo inmobiliaria
  rol             TEXT        NOT NULL CHECK (rol IN ('arrendatario', 'propietario', 'inmobiliaria', 'admin')),
  activo          BOOLEAN     NOT NULL DEFAULT TRUE,   -- FALSE = cuenta suspendida por un administrador
  creado          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usuarios_email_unico ON usuarios (lower(email));

CREATE TABLE sesiones (
  token_hash      TEXT        PRIMARY KEY,       -- se guarda el hash, nunca el token en claro
  usuario_id      INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira          TIMESTAMPTZ NOT NULL,
  creado          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sesiones_usuario ON sesiones (usuario_id);

-- Agentes del equipo de una inmobiliaria
CREATE TABLE agentes (
  id              SERIAL PRIMARY KEY,
  inmobiliaria_id INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre          TEXT        NOT NULL,
  email           TEXT        NOT NULL,
  estado          TEXT        NOT NULL DEFAULT 'invitado' CHECK (estado IN ('invitado', 'activo')),
  creado          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX agentes_email_unico ON agentes (inmobiliaria_id, lower(email));

CREATE TABLE propiedades (
  id              SERIAL PRIMARY KEY,
  publicador_id   INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  agente_id       INTEGER     REFERENCES agentes(id) ON DELETE SET NULL,
  titulo          TEXT        NOT NULL,
  descripcion     TEXT        NOT NULL,
  operacion       TEXT        NOT NULL CHECK (operacion IN ('renta', 'venta')),
  tipo            TEXT        NOT NULL,
  ciudad          TEXT        NOT NULL,
  zona            TEXT        NOT NULL,
  direccion       TEXT        NOT NULL,          -- privada: solo la ven quien publica y los administradores
  precio          BIGINT      NOT NULL CHECK (precio > 0),
  administracion  BIGINT,
  hab             SMALLINT    NOT NULL DEFAULT 0 CHECK (hab >= 0),
  banos           SMALLINT    NOT NULL DEFAULT 1 CHECK (banos >= 0),
  area            INTEGER     NOT NULL CHECK (area > 0),
  parqueaderos    SMALLINT    NOT NULL DEFAULT 0,
  -- Lo decide quien publica
  estado          TEXT        NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'pausada')),
  -- Lo decide un administrador. Solo se muestran al público las 'aprobada'.
  moderacion      TEXT        NOT NULL DEFAULT 'pendiente' CHECK (moderacion IN ('pendiente', 'aprobada', 'rechazada')),
  motivo_rechazo  TEXT,
  moderado_por    INTEGER     REFERENCES usuarios(id) ON DELETE SET NULL,
  moderado_en     TIMESTAMPTZ,
  destacada       BOOLEAN     NOT NULL DEFAULT FALSE,
  vistas          INTEGER     NOT NULL DEFAULT 0,
  creado          TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX propiedades_busqueda ON propiedades (operacion, ciudad, tipo, precio) WHERE estado = 'activa' AND moderacion = 'aprobada';
CREATE INDEX propiedades_publicador ON propiedades (publicador_id);
CREATE INDEX propiedades_moderacion ON propiedades (moderacion, creado);

CREATE TABLE propiedad_amenidades (
  propiedad_id    INTEGER     NOT NULL REFERENCES propiedades(id) ON DELETE CASCADE,
  amenidad        TEXT        NOT NULL,
  PRIMARY KEY (propiedad_id, amenidad)
);
CREATE INDEX amenidades_por_nombre ON propiedad_amenidades (amenidad, propiedad_id);

CREATE TABLE fotos (
  id              SERIAL PRIMARY KEY,
  propiedad_id    INTEGER     NOT NULL REFERENCES propiedades(id) ON DELETE CASCADE,
  archivo         TEXT        NOT NULL,          -- nombre del archivo dentro de /uploads
  orden           INTEGER     NOT NULL DEFAULT 0
);
CREATE INDEX fotos_propiedad ON fotos (propiedad_id, orden);

CREATE TABLE favoritos (
  usuario_id      INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  propiedad_id    INTEGER     NOT NULL REFERENCES propiedades(id) ON DELETE CASCADE,
  creado          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, propiedad_id)
);

CREATE TABLE busquedas (
  id              SERIAL PRIMARY KEY,
  usuario_id      INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre          TEXT        NOT NULL,
  filtros         TEXT        NOT NULL,          -- query string, p. ej. "operacion=renta&ciudad=Bogot%C3%A1"
  ultima_revision TIMESTAMPTZ NOT NULL DEFAULT now(),
  creado          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX busquedas_usuario ON busquedas (usuario_id);

CREATE TABLE visitas (
  id              SERIAL PRIMARY KEY,
  propiedad_id    INTEGER     NOT NULL REFERENCES propiedades(id) ON DELETE CASCADE,
  arrendatario_id INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha           DATE        NOT NULL,
  hora            TEXT        CHECK (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  mensaje         TEXT,
  estado          TEXT        NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'reprogramar', 'cancelada')),
  creado          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX visitas_propiedad ON visitas (propiedad_id);
CREATE INDEX visitas_arrendatario ON visitas (arrendatario_id);

-- Una conversación por (propiedad, interesado)
CREATE TABLE conversaciones (
  id              SERIAL PRIMARY KEY,
  propiedad_id    INTEGER     NOT NULL REFERENCES propiedades(id) ON DELETE CASCADE,
  arrendatario_id INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  publicador_id   INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creado          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (propiedad_id, arrendatario_id)
);
CREATE INDEX conversaciones_publicador ON conversaciones (publicador_id);
CREATE INDEX conversaciones_arrendatario ON conversaciones (arrendatario_id);

CREATE TABLE mensajes (
  id              SERIAL PRIMARY KEY,
  conversacion_id INTEGER     NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  autor_id        INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  texto           TEXT        NOT NULL,
  leido           BOOLEAN     NOT NULL DEFAULT FALSE,
  creado          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mensajes_conversacion ON mensajes (conversacion_id, id);
CREATE INDEX mensajes_no_leidos ON mensajes (conversacion_id) WHERE NOT leido;
