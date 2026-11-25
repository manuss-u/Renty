// Ingreso, registro, cierre de sesión y acceso según el rol.
import { CUENTAS, PASSWORD } from "../support/commands.js";

const PANELES = {
  arrendatario: "/panel-arrendatario.html",
  propietario: "/panel-propietario.html",
  inmobiliaria: "/panel-inmobiliaria.html",
  admin: "/panel-admin.html"
};

describe("Ingreso", () => {
  it("rechaza una contraseña incorrecta", () => {
    cy.visit("/login.html");
    cy.get("#email").type(CUENTAS.propietario);
    cy.get("#pass").type("incorrecta");
    cy.get("#login [type=submit]").click();
    cy.get("#err").should("be.visible").and("contain", "Correo o contraseña incorrectos");
  });

  it("ingresa con el formulario y llega al panel de su rol", () => {
    cy.visit("/login.html");
    cy.get("#email").type(CUENTAS.inmobiliaria);
    cy.get("#pass").type(PASSWORD);
    cy.get("#login [type=submit]").click();
    cy.location("pathname").should("eq", PANELES.inmobiliaria);
    cy.get("#empresa").should("have.text", "Inmobiliaria Arrayán");
  });

  for (const [rol, panel] of Object.entries(PANELES)) {
    it(`la cuenta de demostración de ${rol} abre su panel`, () => {
      cy.visit("/login.html");
      cy.get(`[data-demo="${CUENTAS[rol]}"]`).click();
      cy.location("pathname").should("eq", panel);
    });
  }

  it("después de ingresar vuelve a la página que se estaba viendo", () => {
    cy.visit("/login.html?next=propiedad.html%3Fid%3D2");
    cy.get(`[data-demo="${CUENTAS.arrendatario}"]`).click();
    cy.location("pathname").should("eq", "/propiedad.html");
    cy.location("search").should("eq", "?id=2");
  });
});

describe("Acceso según el rol", () => {
  it("sin sesión, un panel lleva al ingreso", () => {
    cy.visit(PANELES.propietario);
    cy.location("pathname").should("eq", "/login.html");
  });

  it("un arrendatario no puede entrar al panel de propietario ni publicar", () => {
    cy.ingresar("arrendatario");
    cy.visit(PANELES.propietario);
    cy.location("pathname").should("eq", PANELES.arrendatario);
    cy.visit("/publicar.html");
    cy.location("pathname").should("eq", PANELES.arrendatario);
  });

  it("un administrador no entra a los paneles de los demás", () => {
    cy.ingresar("admin");
    cy.visit(PANELES.inmobiliaria);
    cy.location("pathname").should("eq", PANELES.admin);
  });
});

describe("Menú del perfil y cierre de sesión", () => {
  it("muestra nombre y correo, sin el rol, y cierra la sesión", () => {
    cy.ingresar("arrendatario");
    cy.visit(PANELES.arrendatario);
    cy.get(".navbar .dropdown > button").click();
    cy.get(".navbar .dropdown-menu")
      .should("contain", "Camila Torres")
      .and("contain", CUENTAS.arrendatario)
      .and("not.contain", "Arrendatario");
    cy.get("[data-logout]").click();
    cy.location("pathname").should("eq", "/index.html");
    cy.visit(PANELES.arrendatario);
    cy.location("pathname").should("eq", "/login.html");
  });
});

describe("Registro", () => {
  const llenar = (correo) => {
    cy.get("#nombre").type("Pedro Ruiz");
    cy.get("#tel").type("3009998877");
    cy.get("#email").type(correo);
    cy.get("#pass").type("clave-segura");
    cy.get("#tyc").check();
  };

  it("crea una cuenta de propietario y abre su panel vacío", () => {
    cy.visit("/registro.html?rol=propietario");
    llenar("pedro.ruiz@correo.co");
    cy.get("#reg [type=submit]").click();
    cy.location("pathname").should("eq", PANELES.propietario);
    cy.contains("Aún no has publicado propiedades").should("be.visible");
  });

  it("avisa cuando el correo ya está registrado", () => {
    cy.visit("/registro.html?rol=propietario");
    llenar(CUENTAS.propietario);
    cy.get("#reg [type=submit]").click();
    cy.get("#email").should("have.class", "is-invalid");
    cy.contains("[data-error-servidor]", "Ya existe una cuenta con ese correo").should("be.visible");
  });

  it("la inmobiliaria debe indicar su empresa y NIT", () => {
    cy.visit("/registro.html?rol=inmobiliaria");
    cy.get("#empresa").should("be.visible");
    llenar("nueva@inmobiliaria.co");
    cy.get("#reg [type=submit]").click();
    cy.location("pathname").should("eq", "/registro.html");
    cy.get("#empresa:invalid").should("exist");
  });
});
