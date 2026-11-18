/* Renty — lógica compartida del front. Habla con el backend en /api.
   Cada página espera a `Renty.ready` antes de pintar: así ya conoce la sesión y los catálogos. */

const Renty = (() => {
  const ROLES = {
    arrendatario: {
      nombre: "Arrendatario", icon: "bi-search-heart", panel: "panel-arrendatario.html",
      menu: [
        { id: "panel", txt: "Resumen", href: "panel-arrendatario.html", icon: "bi-grid" },
        { id: "favoritos", txt: "Favoritos", href: "favoritos.html", icon: "bi-heart" },
        { id: "mensajes", txt: "Mensajes", href: "mensajes.html", icon: "bi-chat-dots" },
        { id: "listado", txt: "Buscar propiedades", href: "propiedades.html", icon: "bi-search" }
      ]
    },
    propietario: {
      nombre: "Propietario", icon: "bi-key", panel: "panel-propietario.html",
      menu: [
        { id: "panel", txt: "Mis propiedades", href: "panel-propietario.html", icon: "bi-grid" },
        { id: "publicar", txt: "Publicar propiedad", href: "publicar.html", icon: "bi-plus-circle" },
        { id: "mensajes", txt: "Mensajes", href: "mensajes.html", icon: "bi-chat-dots" }
      ]
    },
    inmobiliaria: {
      nombre: "Inmobiliaria", icon: "bi-buildings", panel: "panel-inmobiliaria.html",
      menu: [
        { id: "panel", txt: "Portafolio", href: "panel-inmobiliaria.html", icon: "bi-grid" },
        { id: "publicar", txt: "Publicar propiedad", href: "publicar.html", icon: "bi-plus-circle" },
        { id: "mensajes", txt: "Mensajes", href: "mensajes.html", icon: "bi-chat-dots" }
      ]
    },
    admin: {
      nombre: "Administrador", icon: "bi-shield-check", panel: "panel-admin.html",
      menu: [
        { id: "panel", txt: "Moderación", href: "panel-admin.html", icon: "bi-clipboard-check" },
        { id: "usuarios", txt: "Usuarios", href: "admin-usuarios.html", icon: "bi-people" },
        { id: "listado", txt: "Ver el sitio", href: "propiedades.html", icon: "bi-search" }
      ]
    }
  };

  // Cuentas creadas por `npm run seed` (contraseña: renty123)
  const DEMO = {
    "arrendatario@renty.app": "arrendatario",
    "propietario@renty.app": "propietario",
    "inmobiliaria@renty.app": "inmobiliaria",
    "admin@renty.app": "admin"
  };
  const DEMO_PASSWORD = "renty123";

  let usuario = null;

  /* ---------- API ---------- */
  async function api(ruta, { method = "GET", body, form } = {}) {
    const opts = { method, credentials: "same-origin", headers: { Accept: "application/json" } };
    if (form) opts.body = form;                     // FormData (fotos): el navegador pone el Content-Type
    else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers["Content-Type"] = "application/json"; }

    let res;
    try { res = await fetch("/api" + ruta, opts); }
    catch { throw Object.assign(new Error("No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo."), { status: 0 }); }

    const datos = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401 && usuario) { usuario = null; irALogin(); }
      throw Object.assign(new Error(datos?.error || "Ocurrió un error inesperado"), { status: res.status, detalles: datos?.detalles });
    }
    return datos;
  }

  const paginaActual = () => location.pathname.split("/").pop() + location.search;
  const irALogin = () => location.replace("login.html?next=" + encodeURIComponent(paginaActual()));

  /* ---------- Sesión ---------- */
  const session = () => usuario;

  async function login(email, password) {
    const r = await api("/auth/login", { method: "POST", body: { email, password } });
    return (usuario = r.usuario);
  }
  async function register(datos) {
    const r = await api("/auth/registro", { method: "POST", body: datos });
    return (usuario = r.usuario);
  }
  async function logout() {
    try { await api("/auth/logout", { method: "POST" }); } finally { location.href = "index.html"; }
  }

  async function toggleFav(id, activar) {
    return api("/favoritos/" + id, { method: activar ? "PUT" : "DELETE" });
  }

  /* ---------- Utilidades ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + new Intl.NumberFormat("es-CO").format(n);
  const price = (p) => money(p.precio) + (p.operacion === "renta" ? " <small>/mes</small>" : "");
  const initials = (n) => String(n || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  // El servidor envía fechas con hora en ISO ("2026-11-18T15:04:05.000Z") y fechas solas como "AAAA-MM-DD"
  const aFecha = (s) => (s instanceof Date ? s : /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : new Date(s));
  const fecha = (s, opts = { weekday: "short", day: "numeric", month: "short" }) => aFecha(s).toLocaleDateString("es-CO", opts);
  const hora = (hhmm) => {
    if (!hhmm) return "";
    const [h, m] = hhmm.split(":").map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
  };
  function hace(s) {
    const min = Math.round((Date.now() - aFecha(s)) / 60000);
    if (min < 1) return "Ahora";
    if (min < 60) return `Hace ${min} min`;
    if (min < 24 * 60) return `Hace ${Math.round(min / 60)} h`;
    const d = Math.round(min / 1440);
    return d === 1 ? "Ayer" : d < 7 ? `Hace ${d} días` : fecha(s, { day: "numeric", month: "short" });
  }

  /* Ilustración de respaldo mientras la propiedad no tenga fotos */
  function art(p, variant = 0) {
    const pal = [
      ["#f3e3d6", "#cd9573", "#5c7a67"], ["#e4ece6", "#5c7a67", "#cd9573"],
      ["#f6efe2", "#b9c8bd", "#cd9573"], ["#efe2d8", "#8fa697", "#b57b58"]
    ][((p.id || 0) + variant) % 4];
    const [bg, a, b] = pal;
    const wins = (x, y, cols, rows, w = 16, h = 18, gx = 12, gy = 14) => {
      let s = "";
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
        s += `<rect x="${x + c * (w + gx)}" y="${y + r * (h + gy)}" width="${w}" height="${h}" rx="2" fill="#fbf8f3" opacity=".85"/>`;
      return s;
    };
    let shape;
    if (variant > 0) {
      shape = variant % 2
        ? `<rect x="0" y="190" width="400" height="80" fill="${a}" opacity=".35"/><rect x="60" y="150" width="190" height="60" rx="14" fill="${b}"/><rect x="50" y="170" width="210" height="45" rx="12" fill="${a}"/><rect x="290" y="70" width="70" height="90" rx="4" fill="#fbf8f3"/><path d="M325 70v90M290 115h70" stroke="${a}" stroke-width="3"/><circle cx="110" cy="80" r="22" fill="#fbf8f3"/><rect x="300" y="180" width="8" height="40" fill="${b}"/><circle cx="304" cy="172" r="20" fill="${b}" opacity=".8"/>`
        : `<rect x="0" y="200" width="400" height="70" fill="${a}" opacity=".35"/><rect x="40" y="120" width="320" height="16" rx="4" fill="${b}"/><rect x="40" y="136" width="320" height="74" fill="${a}"/>${wins(60, 150, 5, 1, 40, 46, 20)}<rect x="90" y="50" width="220" height="50" rx="6" fill="#fbf8f3"/><circle cx="330" cy="104" r="10" fill="${b}"/>`;
    } else if (p.tipo === "casa") {
      shape = `<circle cx="318" cy="66" r="26" fill="#fbf8f3" opacity=".8"/><rect x="0" y="212" width="400" height="48" fill="${b}" opacity=".3"/>
        <circle cx="76" cy="170" r="34" fill="${b}"/><rect x="72" y="186" width="8" height="34" fill="${b}"/>
        <polygon points="110,128 205,62 300,128" fill="${b}"/><rect x="128" y="128" width="154" height="92" fill="${a}"/>
        <rect x="192" y="166" width="30" height="54" rx="3" fill="#fbf8f3"/>${wins(142, 144, 1, 1, 30, 26)}${wins(238, 144, 1, 1, 30, 26)}`;
    } else if (p.tipo === "local") {
      shape = `<circle cx="70" cy="62" r="24" fill="#fbf8f3" opacity=".8"/><rect x="0" y="212" width="400" height="48" fill="${b}" opacity=".3"/>
        <rect x="70" y="92" width="260" height="128" fill="${a}"/><rect x="60" y="92" width="280" height="30" rx="4" fill="${b}"/>
        <path d="M60 122h280l-14 26H74z" fill="#fbf8f3" opacity=".9"/><rect x="92" y="158" width="120" height="62" rx="3" fill="#fbf8f3" opacity=".85"/><rect x="250" y="158" width="46" height="62" rx="3" fill="#fbf8f3"/>`;
    } else {
      const tall = p.tipo === "oficina";
      shape = `<circle cx="${tall ? 86 : 322}" cy="62" r="26" fill="#fbf8f3" opacity=".8"/><rect x="0" y="212" width="400" height="48" fill="${b}" opacity=".3"/>
        <rect x="70" y="104" width="110" height="116" fill="${b}"/>${wins(86, 120, 3, 3)}
        <rect x="170" y="${tall ? 34 : 54}" width="140" height="${tall ? 186 : 166}" fill="${a}"/>${wins(188, tall ? 52 : 72, 4, tall ? 5 : 4)}
        <rect x="226" y="190" width="28" height="30" rx="2" fill="#fbf8f3"/>`;
    }
    const nombreTipo = (window.TIPOS?.[p.tipo]?.nombre || "propiedad").toLowerCase();
    return `<svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Ilustración de ${esc(nombreTipo)}"><rect width="400" height="260" fill="${bg}"/>${shape}</svg>`;
  }

  /** Foto `n` de la propiedad, o la ilustración si no hay. */
  function media(p, n = 0) {
    const foto = p.fotos?.[n]?.url || (n === 0 ? p.img : "");
    return art(p, n) + (foto ? `<img src="${esc(foto)}" alt="${n === 0 ? esc(p.titulo) : ""}" loading="lazy" onerror="this.remove()">` : "");
  }

  function specs(p) {
    const out = [];
    if (p.hab) out.push(`<li><i class="bi bi-door-closed"></i>${p.hab} hab.</li>`);
    out.push(`<li><i class="bi bi-droplet"></i>${plural(p.banos, "baño", "baños")}</li>`);
    out.push(`<li><i class="bi bi-aspect-ratio"></i>${p.area} m²</li>`);
    return out.join("");
  }

  const favBtn = (p, clase = "fav-btn") =>
    `<button type="button" class="${clase} ${p.es_favorito ? "active" : ""}" data-fav="${p.id}" aria-pressed="${!!p.es_favorito}" aria-label="Guardar en favoritos"><i class="bi ${p.es_favorito ? "bi-heart-fill" : "bi-heart"}"></i></button>`;

  function card(p) {
    const showFav = !usuario || usuario.rol === "arrendatario";
    return `
    <article class="card prop-card h-100">
      <div class="prop-media">
        ${media(p)}
        <span class="op-badge ${p.operacion}">${p.operacion === "renta" ? "En renta" : "En venta"}</span>
        ${showFav ? favBtn(p) : ""}
      </div>
      <div class="card-body">
        <div class="prop-price">${price(p)}</div>
        <h3 class="prop-title"><a class="stretched-link" href="propiedad.html?id=${p.id}">${esc(p.titulo)}</a></h3>
        <p class="prop-loc"><i class="bi bi-geo-alt"></i> ${esc(p.zona)}, ${esc(p.ciudad)}</p>
        <ul class="prop-specs">${specs(p)}</ul>
      </div>
    </article>`;
  }
  const grid = (list, cols = "col-sm-6 col-lg-4") => list.map((p) => `<div class="${cols}">${card(p)}</div>`).join("");

  /* ---------- Avisos y errores ---------- */
  function aviso(msg, tipo = "success") {
    let zona = document.getElementById("avisos");
    if (!zona) {
      zona = document.createElement("div");
      zona.id = "avisos";
      zona.className = "toast-container position-fixed bottom-0 end-0 p-3";
      zona.setAttribute("aria-live", "polite");
      document.body.append(zona);
    }
    const el = document.createElement("div");
    el.className = `toast align-items-center border-0 text-bg-${tipo === "error" ? "danger" : "dark"}`;
    el.setAttribute("role", tipo === "error" ? "alert" : "status");
    el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(msg)}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button></div>`;
    zona.append(el);
    el.addEventListener("hidden.bs.toast", () => el.remove());
    new bootstrap.Toast(el, { delay: 4000 }).show();
  }

  /** Marca en el formulario los campos que el servidor rechazó. `mapa` traduce nombres del API a ids de campos. */
  function erroresEnForm(form, err, mapa = {}) {
    form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
    form.querySelectorAll("[data-error-servidor]").forEach((el) => el.remove());
    let primero = null;
    for (const [campo, msg] of Object.entries(err.detalles || {})) {
      const el = form.querySelector("#" + (mapa[campo] || campo));
      if (!el) continue;
      el.classList.add("is-invalid");
      el.insertAdjacentHTML("afterend", `<div class="invalid-feedback d-block" data-error-servidor>${esc(msg)}</div>`);
      primero ??= el;
    }
    form.classList.remove("was-validated");
    if (primero) primero.focus(); else aviso(err.message, "error");
  }

  /** Deshabilita el botón mientras corre la promesa. */
  async function ocupado(boton, fn) {
    const html = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = `<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>${boton.textContent.trim()}`;
    try { return await fn(); } finally { boton.disabled = false; boton.innerHTML = html; }
  }

  const cargando = (texto = "Cargando…") =>
    `<div class="col-12 text-center text-muted py-5"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${texto}</div>`;
  const falla = (err) =>
    `<div class="col-12"><div class="empty-state"><i class="bi bi-wifi-off"></i><p class="mt-2 mb-3 text-muted">${esc(err.message)}</p><button class="btn btn-primary" onclick="location.reload()">Reintentar</button></div></div>`;

  /* ---------- Navegación ---------- */
  function renderNav() {
    const el = document.getElementById("nav");
    if (!el) return;
    const s = usuario;
    const page = document.body.dataset.page || "";
    const op = new URLSearchParams(location.search).get("operacion");
    const publica = s && (s.rol === "propietario" || s.rol === "inmobiliaria");
    const publicarHref = publica ? "publicar.html" : "registro.html?rol=propietario";

    const right = s
      ? `<div class="dropdown">
           <button class="btn btn-light d-flex align-items-center gap-2 ps-1 pe-3 py-1 rounded-pill" data-bs-toggle="dropdown" aria-expanded="false">
             <span class="avatar">${esc(initials(s.nombre))}</span>
             <span class="d-none d-sm-inline">${esc(s.nombre.split(" ")[0])}</span><i class="bi bi-chevron-down small"></i>
           </button>
           <ul class="dropdown-menu dropdown-menu-end p-2" style="min-width:240px">
             <li class="px-2 pt-1 pb-2"><div class="fw-bold">${esc(s.nombre)}</div><span class="role-badge mt-1"><i class="bi ${ROLES[s.rol].icon}"></i>${ROLES[s.rol].nombre}</span></li>
             <li><hr class="dropdown-divider"></li>
             ${ROLES[s.rol].menu.map((m) => `<li><a class="dropdown-item rounded" href="${m.href}"><i class="bi ${m.icon} me-2"></i>${m.txt}</a></li>`).join("")}
             <li><hr class="dropdown-divider"></li>
             <li><button class="dropdown-item rounded" data-logout><i class="bi bi-box-arrow-right me-2"></i>Cerrar sesión</button></li>
           </ul>
         </div>`
      : `<a class="btn btn-light" href="login.html">Ingresar</a>
         <a class="btn btn-primary d-none d-sm-inline-block" href="registro.html">Crear cuenta</a>`;

    el.innerHTML = `
    <nav class="navbar navbar-expand-lg navbar-renty sticky-top py-2">
      <div class="container">
        <a class="brand me-lg-4" href="index.html" aria-label="Renty, inicio"><span class="brand-mark"><i class="bi bi-house-heart-fill"></i></span><span>Rent<b>y</b></span></a>
        <div class="d-flex align-items-center gap-2 order-lg-3">
          ${right}
          <button class="navbar-toggler border-0 px-2" type="button" data-bs-toggle="collapse" data-bs-target="#navMain" aria-controls="navMain" aria-expanded="false" aria-label="Abrir menú"><i class="bi bi-list fs-3"></i></button>
        </div>
        <div class="collapse navbar-collapse order-lg-2" id="navMain">
          <ul class="navbar-nav me-auto gap-lg-1 py-2 py-lg-0">
            <li class="nav-item"><a class="nav-link ${page === "listado" && op === "renta" ? "active" : ""}" href="propiedades.html?operacion=renta">Rentar</a></li>
            <li class="nav-item"><a class="nav-link ${page === "listado" && op === "venta" ? "active" : ""}" href="propiedades.html?operacion=venta">Comprar</a></li>
            ${!s || publica ? `<li class="nav-item"><a class="nav-link ${page === "publicar" ? "active" : ""}" href="${publicarHref}">Publicar propiedad</a></li>` : ""}
            ${s ? `<li class="nav-item"><a class="nav-link ${page === "panel" ? "active" : ""}" href="${ROLES[s.rol].panel}">Mi panel</a></li>` : ""}
          </ul>
        </div>
      </div>
    </nav>`;
  }

  function renderSubnav() {
    const el = document.getElementById("subnav");
    if (!el || !usuario) return;
    const page = document.body.dataset.page;
    el.innerHTML = `<div class="subnav"><div class="container"><ul class="nav">
      ${ROLES[usuario.rol].menu.map((m) => `<li class="nav-item"><a class="nav-link ${m.id === page ? "active" : ""}" ${m.id === page ? 'aria-current="page"' : ""} href="${m.href}"><i class="bi ${m.icon} me-1"></i>${m.txt}</a></li>`).join("")}
    </ul></div></div>`;
  }

  function renderFooter() {
    const el = document.getElementById("footer");
    if (!el) return;
    el.innerHTML = `
    <footer class="footer">
      <div class="container">
        <div class="row g-4">
          <div class="col-lg-4">
            <a class="brand" href="index.html"><span class="brand-mark"><i class="bi bi-house-heart-fill"></i></span><span>Rent<b>y</b></span></a>
            <p class="text-muted mt-3 mb-0" style="max-width:32ch">Propiedades en renta y venta, publicadas por propietarios e inmobiliarias de confianza.</p>
          </div>
          <div class="col-6 col-lg-2 ms-lg-auto"><h6>Buscar</h6><a href="propiedades.html?operacion=renta">En renta</a><a href="propiedades.html?operacion=venta">En venta</a><a href="propiedades.html">Todas las propiedades</a></div>
          <div class="col-6 col-lg-2"><h6>Publicar</h6><a href="registro.html?rol=propietario">Soy propietario</a><a href="registro.html?rol=inmobiliaria">Soy inmobiliaria</a></div>
          <div class="col-6 col-lg-2"><h6>Cuenta</h6><a href="login.html">Ingresar</a><a href="registro.html">Crear cuenta</a></div>
        </div>
        <hr class="my-4"><p class="small text-muted mb-0">© 2026 Renty. Todos los derechos reservados.</p>
      </div>
    </footer>`;
  }

  /* ---------- Control de acceso por rol (el servidor también lo valida) ---------- */
  function guard() {
    const need = document.body.dataset.roles;
    if (!need) return true;
    if (!usuario) { irALogin(); return false; }
    if (!need.split(",").includes(usuario.rol)) { location.replace(ROLES[usuario.rol].panel); return false; }
    return true;
  }

  function eventosGlobales() {
    document.addEventListener("click", async (e) => {
      const fav = e.target.closest("[data-fav]");
      if (fav) {
        e.preventDefault();
        if (!usuario) { irALogin(); return; }
        const id = Number(fav.dataset.fav);
        const on = !fav.classList.contains("active");
        const pintar = (v) => document.querySelectorAll(`[data-fav="${id}"]`).forEach((b) => {
          b.classList.toggle("active", v);
          b.setAttribute("aria-pressed", v);
          b.querySelector("i").className = "bi " + (v ? "bi-heart-fill" : "bi-heart");
        });
        pintar(on);
        try {
          await toggleFav(id, on);
          document.dispatchEvent(new CustomEvent("renty:favs", { detail: { id, on } }));
        } catch (err) { pintar(!on); aviso(err.message, "error"); }
      }
      if (e.target.closest("[data-logout]")) logout();
    });
  }

  // Arranque: sesión + catálogos en paralelo
  const ready = (async () => {
    const [yo, cat] = await Promise.all([
      api("/auth/yo").catch(() => ({ usuario: null })),
      api("/catalogos").catch(() => ({ ciudades: [], tipos: {}, amenidades: [], conteo_tipos: {} }))
    ]);
    usuario = yo.usuario;
    Object.assign(window, { CIUDADES: cat.ciudades, TIPOS: cat.tipos, AMENIDADES: cat.amenidades, CONTEO_TIPOS: cat.conteo_tipos });
    if (!guard()) return new Promise(() => {}); // la página se está redirigiendo: no sigue pintando
    renderNav(); renderSubnav(); renderFooter(); eventosGlobales();
    document.querySelectorAll("[data-user-name]").forEach((n) => { if (usuario) n.textContent = usuario.nombre.split(" ")[0]; });
    return usuario;
  })();

  return {
    ROLES, DEMO, DEMO_PASSWORD, ready, api, session, login, register, logout, toggleFav,
    money, price, plural, fecha, hora, hace, card, grid, media, art, specs, favBtn, esc, initials,
    aviso, erroresEnForm, ocupado, cargando, falla
  };
})();
