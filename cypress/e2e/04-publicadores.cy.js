// Paneles de propietario e inmobiliaria, y publicación de propiedades.

describe("Panel del propietario", () => {
  beforeEach(() => {
    cy.ingresar("propietario");
    cy.visit("/panel-propietario.html");
    cy.panelListo();
  });

  it("muestra pestañas con su número y un resumen", () => {
    cy.get("#t-propiedades").should("contain", "Mis propiedades").and("contain", "4");
    cy.get("#t-visitas").should("contain", "2");
    cy.get("#t-interesados").should("contain", "3");
    cy.get("#resumenProps").should("contain", "2 publicadas").and("contain", "vistas en total");
    cy.get("#filas tr").should("have.length", 4);
  });

  it("avisa de la propiedad rechazada y muestra el motivo", () => {
    cy.get("#avisoModeracion").should("contain", "1 propiedad fue rechazada");
    cy.contains("#filas tr", "Apto barato").should("contain", "Rechazada").and("contain", "datos de contacto");
  });

  it("confirmar una visita baja el número de pendientes", () => {
    cy.get("#t-visitas").click();
    cy.get("#solicitudes [data-resp=confirmada]").first().click();
    cy.contains(".toast", "Visita confirmada").should("be.visible");
    cy.get("#t-visitas").should("contain", "1");
  });

  it("pausar una propiedad cambia su estado", () => {
    cy.contains("#filas tr", "Estudio amoblado").within(() => {
      cy.get("[data-bs-toggle=dropdown]").click();
      cy.get("[data-estado]").click();
    });
    cy.contains("#filas tr", "Estudio amoblado").find(".estado").should("have.text", "Pausada");
  });

  it("la pestaña Interesados lleva a la conversación", () => {
    cy.get("#t-interesados").click();
    cy.get("#leads .list-row").should("have.length", 3).first().find("a").click();
    cy.location("pathname").should("eq", "/mensajes.html");
    cy.get(".bubble").should("have.length.at.least", 1);
  });
});

describe("Publicar una propiedad", () => {
  beforeEach(() => cy.ingresar("propietario"));

  it("no se envía con campos vacíos", () => {
    cy.visit("/publicar.html");
    cy.get("#pub").should("be.visible");
    cy.get("#pub [type=submit]").click();
    cy.get("#pub :invalid").should("have.length.at.least", 5);
    cy.get("#ok").should("not.be.visible");
  });

  it("se publica con foto, queda en revisión y el público aún no la ve", () => {
    cy.visit("/publicar.html");
    cy.get("#tipo").select("apartamento");
    cy.get("#tit").type("Apartamento de prueba Cypress");
    cy.get("#desc").type("Descripción de prueba suficientemente larga para pasar la validación del servidor.");
    cy.get("#ciudad").select("Cali");
    cy.get("#zona").type("San Fernando");
    cy.get("#dir").type("Cl 5 # 38-10");
    cy.get("#area").type("70");
    cy.get("#precio").type("1900000");
    cy.contains("#amen label", "Mascotas").click();
    cy.get("#fotos").selectFile("cypress/fixtures/casa.png", { force: true });
    cy.get(".foto-item").should("have.length", 1);
    cy.get("#pub [type=submit]").click();

    cy.get("#okTitulo").should("contain", "en revisión");
    cy.get("#verAnuncio").click();
    cy.get(".gallery img").should("have.length", 1);
    cy.get(".sticky-side .alert").should("contain", "en revisión");

    cy.clearCookies();
    cy.visit("/propiedades.html?q=Cypress");
    cy.get("#conteo").should("have.text", "0 propiedades encontradas");
  });

  it("editar precarga los datos y avisa que vuelve a revisión", () => {
    cy.visit("/publicar.html?editar=1");
    cy.get("#tit").should("have.value", "Apartamento luminoso con balcón");
    cy.get("#dir").should("have.value", "Cra 4 # 57-20, apto 702");
    cy.get("#pub").should("contain", "vuelve a revisión");
  });

  it("no permite editar propiedades de otra persona", () => {
    cy.visit("/publicar.html?editar=2");
    cy.contains("Solo puedes editar tus propias propiedades").should("be.visible");
  });
});

describe("Panel de la inmobiliaria", () => {
  beforeEach(() => {
    cy.ingresar("inmobiliaria");
    cy.visit("/panel-inmobiliaria.html");
    cy.panelListo();
  });

  it("muestra pestañas de portafolio, prospectos, visitas y equipo", () => {
    cy.get("#t-portafolio").should("contain", "5");
    cy.get("#t-prospectos").should("contain", "4");
    cy.get("#t-equipo").should("contain", "4");
    cy.get("#filas tr").should("have.length", 5);
  });

  it("filtra el portafolio por agente y reasigna una propiedad", () => {
    cy.get("#fAg").select("Daniela Ruiz");
    cy.get("#filas tr").should("have.length", 2);
    cy.get("#fAg").select("");
    cy.get("#filas select[data-agente]").first().select("Paula Cárdenas");
    cy.contains(".toast", "Asignada a Paula Cárdenas").should("be.visible");
  });

  it("agrega un agente al equipo y no permite repetirlo", () => {
    cy.get("#t-equipo").click();
    cy.get("#v-equipo [data-bs-target='#mAgente']").click();
    cy.get("#mAgente").should("be.visible");
    cy.get("#aNombre").type("Lucía Prieto");
    cy.get("#aMail").type("lucia@arrayan.co");
    cy.get("#invitar [type=submit]").click();
    cy.get("#mAgente").should("not.be.visible"); // espera a que termine la animación de cierre
    cy.get("#t-equipo").should("contain", "5");
    cy.contains("#equipo .list-row", "Lucía Prieto").should("contain", "Invitado");

    cy.get("#v-equipo [data-bs-target='#mAgente']").click();
    cy.get("#mAgente").should("be.visible");
    cy.get("#aNombre").type("Lucía Prieto");
    cy.get("#aMail").type("lucia@arrayan.co");
    cy.get("#invitar [type=submit]").click();
    cy.contains("#invitar [data-error-servidor]", "Ese correo ya está en tu equipo").should("be.visible");
  });
});
