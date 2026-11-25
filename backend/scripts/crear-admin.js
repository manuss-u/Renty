// Crea un administrador o convierte en administrador una cuenta existente
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { migrar, pool, uno } from "../src/db.js";
import { hashPassword } from "../src/auth.js";

const rl = readline.createInterface({ input: stdin, output: stdout });
const preguntar = async (texto, valor) => valor || (await rl.question(texto)).trim();

try {
  await migrar({ silencioso: true });
  const email = (await preguntar("Correo del administrador: ", process.env.ADMIN_EMAIL)).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Correo no válido");

  const existente = await uno("SELECT id, rol FROM usuarios WHERE lower(email) = $1", [email]);
  if (existente) {
    const ok = process.env.ADMIN_EMAIL ? "s" : await rl.question(`Ya existe una cuenta ${existente.rol} con ese correo. ¿Convertirla en administrador? (s/n) `);
    if (!/^s/i.test(ok)) throw new Error("Cancelado");
    await uno("UPDATE usuarios SET rol = 'admin', activo = TRUE WHERE id = $1", [existente.id]);
    console.log(`${email} ahora es administrador. Usa su contraseña de siempre.`);
  } else {
    const nombre = await preguntar("Nombre: ", process.env.ADMIN_NOMBRE);
    const password = await preguntar("Contraseña (mínimo 8 caracteres): ", process.env.ADMIN_PASSWORD);
    if (nombre.length < 2) throw new Error("Escribe un nombre");
    if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");
    await uno("INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES ($1, $2, $3, 'admin')", [email, await hashPassword(password), nombre]);
    console.log(`Administrador ${email} creado. Ya puede ingresar en /login.html`);
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  rl.close();
  await pool.end();
}
