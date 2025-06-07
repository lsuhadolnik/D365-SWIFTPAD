describe('Levelup Extension', () => {
  it('handles navigation message', () => {
    let origin = '';
    cy.visit('cypress/fixtures/mock-dynamics.html', {
      onBeforeLoad(win) {
        origin = win.location.origin;
        win.open = cy.stub().as('winOpen');
        win.Xrm = {
          Page: {
            context: {
              getClientUrl: () => origin,
              getOrgUniqueName: () => 'org',
              getVersion: () => '9.1',
              getUserId: () => '{id}',
            },
            data: {},
          },
          Internal: { isUci: () => true },
        } as any;
      },
    });

    cy.window().then((win) => {
      win.postMessage({ category: 'Navigation', type: 'openMain' }, '*');
    });

    cy.get('@winOpen').should('have.been.calledWith', origin, '_blank');
  });
});
