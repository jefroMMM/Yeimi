export const get = (name: string) => cy.get(`[data-cy="${name}"]`);
export function dates() {
  const start = new Date(); start.setUTCDate(start.getUTCDate() + 30);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 3);
  return { checkIn: start.toISOString().slice(0, 10), checkOut: end.toISOString().slice(0, 10) };
}
export function reset() {
  cy.request('/api/health').its('body.mode').should('eq', 'test');
  cy.request('POST', '/api/test/reset').its('body.ok').should('eq', true);
  cy.intercept('GET', '/api/rooms').as('rooms');
  cy.visit('/'); cy.wait('@rooms').its('response.statusCode').should('eq', 200);
  get('select-room-3').should('be.disabled');
}
export function fill() {
  const range = dates();
  get('select-room-1').click();
  get('check-in').type(range.checkIn);
  get('check-out').type(range.checkOut);
  get('guests').clear().type('2');
  get('nights').should('have.text', '3 noches');
  get('total').should('have.text', 'US$255.00');
  return { roomId: 1, ...range, guests: 2 };
}
export function persisted(expected: ReturnType<typeof fill>) {
  get('reservation-id').invoke('text').then(id => {
    expect(id).to.match(/^AUR-[0-9a-f-]{36}$/);
    cy.request(`/api/reservations/${id}`).then(({ body, status }) => {
      expect(status).to.eq(200);
      expect(body).to.deep.equal({ id, ...expected, nights: 3, total: 255 });
      cy.task('evidence', { name: 'reserva-persistida', contents: body });
    });
    cy.request('/api/reservations').its('body').should('have.length', 1);
  });
}
