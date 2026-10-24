const $ = id => document.getElementById(id);
let rooms = [], selected, submitting = false;
const money = n => `US$${n.toFixed(2)}`;
const today = new Date().toISOString().slice(0, 10);
$('checkIn').min = today; $('checkOut').min = today;
function message(text) { $('message').textContent = text; $('message').hidden = !text; }
function totals() {
  const nights = Math.max(0, Math.round((Date.parse($('checkOut').value) - Date.parse($('checkIn').value)) / 86400000)) || 0;
  $('nights').textContent = `${nights} ${nights === 1 ? 'noche' : 'noches'}`;
  $('rate').textContent = selected ? money(selected.price) : '—';
  $('total').textContent = money(nights * (selected?.price || 0));
  return nights;
}
function renderRooms() {
  $('rooms').replaceChildren(...rooms.map(room => {
    const card = document.createElement('article'); card.className = `room ${selected?.id === room.id ? 'selected' : ''}`;
    card.innerHTML = `<div class="room-icon" aria-hidden="true">▱</div><div><h3>${room.name}</h3><p>${room.type} · Hasta ${room.capacity} huéspedes</p><span class="badge ${room.available ? '' : 'unavailable'}">${room.available ? 'Disponible' : 'No disponible'}</span></div><div class="room-action"><span class="price">$${room.price}<small> / noche</small></span><button type="button" data-cy="select-room-${room.id}" ${room.available ? '' : 'disabled'} aria-pressed="${selected?.id === room.id}">${selected?.id === room.id ? 'Seleccionada ✓' : 'Seleccionar'}</button></div>`;
    card.querySelector('button').onclick = () => { selected = room; $('selection').textContent = room.name; $('guests').max = room.capacity; $('success').hidden = true; message(''); renderRooms(); totals(); };
    return card;
  }));
}
fetch('/api/rooms').then(r => { if (!r.ok) throw Error(); return r.json(); }).then(data => { rooms = data; renderRooms(); }).catch(() => message('No pudimos cargar las habitaciones. Recarga la página.'));
$('booking').addEventListener('input', totals);
$('booking').addEventListener('submit', async event => {
  event.preventDefault(); if (submitting) return;
  message(''); $('success').hidden = true;
  const checkIn = $('checkIn').value, checkOut = $('checkOut').value, guests = Number($('guests').value);
  if (!selected) return message('Selecciona una habitación disponible.');
  if (!checkIn || !checkOut) return message('Completa las fechas de entrada y salida.');
  if (checkOut <= checkIn || checkIn < today) return message('La salida debe ser posterior a la entrada y la entrada no puede estar en el pasado.');
  if (!Number.isInteger(guests) || guests < 1 || guests > selected.capacity) return message(`Indica entre 1 y ${selected.capacity} huéspedes.`);
  submitting = true; $('confirm').disabled = true; $('confirm').textContent = 'Confirmando…';
  try {
    const response = await fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: selected.id, checkIn, checkOut, guests }) });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'No pudimos confirmar. Intenta de nuevo.');
    $('reservationId').textContent = data.id; $('success').hidden = false;
    $('booking').hidden = true;
  } catch (error) { message(error.message || 'Error de conexión. Intenta de nuevo.'); }
  finally { submitting = false; $('confirm').disabled = false; $('confirm').innerHTML = 'Confirmar reserva <span>→</span>'; }
});
$('newBooking').onclick = () => { $('booking').reset(); $('booking').hidden = false; $('success').hidden = true; selected = undefined; $('selection').textContent = 'Selecciona una habitación para comenzar.'; message(''); renderRooms(); totals(); };
