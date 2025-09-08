'use client'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: '📊', current: true },
  { name: 'Arbitraje', href: '/arbitrage', icon: '⚡', current: false },
  { name: 'Protocolos', href: '/protocols', icon: '🔗', current: false },
  { name: 'Blockchains', href: '/blockchains', icon: '🔷', current: false },
  { name: 'Estrategias', href: '/strategies', icon: '🎯', current: false },
  { name: 'Simulador', href: '/simulator', icon: '🧪', current: false },
  { name: 'Seguridad', href: '/security', icon: '🛡️', current: false },
  { name: 'Automatización', href: '/automation', icon: '🤖', current: false },
]

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white dark:bg-slate-800 px-6 pb-4 shadow-xl border-r border-gray-200 dark:border-slate-700">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-arbitrage rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AX</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                  ArbitrageX
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Supreme Catalyst
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <a
                        href={item.href}
                        className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors duration-200 ${
                          item.current
                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                            : 'text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span className="text-lg">{item.icon}</span>
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>

              {/* System Status */}
              <li className="mt-auto">
                <div className="dashboard-panel p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Estado del Sistema
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Blockchains</span>
                      <span className="status-active">20 Activas</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Protocolos</span>
                      <span className="status-active">450 Conectados</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Estrategias</span>
                      <span className="status-active">12 Ejecutando</span>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <div className={`lg:hidden ${isOpen ? 'relative z-50' : 'hidden'}`}>
        <div className="fixed inset-0 flex">
          <div className="relative mr-16 flex w-full max-w-xs flex-1">
            <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white dark:bg-slate-800 px-6 pb-4">
              {/* Mobile Logo */}
              <div className="flex h-16 shrink-0 items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-arbitrage rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">AX</span>
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                      ArbitrageX
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Supreme Catalyst
                    </p>
                  </div>
                </div>
              </div>

              {/* Mobile Navigation */}
              <nav className="flex flex-1 flex-col">
                <ul role="list" className="flex flex-1 flex-col gap-y-7">
                  <li>
                    <ul role="list" className="-mx-2 space-y-1">
                      {navigation.map((item) => (
                        <li key={item.name}>
                          <a
                            href={item.href}
                            onClick={onClose}
                            className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold ${
                              item.current
                                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                                : 'text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                            }`}
                          >
                            <span className="text-lg">{item.icon}</span>
                            {item.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </li>
                </ul>
              </nav>
            </div>

            {/* Close button */}
            <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
              <button
                type="button"
                className="-m-2.5 p-2.5"
                onClick={onClose}
              >
                <span className="sr-only">Close sidebar</span>
                <span className="text-white text-xl">✕</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}