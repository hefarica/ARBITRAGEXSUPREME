/**
 * @fileoverview Test básico para verificar configuración Jest
 * Ingenio Pichichi S.A. - ArbitrageX Supreme
 */

describe('Configuración Básica', () => {
  it('debe ejecutar tests correctamente', () => {
    expect(true).toBe(true)
  })

  it('debe tener acceso a mocks', () => {
    global.fetch = jest.fn()
    expect(global.fetch).toBeDefined()
  })
})