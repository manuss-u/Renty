// Base de datos y puerto que usan las pruebas de interfaz.
// Por seguridad solo se aceptan bases cuyo nombre contenga "test": las pruebas BORRAN sus datos.
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL || process.env.TEST_DATABASE_URL || "postgres://renty:renty@localhost:5432/renty_test";

export const E2E_PUERTO = 3100;

if (!/test/.test(new URL(E2E_DATABASE_URL).pathname)) {
  throw new Error(`Las pruebas de interfaz solo corren en una base cuyo nombre contenga "test" (recibí ${new URL(E2E_DATABASE_URL).pathname}).`);
}
