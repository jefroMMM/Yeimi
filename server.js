const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const { mkdirSync } = require('node:fs');
const path = require('node:path');
const testing = process.argv.includes('--test');
mkdirSync(path.join(__dirname, 'data'), { recursive: true });
const db = new DatabaseSync(path.join(__dirname, 'data', testing ? 'hotel-test.sqlite' : 'hotel.sqlite'));
db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, price INTEGER NOT NULL, capacity INTEGER NOT NULL, available INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, roomId INTEGER NOT NULL REFERENCES rooms(id), checkIn TEXT NOT NULL, checkOut TEXT NOT NULL, guests INTEGER NOT NULL, nights INTEGER NOT NULL, total INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS prevent_overlap BEFORE INSERT ON reservations
WHEN EXISTS (SELECT 1 FROM reservations WHERE roomId=NEW.roomId AND checkIn<NEW.checkOut AND checkOut>NEW.checkIn)
BEGIN SELECT RAISE(ABORT, 'overlap'); END;`);
function seed() {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('DELETE FROM reservations; DELETE FROM rooms;');
    const insert = db.prepare('INSERT INTO rooms VALUES (?,?,?,?,?,?)');
    insert.run(1, 'Brisa del amanecer', 'Doble estándar', 85, 2, 1);
    insert.run(2, 'Horizonte dorado', 'Suite superior', 140, 4, 1);
    insert.run(3, 'Refugio de luna', 'Individual', 60, 1, 0);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
if (!db.prepare('SELECT count(*) AS n FROM rooms').get().n || process.argv.includes('--seed')) seed();
function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', mode: testing ? 'test' : 'normal' }));
  if (testing) app.post('/api/test/reset', (_req, res) => { seed(); res.json({ ok: true }); });
  app.get('/api/rooms', (req, res) => {
    const { checkIn, checkOut } = req.query;
    if ((checkIn || checkOut) && (!validDate(checkIn) || !validDate(checkOut) || checkOut <= checkIn)) return res.status(400).json({ error: 'Fechas inválidas.' });
    const rooms = db.prepare('SELECT * FROM rooms').all().map(room => ({ ...room, available: Boolean(room.available) && (!checkIn || !db.prepare('SELECT id FROM reservations WHERE roomId=? AND checkIn<? AND checkOut>?').get(room.id, checkOut, checkIn)) }));
    res.json(rooms);
  });
  app.get('/api/reservations', (_req, res) => res.json(db.prepare('SELECT * FROM reservations ORDER BY rowid').all()));
  app.get('/api/reservations/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM reservations WHERE id=?').get(req.params.id);
    row ? res.json(row) : res.status(404).json({ error: 'Reserva no encontrada.' });
  });
  app.post('/api/reservations', (req, res) => {
    const { roomId, checkIn, checkOut, guests } = req.body || {};
    const today = new Date().toISOString().slice(0, 10);
    if (!Number.isInteger(roomId) || !validDate(checkIn) || !validDate(checkOut) || checkOut <= checkIn || checkIn < today || !Number.isInteger(guests) || guests < 1) return res.status(400).json({ error: 'Revisa habitación, fechas y huéspedes.' });
    const room = db.prepare('SELECT * FROM rooms WHERE id=?').get(roomId);
    if (!room) return res.status(404).json({ error: 'Habitación no encontrada.' });
    if (guests > room.capacity) return res.status(400).json({ error: `Máximo ${room.capacity} huéspedes para esta habitación.` });
    const nights = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000);
    const row = { id: `AUR-${randomUUID()}`, roomId, checkIn, checkOut, guests, nights, total: nights * room.price };
    db.exec('BEGIN IMMEDIATE');
    try {
      if (!room.available || db.prepare('SELECT id FROM reservations WHERE roomId=? AND checkIn<? AND checkOut>?').get(roomId, checkOut, checkIn)) {
        db.exec('ROLLBACK'); return res.status(409).json({ error: 'La habitación no está disponible para estas fechas.' });
      }
      db.prepare('INSERT INTO reservations VALUES (?,?,?,?,?,?,?)').run(row.id, roomId, checkIn, checkOut, guests, nights, row.total);
      db.exec('COMMIT'); res.status(201).json(row);
    } catch (error) { db.exec('ROLLBACK'); res.status(500).json({ error: 'No pudimos guardar la reserva. Intenta de nuevo.' }); }
  });
  app.use(express.static(path.join(__dirname, 'public')));
  app.use((error, _req, res, _next) => res.status(error.status === 400 ? 400 : 500).json({ error: 'Solicitud inválida o error del servidor.' }));
  return app;
}
if (require.main === module) {
  if (process.argv.includes('--seed')) { console.log(`Datos preparados: ${testing ? 'pruebas' : 'normal'}`); db.close(); }
  else { const port = testing ? 4311 : 4310; createApp().listen(port, '127.0.0.1', () => console.log(`Hotel Aurora: http://127.0.0.1:${port}`)); }
}
module.exports = { createApp, db, seed };
