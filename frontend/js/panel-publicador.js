/* Paneles de propietario e inmobiliaria. Pinta solo las secciones que existan en la página. */

Renty.ready.then(async (usuario) => {
  const $ = (id) => document.getElementById(id);
  const esc = Renty.esc;
  const esInmo = usuario.rol === "inmobiliaria";
  const ETQ = { activa: "Publicada", pausada: "Pausada" };
  // Estado combinado: primero la revisión del administrador, luego activa/pausada
  const estadoCelda = (p) =>
    p.moderacion === "pendiente" ? `<span class="estado revision">En revisión</span>${p.estado === "pausada" ? '<div class="small text-muted mt-1">Pausada</div>' : ""}`
    : p.moderacion === "rechazada" ? `<span class="estado rechazada">Rechazada</span><div class="small text-danger mt-1" style="max-width:240px;white-space:normal">${esc(p.motivo_rechazo || "")}</div>`
    : `<span class="estado ${p.estado}">${ETQ[p.estado]}</span>`;
  const vacio = (txt, icon = "bi-inbox") => `<div class="text-center text-muted py-4"><i class="bi ${icon} fs-4 d-block mb-2 text-terracota"></i>${txt}</div>`;
  const num = (n) => new Intl.NumberFormat("es-CO").format(n ?? 0);

  let propiedades = [];
  let agentes = [];

  /* ---------- Cifras ---------- */
  async function resumen() {
    try {
      const r = await Renty.api("/panel/resumen");
      document.querySelectorAll("[data-stat]").forEach((el) => (el.textContent = num(r[el.dataset.stat])));
      const avisos = [];
      if (r.rechazadas) avisos.push(`<b>${Renty.plural(r.rechazadas, "propiedad fue rechazada", "propiedades fueron rechazadas")}.</b> Revisa el motivo en la tabla y corrígelas para reenviarlas.`);
      if (r.en_revision) avisos.push(`${Renty.plural(r.en_revision, "propiedad está", "propiedades están")} en revisión. Las publicaremos en cuanto un administrador las apruebe.`);
      document.getElementById("avisoModeracion")?.remove();
      if (avisos.length) document.querySelector(".page-head").insertAdjacentHTML("afterend",
        `<div class="alert ${r.rechazadas ? "alert-warning" : "bg-verde-suave border-0"} d-flex gap-2" id="avisoModeracion" role="status"><i class="bi ${r.rechazadas ? "bi-exclamation-triangle" : "bi-hourglass-split"}"></i><div>${avisos.join("<br>")}</div></div>`);
    } catch { /* quedan en – */ }
  }

  /* ---------- Tabla de propiedades ---------- */
  function filas() {
    const fOp = $("fOp")?.value, fAg = $("fAg")?.value;
    const lista = propiedades.filter((p) => (!fOp || p.operacion === fOp) && (!fAg || String(p.agente?.id ?? "sin") === fAg));
    const cols = esInmo ? 7 : 6;
    $("filas").innerHTML = !propiedades.length
      ? `<tr><td colspan="${cols}">${vacio('Aún no has publicado propiedades. <a href="publicar.html">Publica la primera</a>.', "bi-house-add")}</td></tr>`
      : !lista.length
      ? `<tr><td colspan="${cols}" class="text-center text-muted py-4">No hay propiedades con ese filtro.</td></tr>`
      : lista.map((p) => `
        <tr>
          <td><div class="d-flex align-items-center gap-3"><div class="thumb position-relative">${Renty.media(p)}</div><div style="min-width:0"><a class="fw-semibold text-body text-decoration-none" href="propiedad.html?id=${p.id}">${esc(p.titulo)}</a><br><small class="text-muted">${esc(p.zona)}, ${esc(p.ciudad)}</small></div></div></td>
          ${esInmo ? `<td class="text-capitalize">${p.operacion}</td>` : ""}
          <td class="text-nowrap">${Renty.price(p)}</td>
          ${esInmo ? `<td><select class="form-select form-select-sm" style="min-width:150px" aria-label="Agente de ${esc(p.titulo)}" data-agente="${p.id}">
              <option value="">Sin asignar</option>${agentes.map((a) => `<option value="${a.id}" ${p.agente?.id === a.id ? "selected" : ""}>${esc(a.nombre)}</option>`).join("")}
            </select></td>` : ""}
          <td>${estadoCelda(p)}</td>
          ${esInmo ? "" : `<td class="text-end">${num(p.vistas)}</td>`}
          <td class="text-end">${p.contactos}</td>
          <td class="text-end">
            <div class="dropdown">
              <button class="btn btn-light btn-sm" data-bs-toggle="dropdown" aria-label="Acciones para ${esc(p.titulo)}"><i class="bi bi-three-dots"></i></button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li><a class="dropdown-item" href="publicar.html?editar=${p.id}"><i class="bi bi-pencil me-2"></i>${p.moderacion === "rechazada" ? "Corregir y reenviar" : "Editar"}</a></li>
                <li><button class="dropdown-item" data-estado="${p.id}"><i class="bi ${p.estado === "activa" ? "bi-pause-circle" : "bi-play-circle"} me-2"></i>${p.estado === "activa" ? "Pausar" : "Activar"}</button></li>
                <li><a class="dropdown-item" href="propiedad.html?id=${p.id}"><i class="bi bi-eye me-2"></i>Ver anuncio</a></li>
                <li><hr class="dropdown-divider"></li>
                <li><button class="dropdown-item text-danger" data-eliminar="${p.id}"><i class="bi bi-trash me-2"></i>Eliminar</button></li>
              </ul>
            </div>
          </td>
        </tr>`).join("");
  }

  async function cargarPropiedades() {
    $("filas").innerHTML = `<tr><td colspan="7">${vacio("Cargando…", "bi-hourglass")}</td></tr>`;
    try {
      [propiedades, agentes] = await Promise.all([Renty.api("/mis-propiedades"), esInmo ? Renty.api("/agentes") : []]);
      if ($("fAg")) $("fAg").innerHTML = `<option value="">Todos los agentes</option><option value="sin">Sin asignar</option>` + agentes.map((a) => `<option value="${a.id}">${esc(a.nombre)}</option>`).join("");
      filas();
      equipo();
    } catch (err) { $("filas").innerHTML = `<tr><td colspan="7">${vacio(esc(err.message), "bi-wifi-off")}</td></tr>`; }
  }

  $("filas").addEventListener("click", async (e) => {
    const est = e.target.closest("[data-estado]");
    const del = e.target.closest("[data-eliminar]");
    try {
      if (est) {
        const p = propiedades.find((x) => x.id === Number(est.dataset.estado));
        const estado = p.estado === "activa" ? "pausada" : "activa";
        await Renty.api("/propiedades/" + p.id, { method: "PATCH", body: { estado } });
        p.estado = estado; filas(); resumen();
        Renty.aviso(estado === "activa" ? "La propiedad vuelve a aparecer en las búsquedas" : "Propiedad pausada: ya no aparece en las búsquedas");
      }
      if (del) {
        const p = propiedades.find((x) => x.id === Number(del.dataset.eliminar));
        if (!confirm(`¿Eliminar "${p.titulo}"? Se borrarán también sus fotos, visitas y mensajes. No se puede deshacer.`)) return;
        await Renty.api("/propiedades/" + p.id, { method: "DELETE" });
        propiedades = propiedades.filter((x) => x.id !== p.id); filas(); resumen(); equipo();
        Renty.aviso("Propiedad eliminada");
      }
    } catch (err) { Renty.aviso(err.message, "error"); }
  });

  $("filas").addEventListener("change", async (e) => {
    const sel = e.target.closest("[data-agente]");
    if (!sel) return;
    const p = propiedades.find((x) => x.id === Number(sel.dataset.agente));
    try {
      await Renty.api("/propiedades/" + p.id, { method: "PATCH", body: { agente_id: sel.value ? Number(sel.value) : null } });
      p.agente = sel.value ? { id: Number(sel.value), nombre: sel.selectedOptions[0].text } : null;
      Renty.aviso(p.agente ? `Asignada a ${p.agente.nombre}` : "Propiedad sin agente asignado");
      agentes = await Renty.api("/agentes"); equipo();
    } catch (err) { Renty.aviso(err.message, "error"); sel.value = p.agente?.id ?? ""; }
  });
  $("fOp")?.addEventListener("change", filas);
  $("fAg")?.addEventListener("change", filas);

  /* ---------- Solicitudes de visita ---------- */
  async function solicitudes() {
    if (!$("solicitudes")) return;
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      const lista = (await Renty.api("/visitas")).filter((v) => v.fecha >= hoy && v.estado !== "cancelada").slice(0, 6);
      $("solicitudes").innerHTML = lista.length ? lista.map((v) => `
        <div class="list-row align-items-start">
          <span class="avatar">${esc(Renty.initials(v.arrendatario.nombre))}</span>
          <div class="flex-grow-1" style="min-width:0">
            <div class="fw-semibold">${esc(v.arrendatario.nombre)}</div>
            <small class="text-muted d-block text-truncate">${esc(v.propiedad.titulo)}</small>
            <small class="d-block mb-2"><i class="bi bi-calendar3 me-1"></i>${esc(Renty.fecha(v.fecha))}${v.hora ? " · " + Renty.hora(v.hora) : ""}</small>
            ${v.estado === "pendiente"
              ? `<div class="d-flex flex-wrap gap-2"><button class="btn btn-primary btn-sm" data-visita="${v.id}" data-resp="confirmada">Confirmar</button><button class="btn btn-light btn-sm" data-visita="${v.id}" data-resp="reprogramar">Proponer otra fecha</button></div>`
              : `<span class="estado ${v.estado === "confirmada" ? "activa" : "nuevo"}">${v.estado === "confirmada" ? "Confirmada" : "Reprogramación pedida"}</span>`}
          </div>
        </div>`).join("") : vacio("No tienes solicitudes de visita pendientes.", "bi-calendar3");
    } catch (err) { $("solicitudes").innerHTML = vacio(esc(err.message), "bi-wifi-off"); }
  }
  $("solicitudes")?.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-resp]");
    if (!b) return;
    try {
      await Renty.ocupado(b, () => Renty.api("/visitas/" + b.dataset.visita, { method: "PATCH", body: { estado: b.dataset.resp } }));
      Renty.aviso(b.dataset.resp === "confirmada" ? "Visita confirmada. Le avisamos por mensaje." : "Le pedimos por mensaje que proponga otra fecha.");
      solicitudes(); resumen();
    } catch (err) { Renty.aviso(err.message, "error"); }
  });

  /* ---------- Prospectos ---------- */
  const PROS = { nuevo: ["nuevo", "Nuevo"], en_conversacion: ["activa", "En conversación"], visita_pendiente: ["revision", "Visita por confirmar"], visita_confirmada: ["activa", "Visita confirmada"] };
  async function prospectos() {
    if (!$("leads")) return;
    try {
      const lista = await Renty.api("/prospectos");
      $("leads").innerHTML = lista.length ? lista.slice(0, 6).map((l) => `
        <div class="list-row">
          <span class="avatar">${esc(Renty.initials(l.nombre))}</span>
          <div class="flex-grow-1" style="min-width:0"><div class="fw-semibold">${esc(l.nombre)}</div><small class="text-muted d-block text-truncate">${esc(l.propiedad)} · ${Renty.hace(l.actividad)}</small>
            <span class="estado ${PROS[l.estado][0]} mt-1">${PROS[l.estado][1]}</span></div>
          <a class="btn btn-light btn-sm" href="mensajes.html?c=${l.conversacion_id}" aria-label="Escribir a ${esc(l.nombre)}"><i class="bi bi-chat-dots"></i></a>
        </div>`).join("") : vacio("Cuando alguien escriba sobre tus propiedades aparecerá aquí.", "bi-people");
    } catch (err) { $("leads").innerHTML = vacio(esc(err.message), "bi-wifi-off"); }
  }

  /* ---------- Equipo (inmobiliaria) ---------- */
  function equipo() {
    if (!$("equipo")) return;
    $("equipo").innerHTML = agentes.length ? agentes.map((a) => `
      <div class="list-row">
        <span class="avatar verde">${esc(Renty.initials(a.nombre))}</span>
        <div class="flex-grow-1" style="min-width:0">
          <div class="fw-semibold">${esc(a.nombre)} ${a.estado === "invitado" ? '<span class="estado revision ms-1">Invitado</span>' : ""}</div>
          <small class="text-muted d-block text-truncate">${esc(a.email)}</small>
          <small class="text-muted">${Renty.plural(a.propiedades, "propiedad", "propiedades")} · ${Renty.plural(a.prospectos, "prospecto", "prospectos")}</small>
        </div>
        <div class="dropdown"><button class="btn btn-light btn-sm" data-bs-toggle="dropdown" aria-label="Opciones de ${esc(a.nombre)}"><i class="bi bi-three-dots"></i></button>
          <ul class="dropdown-menu dropdown-menu-end">
            ${a.estado === "invitado" ? `<li><button class="dropdown-item" data-activar="${a.id}"><i class="bi bi-check2-circle me-2"></i>Marcar como activo</button></li>` : ""}
            <li><button class="dropdown-item text-danger" data-quitar="${a.id}"><i class="bi bi-person-dash me-2"></i>Quitar del equipo</button></li>
          </ul></div>
      </div>`).join("") : vacio("Invita a tus agentes para asignarles propiedades.", "bi-people");
  }
  $("equipo")?.addEventListener("click", async (e) => {
    const act = e.target.closest("[data-activar]"), quitar = e.target.closest("[data-quitar]");
    try {
      if (act) await Renty.api("/agentes/" + act.dataset.activar, { method: "PATCH", body: { estado: "activo" } });
      if (quitar) {
        const a = agentes.find((x) => x.id === Number(quitar.dataset.quitar));
        if (!confirm(`¿Quitar a ${a.nombre} del equipo? Sus propiedades quedarán sin agente asignado.`)) return;
        await Renty.api("/agentes/" + a.id, { method: "DELETE" });
      }
      if (act || quitar) { await cargarPropiedades(); resumen(); }
    } catch (err) { Renty.aviso(err.message, "error"); }
  });

  const inv = $("invitar");
  inv?.addEventListener("submit", async (e) => {
    e.preventDefault();
    inv.classList.add("was-validated");
    if (!inv.checkValidity()) return;
    try {
      await Renty.ocupado(e.submitter, () => Renty.api("/agentes", { method: "POST", body: { nombre: inv.aNombre.value, email: inv.aMail.value } }));
      bootstrap.Modal.getInstance($("mAgente")).hide();
      inv.reset(); inv.classList.remove("was-validated");
      Renty.aviso("Agente agregado al equipo");
      cargarPropiedades();
    } catch (err) { Renty.erroresEnForm(inv, err, { nombre: "aNombre", email: "aMail" }); }
  });

  if ($("empresa")) $("empresa").textContent = usuario.nombre;
  resumen(); cargarPropiedades(); solicitudes(); prospectos();
});
