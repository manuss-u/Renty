// Administración: moderación de propiedades y gestión de usuarios.
import { CUENTAS, PASSWORD } from "../support/commands.js";

describe("Moderación", () => {
  beforeEach(() => {
    cy.ingresar("admin");
    cy.visit("/panel-admin.html");
  });

  it("el menú solo tiene Moderación y Usuarios", () => {
    cy.get(".subnav .nav-link").should("have.length", 2).and("contain", "Moderación").and("contain", "Usuarios");
    cy.get(".subnav").should("not.contain", "Ver el sitio");
  });

  it("muestra la cola de pendientes", () => {
    cy.get("#lista .list-row").should("have.length", 2);
    cy.get("#nPend").should("have.text", "2");
  });

  it("aprobar una propiedad la publica", () => {
    cy.contains("#lista .list-row", "Habitación amoblada").find("[data-accion=aprobar]").click();
    cy.contains(".toast", "aprobada y publicada").should("be.visible");
    cy.get("#lista .list-row").should("have.length", 1);

    cy.clearCookies();
    cy.visit("/propiedades.html?q=Habitaci%C3%B3n%20amoblada");
    cy.get("#conteo").should("have.text", "1 propiedad encontrada");
  });

  it("rechazar exige un motivo, y quien publica lo ve en su panel", () => {
    cy.contains("#lista .list-row", "Bodega con oficina").find("[data-accion=rechazar]").click();
    cy.get("#mRechazo").should("be.visible");
    cy.get("#fRechazo [type=submit]").click();
    cy.get("#motivo:invalid").should("exist");

    cy.get("#plantilla").select(1);
    cy.get("#fRechazo [type=submit]").click();
    cy.contains(".toast", "Propiedad rechazada").should("be.visible");

    cy.clearCookies();
    cy.ingresar("habitat");
    cy.visit("/panel-inmobiliaria.html");
    cy.contains("#filas tr", "Bodega con oficina").should("contain", "Rechazada").and("contain", "Las fotos no corresponden");
  });

  it("desde el detalle se puede revisar y aprobar", () => {
    cy.visit("/propiedad.html?id=13");
    cy.get("#moderar").should("contain", "Aprobar y publicar");
    cy.get(".sticky-side").should("contain", "Dirección");
    cy.get("[data-mod=aprobar]").click();
    cy.get(".sticky-side").should("contain", "Aprobada");
  });
});

describe("Usuarios", () => {
  beforeEach(() => {
    cy.ingresar("admin");
    cy.visit("/admin-usuarios.html");
  });

  it("busca y filtra usuarios", () => {
    cy.get("#conteo").should("contain", "usuarios");
    cy.get("#rol").select("inmobiliaria");
    cy.get("#filas tr[data-id]").should("have.length", 2);
    cy.get("#q").type("habitat");
    cy.get("#filas tr[data-id]").should("have.length", 1).and("contain", "Hábitat Norte");
  });

  it("suspender una cuenta le impide ingresar y oculta sus propiedades; reactivarla lo revierte", () => {
    cy.get("#q").type("habitat");
    cy.get("#filas tr[data-id]").should("have.length", 1).find("[data-activo=false]").click();
    cy.get("#filas .estado").should("have.text", "Suspendido");

    cy.request({ method: "POST", url: "/api/auth/login", body: { email: CUENTAS.habitat, password: PASSWORD }, failOnStatusCode: false })
      .its("status").should("eq", 403);
    cy.request("/api/propiedades?q=Local%20comercial").its("body.total").should("eq", 0);

    cy.get("#filas [data-activo=true]").click();
    cy.get("#filas .estado").should("have.text", "Activo");
    cy.request("/api/propiedades?q=Local%20comercial").its("body.total").should("eq", 1);
  });

  it("no ofrece suspender la propia cuenta", () => {
    cy.get("#q").type("admin@renty.app");
    cy.get("#filas tr[data-id]").should("have.length", 1).and("contain", "(tú)").find("[data-activo]").should("not.exist");
  });
});
