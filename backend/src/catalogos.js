export const CIUDADES = ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena"];

export const TIPOS = {
  apartamento: { nombre: "Apartamento", plural: "Apartamentos", icon: "bi-building" },
  casa:        { nombre: "Casa",        plural: "Casas",        icon: "bi-house-door" },
  estudio:     { nombre: "Estudio",     plural: "Estudios",     icon: "bi-door-open" },
  local:       { nombre: "Local",       plural: "Locales",      icon: "bi-shop" },
  oficina:     { nombre: "Oficina",     plural: "Oficinas",     icon: "bi-briefcase" }
};

export const AMENIDADES = ["Mascotas", "Amoblado", "Parqueadero", "Ascensor", "Balcón", "Piscina", "Gimnasio", "Vigilancia 24h", "Zona BBQ"];

// Roles con los que alguien puede registrarse
export const ROLES_PUBLICOS = ["arrendatario", "propietario", "inmobiliaria"];
export const ROLES = [...ROLES_PUBLICOS, "admin"];
