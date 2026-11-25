// Panel del arrendatario y acciones sobre las propiedades.
import { enDias } from "../support/commands.js";

describe("Panel del arrendatario", () => {
  beforeEach(() => {
    cy.ingresar("arrendatario");
    cy.visit("/panel-arrendatario.html");
    cy.panelListo();
  });

  it("muestra las secciones como pestañas con su número", () => {
    cy.get(".pestanas [role=tab]").should("have.length", 4);
    cy.get("#t-favoritos").should("contain", "Favoritos").and("contain", "3").and("have.attr", "aria-selected", "true");
    cy.get("#t-busquedas").should("contain", "3");
    cy.get("#t-visitas").should("contain", "2");
    cy.get("#t-mensajes").should("contain", "1");
    cy.get("#v-favoritos .prop-card").should("have.length", 3);
  });

  it("al elegir una pestaña solo cambia la vista y la dirección la recuerda", () => {
    cy.get("#t-busquedas").click();
    cy.get("#v-busquedas").should("be.visible");
    cy.get("#v-favoritos").should("not.be.visible");
    cy.location("hash").should("eq", "#busquedas");
    cy.get("#busquedas .list-row").should("have.length", 3);

    cy.get("#t-visitas").click();
    cy.get("#visitas .list-row").should("have.length", 2);

    cy.get("#t-mensajes").click();
    cy.get("#conversaciones .list-row").should("have.length.at.least", 1);
  });

  it("se puede cambiar de pestaña con las flechas del teclado", () => {
    cy.get("#t-favoritos").focus().type("{rightarrow}");
    cy.get("#t-busquedas").should("have.attr", "aria-selected", "true").and("have.focus");
    cy.focused().type("{leftarrow}");
    cy.get("#t-favoritos").should("have.attr", "aria-selected", "true").and("have.focus");
    cy.focused().type("{leftarrow}"); // desde la primera, vuelve a la última
    cy.get("#t-mensajes").should("have.attr", "aria-selected", "true").and("have.focus");
    cy.get("#v-mensajes").should("be.visible");
  });

  it("un enlace con #visitas abre esa pestaña", () => {
    cy.visit("/panel-arrendatario.html#visitas");
    cy.get("#v-visitas").should("be.visible");
    cy.get("#t-visitas").should("have.attr", "aria-selected", "true");
  });

  it("quitar un favorito lo saca de la lista y baja el número", () => {
    cy.get("#v-favoritos .prop-card").should("have.length", 3);
    cy.get("#v-favoritos .fav-btn").first().click();
    cy.get("#v-favoritos .prop-card").should("have.length", 2);
    cy.get("#nFavs").should("have.text", "2");
  });

  it("los estados son un punto y texto de color, sin fondo", () => {
    cy.get("#t-busquedas").click();
    cy.get("#busquedas .estado").first()
      .should("contain", "nueva")
      .and("have.css", "background-color", "rgba(0, 0, 0, 0)");
  });

  it("no muestra el rol con ícono ni dice «Panel de»", () => {
    cy.get(".eyebrow").should("have.text", "Arrendatario");
    cy.contains("Panel de").should("not.exist");
    cy.get(".role-badge").should("not.exist");
  });
});

describe("Contacto con quien publica", () => {
  beforeEach(() => cy.ingresar("arrendatario"));

  it("solicitar una visita exige fecha y luego aparece en el panel", () => {
    cy.visit("/propiedad.html?id=2");
    cy.get("[data-accion=visita]").click();
    cy.get("#cFecha:invalid").should("exist");

    cy.get("#cFecha").type(enDias(5));
    cy.get("#cHora").select("15:00");
    cy.get("[data-accion=visita]").click();
    cy.contains(".alert-success", "Solicitud enviada").should("contain", "Inmobiliaria Arrayán");

    cy.visit("/panel-arrendatario.html#visitas");
    cy.get("#t-visitas").should("contain", "3");
    cy.contains("#visitas .list-row", "Casa familiar con jardín").should("contain", "Pendiente");
  });

  it("enviar un mensaje abre la conversación y permite seguir escribiendo", () => {
    cy.visit("/propiedad.html?id=5");
    cy.get("#cMsg").clear().type("¿Tiene baño para clientes?");
    cy.get("[data-accion=mensaje]").click();
    cy.location("pathname").should("eq", "/mensajes.html");
    cy.get("#cabecera").should("contain", "Hábitat Norte");
    cy.get(".bubble").last().should("contain", "¿Tiene baño para clientes?");

    cy.get("#txt").type("Gracias{enter}");
    cy.get(".bubble.me").last().should("contain", "Gracias");
  });

  it("guardar una búsqueda la agrega al panel", () => {
    cy.visit("/propiedades.html?operacion=venta");
    cy.get("#guardar").click();
    cy.contains(".toast", "Búsqueda guardada").should("be.visible");
    cy.visit("/panel-arrendatario.html#busquedas");
    cy.get("#busquedas .list-row").should("have.length", 4);
  });

  it("guardar un favorito desde el listado lo suma al panel", () => {
    cy.visit("/propiedades.html");
    cy.get("#resultados .fav-btn:not(.active)").first().click().should("have.class", "active");
    cy.visit("/panel-arrendatario.html");
    cy.get("#nFavs").should("have.text", "4");
  });
});
