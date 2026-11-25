// Lo que ve cualquier visitante, sin iniciar sesión.

describe("Portada", () => {
  it("muestra las propiedades destacadas y los tipos de propiedad", () => {
    cy.visit("/");
    cy.get("#destacadas .prop-card").should("have.length", 6);
    cy.get("#tipos .type-tile").should("have.length", 5).first().should("contain", "Apartamentos").and("contain", "disponibles");
  });

  it("el buscador lleva al listado con los filtros aplicados", () => {
    cy.visit("/");
    cy.get("#hCiudad").select("Bogotá");
    cy.get("form.search-box [type=submit]").click();
    cy.location("search").should("include", "operacion=renta").and("include", "ciudad=Bogot");
    cy.get("#titulo").should("have.text", "Propiedades en renta en Bogotá");
    cy.get("#conteo").should("have.text", "3 propiedades encontradas");
  });
});

describe("Listado y filtros", () => {
  beforeEach(() => cy.visit("/propiedades.html"));

  it("combina filtros, actualiza la dirección y permite quitarlos con las etiquetas", () => {
    cy.get("#conteo").should("have.text", "11 propiedades encontradas");
    cy.get("label[for=fOpR]").click();
    cy.get("#fT_apartamento").check();
    cy.contains("#fAmen label", "Mascotas").click();

    cy.get("#conteo").should("have.text", "1 propiedad encontrada");
    cy.get("#resultados .prop-card").should("have.length", 1).and("contain", "Apartamento luminoso con balcón");
    cy.location("search").should("include", "operacion=renta").and("include", "tipo=apartamento").and("include", "amen=Mascotas");

    cy.get(".chip").should("have.length", 3).first().click(); // quita "Renta"
    cy.get("#conteo").should("have.text", "2 propiedades encontradas");
  });

  it("filtra por precio y ordena por precio", () => {
    cy.get("#fMax").type("2000000");
    cy.get("#conteo").should("have.text", "2 propiedades encontradas");
    cy.get("#orden").select("precio-asc");
    cy.get("#resultados .prop-price").first().should("contain", "$1.100.000");
  });

  it("encuentra resultados aunque no se escriban las tildes", () => {
    cy.visit("/propiedades.html?q=balcon");
    cy.get("#conteo").should("have.text", "1 propiedad encontrada");
  });

  it("sin resultados muestra un mensaje y un botón para limpiar los filtros", () => {
    cy.get("#fMax").type("1000");
    cy.contains(".empty-state", "No hay propiedades con esos filtros").should("be.visible");
    cy.contains(".empty-state button", "Limpiar filtros").click();
    cy.get("#conteo").should("have.text", "11 propiedades encontradas");
  });

  it("al tocar el corazón sin sesión pide ingresar y vuelve a la búsqueda", () => {
    cy.get("#resultados .fav-btn").first().click();
    cy.location("pathname").should("eq", "/login.html");
    cy.location("search").should("include", "next=propiedades.html");
  });
});

describe("Detalle de una propiedad", () => {
  beforeEach(() => cy.visit("/propiedad.html?id=1"));

  it("muestra las características en una sola lista", () => {
    cy.get("h1").should("have.text", "Apartamento luminoso con balcón");
    cy.get(".ficha li").should("have.length", 5);
    cy.get(".ficha").should("contain", "Habitaciones").and("contain", "68 m²").and("contain", "Precio por m²");
  });

  it("la ubicación abre Google Maps en otra pestaña sin revelar la dirección exacta", () => {
    cy.get("a.map-link")
      .should("have.attr", "target", "_blank")
      .and("have.attr", "href")
      .and("include", "google.com/maps")
      .and("include", "Chapinero");
    cy.get("a.map-link").invoke("attr", "href").should("not.include", "Cra");
  });

  it("los botones de contacto no tienen íconos", () => {
    cy.get("[data-accion=visita]").should("have.text", "Solicitar visita").find("i").should("not.exist");
    cy.get("[data-accion=mensaje]").should("have.text", "Solo enviar mensaje").find("i").should("not.exist");
  });

  it("muestra propiedades similares", () => {
    cy.get("#similares .prop-card").should("have.length.at.least", 1);
  });
});

describe("Moderación vista por el público", () => {
  it("una propiedad pendiente de revisión no se puede ver", () => {
    cy.visit("/propiedad.html?id=13");
    cy.contains("No encontramos esta propiedad").should("be.visible");
    cy.visit("/propiedades.html?q=Habitaci%C3%B3n%20amoblada");
    cy.get("#conteo").should("have.text", "0 propiedades encontradas");
  });
});
