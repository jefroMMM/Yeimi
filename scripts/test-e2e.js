const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
async function main() {
  const url = 'http://127.0.0.1:4311/api/health';
  try { await fetch(url); throw Error('Puerto 4311 ocupado. Cierra el servidor de pruebas antes de ejecutar este comando.'); }
  catch (error) { if (error.message.includes('ocupado')) throw error; }
  const server = spawn(process.execPath, ['server.js', '--test'], { stdio: 'inherit' });
  try {
    const deadline = Date.now() + 15000;
    while (true) {
      try { const response = await fetch(url); if (response.ok && (await response.json()).mode === 'test') break; } catch {}
      if (server.exitCode !== null || Date.now() > deadline) throw Error('El servidor de pruebas no inició.');
      await delay(100); // Sondeo de disponibilidad del servidor; no es una espera Cypress.
    }
    const runner = spawn(process.execPath, ['scripts/run-e2e.js', ...process.argv.slice(2)], { stdio: 'inherit' });
    const [code] = await once(runner, 'exit'); process.exitCode = code === 0 ? 0 : 1;
  } finally { if (server.exitCode === null) { server.kill(); await once(server, 'exit'); } }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
