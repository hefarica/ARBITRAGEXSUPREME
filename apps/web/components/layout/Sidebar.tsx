'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { 
  Home, 
  BarChart3, 
  Wallet, 
  Bell, 
  Settings, 
  Network,
  TrendingUp,
  Users,
  HelpCircle,
  ChevronRight
} from 'lucide-react';
import { memo } from 'react';

const menuItems = [
  { 
    name: 'Dashboard', 
    href: '/', 
    icon: Home,
    description: 'Panel principal'
  },
  { 
    name: 'Oportunidades', 
    href: '/opportunities', 
    icon: TrendingUp,
    description: 'Arbitrajes disponibles'
  },
  { 
    name: 'Portfolio', 
    href: '/portfolio', 
    icon: BarChart3,
    description: 'Rendimiento'
  },
  { 
    name: 'Billeteras', 
    href: '/wallets', 
    icon: Wallet,
    description: 'Gestión de wallets'
  },
  { 
    name: 'Redes', 
    href: '/networks', 
    icon: Network,
    description: 'Estado blockchain'
  },
  { 
    name: 'Transacciones', 
    href: '/transactions', 
    icon: BarChart3,
    description: 'Historial'
  },
  { 
    name: 'Alertas', 
    href: '/alerts', 
    icon: Bell,
    description: 'Notificaciones'
  },
  { 
    name: 'Configuración', 
    href: '/settings', 
    icon: Settings,
    description: 'Preferencias'
  },
  { 
    name: 'Ayuda', 
    href: '/help', 
    icon: HelpCircle,
    description: 'Soporte'
  },
  { 
    name: 'Perfil', 
    href: '/profile', 
    icon: Users,
    description: 'Mi cuenta'
  }
];

// Memoizar componente para evitar re-renders innecesarios
const Sidebar = memo(function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="
      sidebar
      w-64 h-full 
      bg-[var(--color-card)] 
      border-r border-[var(--color-border)]
      shadow-[var(--shadow-lg)]
      flex flex-col
      font-[var(--font-family)]
      backdrop-filter: var(--backdrop-filter);
      -webkit-backdrop-filter: var(--backdrop-filter);
    ">
      {/* Header del Sidebar */}
      <div className="
        p-6 border-b border-[var(--color-border)]
        bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)]
        text-white
      ">
        <h1 className="
          text-xl font-bold tracking-wide
          font-[var(--font-family)]
          uppercase
        ">
          ArbitrageX
        </h1>
        <p className="text-sm opacity-90 mt-1 uppercase tracking-wider">
          Pro 2025
        </p>
      </div>

      {/* Navegación - Optimizada para rendering */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const IconComponent = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              prefetch={true} // Prefetch para navegación más rápida
              className={`
                group flex items-center justify-between
                w-full p-3 rounded-lg
                transition-all duration-150
                text-[var(--color-text)]
                hover:bg-[var(--color-hover)]
                hover:text-[var(--color-primary)]
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)]
                ${isActive 
                  ? 'bg-[var(--color-primary)] text-white shadow-[var(--shadow)]' 
                  : 'hover:shadow-[var(--shadow)]'
                }
              `}
            >
              <div className="flex items-center space-x-3">
                <IconComponent className={`
                  w-5 h-5 transition-transform duration-150 will-change-transform
                  ${isActive ? 'text-white' : 'text-[var(--color-text)] group-hover:text-[var(--color-primary)]'}
                  group-hover:scale-110
                `} />
                <div>
                  <div className={`
                    font-[var(--font-weight-medium)] text-sm uppercase tracking-wide
                    ${isActive ? 'text-white' : 'text-[var(--color-text)]'}
                  `}>
                    {item.name}
                  </div>
                  <div className={`
                    text-xs opacity-70 uppercase tracking-wider
                    ${isActive ? 'text-white' : 'text-[var(--color-text)]'}
                  `}>
                    {item.description}
                  </div>
                </div>
              </div>
              
              {isActive && (
                <ChevronRight className="w-4 h-4 text-white" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer del Sidebar */}
      <div className="
        p-4 border-t border-[var(--color-border)]
        bg-[var(--color-card)]
        text-center
      ">
        <div className="text-xs text-[var(--color-text)] opacity-60 uppercase tracking-wider">
          Versión 2.1.0
        </div>
        <div className="text-xs text-[var(--color-text)] opacity-60 uppercase tracking-wider mt-1">
          Sistema Híbrido JS/Solidity
        </div>
      </div>
    </aside>
  );
});

export default Sidebar;