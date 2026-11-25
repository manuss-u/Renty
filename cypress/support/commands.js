// Comandos propios para las pruebas de Renty.

export const CUENTAS = {
  arrendatario: "arrendatario@renty.app",
  propietario: "propietario@renty.app",
  inmobiliaria: "inmobiliaria@renty.app",
  admin: "admin@renty.app",
  habitat: "contacto@habitatnorte.co" // otra inmobiliaria de los datos de ejemplo
};
export const PASSWORD = "renty123";

/** Restablece la base de pruebas con los datos de ejemplo. */
Cypress.Commands.add("reiniciarDatos", () => cy.task("reiniciarDatos", null, { log: false }));

/** Inicia sesión por la API (más rápido que llenar el formulario); la cookie queda en el navegador. */
Cypress.Commands.add("ingresar", (cuenta) => {
  cy.request("POST", "/api/auth/login", { email: CUENTAS[cuenta], password: PASSWORD });
});

/** Espera a que las pestañas del panel respondan a los clics (la página carga sesión y datos primero). */
Cypress.Commands.add("panelListo", () => cy.get(".pestanas[data-listo]"));

/** Fecha AAAA-MM-DD dentro de `dias` días. */
export const enDias = (dias) => new Date(Date.now() + dias * 864e5).toISOString().slice(0, 10);

/** Comprueba que la página no se desborde a lo ancho (útil en móvil). */
Cypress.Commands.add("sinDesbordeHorizontal", () => {
  // Espera a que cargue la tipografía: mientras tanto se usa una letra de respaldo más ancha
  cy.document().its("fonts.status").should("eq", "loaded");
  cy.document().then((doc) => {
    expect(doc.documentElement.scrollWidth, "ancho de la página").to.be.at.most(doc.documentElement.clientWidth);
  });
});
