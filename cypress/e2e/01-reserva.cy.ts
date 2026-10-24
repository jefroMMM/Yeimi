import { get, reset, fill, persisted } from './helpers';
describe('Recorrido 1: reserva exitosa', () => {
  beforeEach(reset);
  it('calcula y persiste una reserva con identificador único', () => {
    const expected = fill();
    get('layout').screenshot('01-formulario-completo', { capture: 'fullPage' });
    cy.intercept('POST', '/api/reservations').as('create');
    get('confirm').click();
    cy.wait('@create').then(({ request, response }) => {
      expect(request.body).to.deep.equal(expected);
      expect(response?.statusCode).to.eq(201);
    });
    get('success').should('be.visible'); persisted(expected);
    get('layout').screenshot('02-reserva-exitosa', { capture: 'fullPage' });
  });
});
