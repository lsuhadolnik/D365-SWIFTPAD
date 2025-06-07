describe('Options Page', () => {
  it('shows extension version and sends reset message', () => {
    cy.visit('dist/app/pages/options.html', {
      onBeforeLoad(win) {
        win.chrome = {
          runtime: {
            getManifest: () => ({ version: '1.2.3' }),
            sendMessage: cy.stub().as('sendMessage'),
            onMessage: { addListener: () => {} },
          },
        } as any;
      },
    });

    cy.contains('#version', 'v1.2.3');

    cy.get('#resetImpersonationButton').click();
    cy.get('@' + 'sendMessage').should('have.been.calledWith', {
      category: 'Impersonation',
      type: 'reset',
    });
  });
});
