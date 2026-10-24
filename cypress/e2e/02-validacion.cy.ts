import { get, reset, dates } from './helpers';
describe('Recorrido 2: validación', () => {
  beforeEach(reset);
  it('rechaza fechas incompletas e invertidas sin crear solicitudes ni filas', () => {
    cy.intercept('POST', '/api/reservations', cy.spy().as('postSpy'));
    get('select-room-1').click(); get('confirm').click();
    get('message').should('be.visible').and('contain.text', 'Completa las fechas');
    cy.get('@postSpy').should('not.have.been.called');
    cy.request('/api/reservations').its('body').should('deep.equal', []);
    const range = dates();
    get('check-in').type(range.checkOut); get('check-out').type(range.checkIn);
    get('confirm').click();
    get('message').should('contain.text', 'La salida debe ser posterior');
    cy.screenshot('03-validacion-fechas', { capture: 'fullPage' });
    cy.get('@postSpy').should('not.have.been.called');
    cy.request('/api/reservations').its('body').should('deep.equal', []);
  });
});
