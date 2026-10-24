import { get, reset, fill, persisted } from './helpers';
describe('Recorrido 3: fallo controlado y recuperación', () => {
  beforeEach(reset);
  it('simula un 500 una sola vez y permite reintentar con la API real', () => {
    const expected = fill();
    cy.intercept({ method: 'POST', url: '/api/reservations', times: 1 }, { statusCode: 500, body: { error: 'Error HTTP 500 simulado. Intenta de nuevo.' } }).as('failure');
    get('confirm').click();
    cy.wait('@failure').then(({ request, response }) => {
      expect(request.method).to.eq('POST');
      expect(new URL(request.url).pathname).to.eq('/api/reservations');
      expect(request.body).to.deep.equal(expected);
      expect(response?.statusCode).to.eq(500);
      cy.task('evidence', { name: 'intercept-500', contents: { method: request.method, url: request.url, body: request.body, status: response?.statusCode } });
    });
    get('message').should('be.visible').and('contain.text', '500 simulado');
    get('check-in').should('have.value', expected.checkIn);
    get('check-out').should('have.value', expected.checkOut);
    get('guests').should('have.value', '2');
    get('selection').should('contain.text', 'Brisa del amanecer');
    get('total').should('have.text', 'US$255.00');
    cy.request('/api/reservations').its('body').should('deep.equal', []);
    get('layout').screenshot('04-error-500', { capture: 'fullPage' });
    cy.intercept('POST', '/api/reservations').as('retry');
    get('confirm').click(); cy.wait('@retry').its('response.statusCode').should('eq', 201);
    get('success').should('be.visible'); persisted(expected);
    get('layout').screenshot('05-recuperacion-exitosa', { capture: 'fullPage' });
  });
});
