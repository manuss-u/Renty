// Error con código HTTP que el manejador central convierte en respuesta JSON.
export class HttpError extends Error {
  constructor(status, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}

export const noEncontrado = (que = "Recurso", femenino = false) => new HttpError(404, `${que} no ${femenino ? "encontrada" : "encontrado"}`);
export const prohibido = (msg = "No tienes permiso para esta acción") => new HttpError(403, msg);

/* ---------- Validación ---------- */
// Cada validador recibe el valor crudo y devuelve el valor limpio, o lanza un mensaje.
class ErrorCampo extends Error {}
// Un campo enviado varias veces llega como arreglo: solo `lista` lo acepta.
const unico = (x) => { if (Array.isArray(x)) throw new ErrorCampo("Envía un solo valor"); return x; };

export const v = {
  texto: ({ min = 1, max = 500, opcional = false } = {}) => (x) => {
    x = unico(x);
    if (x === undefined || x === null || String(x).trim() === "") {
      if (opcional) return null;
      throw new ErrorCampo("Es obligatorio");
    }
    const s = String(x).trim();
    if (s.length < min) throw new ErrorCampo(`Debe tener al menos ${min} caracteres`);
    if (s.length > max) throw new ErrorCampo(`Debe tener máximo ${max} caracteres`);
    return s;
  },
  email: ({ opcional = false } = {}) => (x) => {
    x = unico(x);
    if ((x === undefined || x === null || x === "") && opcional) return null;
    const s = String(x ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || s.length > 200) throw new ErrorCampo("Correo no válido");
    return s;
  },
  entero: ({ min = 0, max = Number.MAX_SAFE_INTEGER, opcional = false } = {}) => (x) => {
    x = unico(x);
    if (x === undefined || x === null || x === "") {
      if (opcional) return null;
      throw new ErrorCampo("Es obligatorio");
    }
    const n = Number(x);
    if (!Number.isInteger(n)) throw new ErrorCampo("Debe ser un número entero");
    if (n < min || n > max) throw new ErrorCampo(`Debe estar entre ${min} y ${max}`);
    return n;
  },
  opcion: (opciones, { opcional = false } = {}) => (x) => {
    x = unico(x);
    if ((x === undefined || x === null || x === "") && opcional) return null;
    if (!opciones.includes(x)) throw new ErrorCampo("Opción no válida");
    return x;
  },
  lista: (opciones) => (x) => {
    const arr = x === undefined || x === null || x === "" ? [] : Array.isArray(x) ? x : [x];
    for (const a of arr) if (!opciones.includes(a)) throw new ErrorCampo(`"${a}" no es válido`);
    return [...new Set(arr)];
  },
  fecha: () => (x) => {
    x = unico(x);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(x ?? "") || Number.isNaN(Date.parse(x))) throw new ErrorCampo("Fecha no válida");
    return x;
  },
  hora: ({ opcional = false } = {}) => (x) => {
    x = unico(x);
    if ((x === undefined || x === null || x === "") && opcional) return null;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(x ?? "")) throw new ErrorCampo("Hora no válida");
    return x;
  },
  booleano: () => (x) => {
    x = unico(x);
    if (x === true || x === "true") return true;
    if (x === false || x === "false") return false;
    throw new ErrorCampo("Debe ser verdadero o falso");
  }
};

/**
 * Valida `datos` con el `esquema` { campo: validador }. Devuelve un objeto solo con los campos del esquema.
 * Con `parcial`, ignora los campos ausentes (para PATCH).
 */
export function validar(datos, esquema, { parcial = false } = {}) {
  const limpio = {};
  const errores = {};
  for (const [campo, fn] of Object.entries(esquema)) {
    if (parcial && !(campo in (datos || {}))) continue;
    try {
      limpio[campo] = fn(datos?.[campo]);
    } catch (e) {
      if (!(e instanceof ErrorCampo)) throw e;
      errores[campo] = e.message;
    }
  }
  if (Object.keys(errores).length) throw new HttpError(400, "Revisa los datos enviados", errores);
  return limpio;
}
