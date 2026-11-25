// Comprobaciones en pantalla de celular.

describe("En el celular", () => {
  beforeEach(() => cy.viewport("iphone-x"));

  for (const pagina of ["/", "/propiedades.html", "/propiedad.html?id=4", "/login.html", "/registro.html"]) {
    it(`${pagina} no se desborda a lo ancho`, () => {
      cy.visit(pagina);
      cy.get("footer").should("exist"); // la página terminó de pintarse
      cy.sinDesbordeHorizontal();
    });
  }

  for (const rol of ["arrendatario", "propietario", "inmobiliaria", "admin"]) {
    it(`el panel de ${rol} no se desborda a lo ancho`, () => {
      cy.ingresar(rol);
      cy.visit(`/panel-${rol}.html`);
      cy.get("footer").should("exist");
      cy.sinDesbordeHorizontal();
    });
  }

  it("los filtros se abren en un panel lateral", () => {
    cy.visit("/propiedades.html");
    cy.get("#filtros").should("not.be.visible");
    cy.contains("button", "Filtros").click();
    cy.get("#filtros").should("be.visible");
    cy.get("label[for=fOpV]").click();
    cy.contains("#filtros button", "Ver resultados").click();
    cy.get("#conteo").should("contain", "propiedades encontradas");
    cy.location("search").should("include", "operacion=venta");
  });
});
