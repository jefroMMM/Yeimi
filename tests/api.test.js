const { test } = require('node:test');
const assert = require('node:assert/strict');
// Estas pruebas levantan su propio proceso de prueba y nunca abren hotel.sqlite.
const { spawn } = require('node:child_process');
const { once } = require('node:events');
test('API: validaciones, solapamientos, fechas contiguas y SQLite persistente', async () => {
  let child;
  async function start() {
    child = spawn(process.execPath, ['server.js', '--test'], { stdio: ['ignore', 'pipe', 'pipe'] });
    await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw Error('El servidor no inició'); })]);
  }
  const api = async (url, body) => {
    const r = await fetch(`http://127.0.0.1:4311/api/${url}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  try {
    await start(); await api('test/reset', {});
    const date = new Date(); date.setUTCDate(date.getUTCDate() + 60);
    const day = offset => new Date(date.getTime() + offset * 86400000).toISOString().slice(0, 10);
    const booking = { roomId: 1, checkIn: day(0), checkOut: day(3), guests: 2, total: 1 };
    assert.equal((await api('reservations', {})).status, 400);
    assert.equal((await api('reservations', { ...booking, guests: 3 })).status, 400);
    assert.equal((await api('reservations', { ...booking, guests: 1.5 })).status, 400);
    assert.equal((await api('reservations', { ...booking, checkOut: day(0) })).status, 400);
    assert.equal((await api('reservations', { ...booking, checkIn: '2000-01-01' })).status, 400);
    assert.equal((await api('reservations', { ...booking, roomId: 3, guests: 1 })).status, 409);
    const saved = await api('reservations', booking);
    assert.equal(saved.status, 201); assert.equal(saved.body.total, 255);
    const duplicate = await Promise.all([api('reservations', booking), api('reservations', booking)]);
    assert.deepEqual(duplicate.map(r => r.status), [409, 409]);
    assert.equal((await api('reservations', { ...booking, checkIn: day(2), checkOut: day(5) })).status, 409);
    assert.equal((await api(`rooms?checkIn=${day(1)}&checkOut=${day(2)}`)).body[0].available, false);
    assert.equal((await api('reservations', { ...booking, checkIn: day(3), checkOut: day(4) })).status, 201);
    child.kill(); await once(child, 'exit'); await start();
    assert.equal((await api(`reservations/${saved.body.id}`)).body.total, 255);
    assert.equal((await api('reservations')).body.length, 2);
  } finally { if (child) { child.kill(); await once(child, 'exit'); } }
});
