# Renty

Plataforma para buscar propiedades en renta y venta, donde propietarios e inmobiliarias publican sus inmuebles y un equipo de administración los revisa antes de mostrarlos.

- **Front:** HTML, CSS y Bootstrap 5 (`frontend/`)
- **Backend:** Node.js + Express (`backend/`)
- **Base de datos:** PostgreSQL 14 o superior, con el driver `pg`

## Probarlo sin instalar nada (GitHub Codespaces)

Con el proyecto en GitHub: botón verde **Code → Codespaces → Create codespace on main**. En unos minutos se abre VS Code en el navegador, con PostgreSQL, los datos de ejemplo cargados y Renty corriendo. La app se abre en otra pestaña; si no, ve a la pestaña **Ports** y abre el puerto 3000.

Para enseñárselo a alguien en otro dispositivo: en **Ports**, clic derecho sobre el 3000 → **Port Visibility → Public**, y comparte esa dirección. Funciona solo mientras el codespace esté encendido.

La configuración está en `.devcontainer/`. También sirve en VS Code de escritorio con la extensión *Dev Containers* y Docker.

## Cómo correrlo

Necesitas Node.js 20 o superior y PostgreSQL.

### 1. PostgreSQL

**Con Docker** (lo más fácil). Crea las bases `renty` y `renty_test` con usuario y contraseña `renty`:

```bash
docker compose up -d
```

**Sin Docker**, con PostgreSQL instalado, crea el usuario y las bases:

```bash
sudo -u postgres psql -c "CREATE ROLE renty LOGIN PASSWORD 'renty';"
```

```bash
sudo -u postgres createdb -O renty renty
```

```bash
sudo -u postgres createdb -O renty renty_test
```

Si usas otro usuario, contraseña, servidor o un proveedor en la nube, define `DATABASE_URL` (ver *Configuración*).

### 2. La app

```bash
npm install
```

```bash
npm run seed
```

```bash
npm start
```

Abre http://localhost:3000. El servidor aplica las migraciones pendientes al arrancar y entrega el front y la API desde el mismo puerto.

`npm run seed` **borra todos los datos** y carga datos de ejemplo. Cuentas de demostración (contraseña `renty123`):

| Rol | Correo |
|---|---|
| Arrendatario | arrendatario@renty.app |
| Propietario | propietario@renty.app |
| Inmobiliaria | inmobiliaria@renty.app |
| Administrador | admin@renty.app |

### Otros comandos

| Comando | Para qué |
|---|---|
| `npm run dev` | Reinicia el servidor al guardar cambios |
| `npm run migrate` | Aplica las migraciones pendientes sin arrancar el servidor |
| `npm run crear-admin` | Crea un administrador, o convierte en administrador una cuenta existente |
| `npm test` | Pruebas de la API contra `renty_test` (la base de pruebas se borra en cada corrida) |

## Administradores

Nadie puede registrarse como administrador desde la web. Para crear el primero en producción:

```bash
npm run crear-admin
```

El script pide correo, nombre y contraseña. En un servidor sin terminal interactiva, pásalos como variables de entorno:

```bash
ADMIN_EMAIL=ana@renty.co ADMIN_NOMBRE="Ana Díaz" ADMIN_PASSWORD="una-clave-larga" npm run crear-admin
```

El administrador entra por el login normal y tiene dos pantallas:

- **Moderación** (`panel-admin.html`): cola de propiedades pendientes, en orden de llegada. Desde ahí aprueba, rechaza con un motivo (quien publica lo ve en su panel), destaca en la portada o elimina. También puede revisar cada anuncio completo, con la dirección, en su página de detalle.
- **Usuarios** (`admin-usuarios.html`): busca por nombre, correo o NIT y filtra por rol o estado. Puede suspender o reactivar cuentas. Una cuenta suspendida no puede ingresar, sus sesiones se cierran y sus propiedades dejan de verse.

### Cómo funciona la moderación

- Toda propiedad nueva queda **en revisión** y solo la ve quien la publicó.
- **Editar** una propiedad la devuelve a revisión, para que nadie cambie un anuncio ya aprobado sin que se revise otra vez. Pausar o activar, o asignar un agente, no la devuelve a revisión.
- El público ve una propiedad solo si está **aprobada**, **activa** (no pausada) y su publicador **no está suspendido**.

## Configuración

Variables de entorno (ver `.env.example`):

| Variable | Por defecto | Para qué |
|---|---|---|
| `DATABASE_URL` | `postgres://renty:renty@localhost:5432/renty` | Conexión a PostgreSQL |
| `DATABASE_SSL` | — | `true` para proveedores que exigen SSL (Neon, Supabase, RDS, Render…) |
| `TEST_DATABASE_URL` | `postgres://renty:renty@localhost:5432/renty_test` | Base para `npm test`; su nombre debe contener `test` |
| `PORT` | `3000` | Puerto del servidor |
| `NODE_ENV` | — | `production` al publicar: activa cookies `Secure` (requiere HTTPS) |
| `UPLOADS_DIR` | `backend/uploads` | Carpeta donde se guardan las fotos |
| `SESION_DIAS` | `14` | Duración de la sesión |

## Base de datos

- El esquema está en `backend/migraciones/`. Cada archivo `.sql` se aplica una sola vez, en orden, y queda registrado en la tabla `migraciones`.
- **Para cambiar el esquema**, crea un archivo nuevo (p. ej. `002_agregar_mapa.sql`). No edites uno que ya se aplicó.
- La búsqueda ignora tildes ("balcon" encuentra "balcón") con la extensión `unaccent`, que la primera migración activa. Viene incluida en PostgreSQL y en los proveedores en la nube habituales.

## Estructura

```
frontend/                Páginas HTML, CSS y JS del navegador
  js/app.js              Sesión, llamadas a la API, navegación y componentes comunes
  js/panel-publicador.js Paneles de propietario e inmobiliaria
  panel-admin.html       Moderación
  admin-usuarios.html    Gestión de usuarios
backend/
  migraciones/           Esquema de la base de datos
  scripts/               migrar.js, crear-admin.js
  src/server.js          Arranque (migra y luego escucha)
  src/app.js             Express: rutas, archivos estáticos y manejo de errores
  src/db.js              Conexión, transacciones y migraciones
  src/seed.js            Datos de ejemplo
  src/auth.js            Contraseñas (scrypt), sesiones y permisos por rol
  src/errores.js         Errores HTTP y validación de datos
  src/catalogos.js       Ciudades, tipos, comodidades y roles (el front los pide a la API)
  src/propiedades-repo.js  Búsqueda con filtros
  src/routes/            Endpoints (admin.js: administración)
  test/                  Pruebas
docker-compose.yml       PostgreSQL para desarrollo
```

## Seguridad

- Contraseñas con `scrypt` y sal aleatoria. Nunca se guardan en claro.
- Sesión en cookie `httpOnly` y `SameSite=Lax`. En la base de datos se guarda solo el hash del token.
- Límite de 20 intentos de login o registro cada 15 minutos por IP.
- Cada endpoint verifica el rol y que el recurso sea del usuario. La dirección exacta de una propiedad solo la ven quien la publicó y los administradores.
- Todas las consultas usan parámetros (`$1`, `$2`…), nunca texto concatenado del usuario.
- Fotos: solo JPG, PNG o WebP, máximo 5 MB y 12 por propiedad, con nombre aleatorio.

## API

Todas las rutas empiezan por `/api`. Responden JSON; los errores tienen la forma `{ "error": "...", "detalles": { "campo": "motivo" } }`.

| Método | Ruta | Quién | Qué hace |
|---|---|---|---|
| POST | `/auth/registro` | Público | Crea la cuenta (no admin) e inicia sesión |
| POST | `/auth/login` · `/auth/logout` | Público | Inicia o cierra sesión |
| GET | `/auth/yo` | Público | Usuario de la sesión (o `null`) |
| GET | `/catalogos` | Público | Ciudades, tipos, comodidades y conteo por tipo |
| GET | `/propiedades` | Público | Búsqueda. Filtros: `operacion`, `ciudad`, `tipo` (repetible), `q`, `min`, `max`, `hab`, `banos`, `area`, `amen` (repetible, todas deben cumplirse), `pub`, `destacada`, `orden`, `limite`, `pagina` |
| GET | `/propiedades/:id` | Público | Detalle (suma una vista) |
| POST | `/propiedades` | Propietario, inmobiliaria | Publica (multipart, campo `fotos`); queda en revisión |
| PUT | `/propiedades/:id` | Dueño | Edita (vuelve a revisión); `eliminar_fotos` quita fotos existentes |
| PATCH | `/propiedades/:id` | Dueño | `estado` (activa/pausada) o `agente_id` |
| DELETE | `/propiedades/:id` | Dueño | Elimina la propiedad y sus fotos |
| GET | `/mis-propiedades` | Propietario, inmobiliaria | Mis propiedades con estado de revisión, vistas y contactos |
| GET, PUT, DELETE | `/favoritos[/:id]` | Arrendatario | Favoritos |
| GET, POST, DELETE | `/busquedas[/:id]` | Arrendatario | Búsquedas guardadas, con conteo de propiedades nuevas |
| GET, POST, PATCH | `/visitas[/:id]` | Según rol | Solicitar, confirmar, pedir otra fecha o cancelar |
| GET, POST | `/conversaciones` | Participantes | Conversaciones; el arrendatario inicia una sobre una propiedad |
| GET, POST | `/conversaciones/:id/mensajes` | Participantes | Leer (`?despues=id` trae solo nuevos) y enviar |
| GET | `/panel/resumen` | Con sesión | Cifras del panel según el rol |
| GET | `/prospectos` | Propietario, inmobiliaria | Personas que escribieron sobre mis propiedades |
| GET, POST, PATCH, DELETE | `/agentes[/:id]` | Inmobiliaria | Equipo de agentes |
| GET | `/admin/resumen` | Admin | Cifras de usuarios, propiedades y actividad |
| GET | `/admin/propiedades` | Admin | Todas las propiedades; filtros `moderacion`, `q`, `publicador`, `pagina` |
| POST | `/admin/propiedades/:id/aprobar` | Admin | Aprueba y publica |
| POST | `/admin/propiedades/:id/rechazar` | Admin | Rechaza; `motivo` obligatorio |
| PATCH | `/admin/propiedades/:id` | Admin | `destacada` (true/false) |
| DELETE | `/admin/propiedades/:id` | Admin | Elimina cualquier propiedad |
| GET | `/admin/usuarios` | Admin | Usuarios; filtros `rol`, `estado`, `q`, `pagina` |
| PATCH | `/admin/usuarios/:id` | Admin | `activo` (true/false): suspender o reactivar |

## Pendiente para producción

- **Correos:** recuperar contraseña y avisos (propiedad aprobada o rechazada, visitas, mensajes, búsquedas guardadas) aún no se envían.
- **Agentes:** se registran en el equipo, pero todavía no tienen su propio acceso.
- **Mapa:** el detalle muestra un espacio reservado.
- **Fotos:** se guardan en el disco del servidor (`backend/uploads`). En servicios sin disco persistente (contenedores efímeros), muévelas a un almacenamiento como S3 o Cloudinary.
- **Copias de seguridad** de PostgreSQL (la mayoría de los proveedores en la nube las hacen automáticamente).
- Quita los botones de "cuentas de demostración" de `login.html` antes de abrir al público.
