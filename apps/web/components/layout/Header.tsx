'use client'

import { useState, memo, useCallback } from 'react';
import { 
  Bell, 
  RefreshCw, 
  Wifi,
  WifiOff,
  Circle,
  User,
  LogOut,
  Settings,
  ChevronDown
} from 'lucide-react';
import ThemeSwitcher from '@/components/ui/ThemeSwitcher';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isConnected?: boolean;
  networksCount?: number;
}

const Header = memo(function Header({ 
  title = "Dashboard de Arbitraje en Tiempo Real",
  subtitle = "Datos reales de blockchain conectado",
  onRefresh,
  isRefreshing = false,
  isConnected = true,
  networksCount = 5
}: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleRefresh = useCallback(() => {
    if (onRefresh && !isRefreshing) {
      onRefresh();
    }
  }, [onRefresh, isRefreshing]);

  const toggleUserMenu = useCallback(() => {
    setShowUserMenu(prev => !prev);
  }, []);

  const toggleNotifications = useCallback(() => {
    setShowNotifications(prev => !prev);
  }, []);

  return (
    <header className="
      h-16 
      bg-[var(--color-card)] 
      border-b border-[var(--color-border)]
      shadow-[var(--shadow)]
      flex items-center justify-between px-6
      backdrop-filter: var(--backdrop-filter);
      -webkit-backdrop-filter: var(--backdrop-filter);
      font-[var(--font-family)]
    ">
      {/* Título y estado */}
      <div className="flex items-center space-x-4">
        <div>
          <h1 className="
            text-lg font-[var(--font-weight-semibold)] 
            text-[var(--color-text)] 
            uppercase tracking-wide
          ">
            {title}
          </h1>
          <div className="flex items-center space-x-2 mt-1">
            <div className="flex items-center space-x-1">
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-500" />
                  <Circle className="w-2 h-2 text-emerald-500 fill-current animate-pulse" />
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-red-500" />
                  <Circle className="w-2 h-2 text-red-500 fill-current" />
                </>
              )}
              <span className="text-xs text-[var(--color-text)] opacity-70 uppercase tracking-wider">
                {networksCount} Redes
              </span>
            </div>
            <span className="text-xs text-[var(--color-text)] opacity-50">•</span>
            <span className="text-xs text-[var(--color-text)] opacity-70 uppercase tracking-wider">
              {subtitle}
            </span>
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="flex items-center space-x-3">
        {/* Estado de redes */}
        <div className="
          hidden md:flex items-center space-x-2 
          px-3 py-1.5 
          bg-[var(--color-hover)] 
          rounded-lg 
          border border-[var(--color-border)]
        ">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-xs font-[var(--font-weight-medium)] text-[var(--color-text)] uppercase tracking-wider">
            {networksCount} Redes
          </span>
        </div>

        {/* Botón refrescar */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="
            flex items-center justify-center
            w-10 h-10 
            rounded-lg 
            bg-[var(--color-card)] 
            border border-[var(--color-border)]
            text-[var(--color-text)]
            hover:bg-[var(--color-hover)]
            hover:text-[var(--color-primary)]
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)]
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          title="Actualizar datos"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>

        {/* Notificaciones */}
        <div className="relative">
          <button
            onClick={toggleNotifications}
            className="
              flex items-center justify-center
              w-10 h-10 
              rounded-lg 
              bg-[var(--color-card)] 
              border border-[var(--color-border)]
              text-[var(--color-text)]
              hover:bg-[var(--color-hover)]
              hover:text-[var(--color-primary)]
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)]
              transition-all duration-200
              relative
            "
            title="Notificaciones"
          >
            <Bell className="w-4 h-4" />
            {/* Badge de notificaciones */}
            <span className="
              absolute -top-1 -right-1 
              w-3 h-3 
              bg-red-500 
              rounded-full 
              text-[10px] text-white 
              flex items-center justify-center
            ">
              3
            </span>
          </button>

          {/* Dropdown de notificaciones */}
          {showNotifications && (
            <div className="
              absolute right-0 top-12 
              w-80 
              bg-[var(--color-card)] 
              border border-[var(--color-border)]
              rounded-lg 
              shadow-[var(--shadow-lg)]
              backdrop-filter: var(--backdrop-filter);
              -webkit-backdrop-filter: var(--backdrop-filter);
              z-50
            ">
              <div className="p-4 border-b border-[var(--color-border)]">
                <h3 className="font-[var(--font-weight-semibold)] text-[var(--color-text)] uppercase tracking-wide">
                  Notificaciones
                </h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <div className="p-4 text-center text-[var(--color-text)] opacity-60">
                  <span className="text-sm uppercase tracking-wider">Sin notificaciones nuevas</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cambiar tema */}
        <ThemeSwitcher />

        {/* Usuario */}
        <div className="relative">
          <button
            onClick={toggleUserMenu}
            className="
              flex items-center space-x-2
              px-3 py-2 
              rounded-lg 
              bg-[var(--color-card)] 
              border border-[var(--color-border)]
              text-[var(--color-text)]
              hover:bg-[var(--color-hover)]
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)]
              transition-all duration-200
            "
          >
            <User className="w-4 h-4" />
            <span className="hidden md:block text-sm font-[var(--font-weight-medium)] uppercase tracking-wide">
              Usuario
            </span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Dropdown de usuario */}
          {showUserMenu && (
            <div className="
              absolute right-0 top-12 
              w-48 
              bg-[var(--color-card)] 
              border border-[var(--color-border)]
              rounded-lg 
              shadow-[var(--shadow-lg)]
              backdrop-filter: var(--backdrop-filter);
              -webkit-backdrop-filter: var(--backdrop-filter);
              z-50
            ">
              <div className="p-2">
                <button className="
                  flex items-center space-x-2 w-full
                  px-3 py-2 text-left
                  text-[var(--color-text)]
                  hover:bg-[var(--color-hover)]
                  rounded-md transition-colors
                ">
                  <Settings className="w-4 h-4" />
                  <span className="text-sm uppercase tracking-wide">Configuración</span>
                </button>
                <button className="
                  flex items-center space-x-2 w-full
                  px-3 py-2 text-left
                  text-red-600
                  hover:bg-red-50
                  rounded-md transition-colors
                ">
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm uppercase tracking-wide">Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
});

export default Header;