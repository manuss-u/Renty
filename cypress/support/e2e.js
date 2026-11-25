// Se carga antes de cada archivo de pruebas.
import "./commands.js";

// Cada prueba empieza con los datos de ejemplo y sin sesión.
beforeEach(() => {
  cy.reiniciarDatos();
  cy.clearCookies();
});
