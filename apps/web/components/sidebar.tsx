'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard,
  TrendingUp,
  Settings,
  Network,
  Activity,
  PieChart,
  Wallet,
  History,
  Bell,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSidebarBadges } from '@/hooks/useSidebarBadges'

interface SidebarProps {
  className?: string
  isCollapsed?: boolean
  onToggle?: () => void
}

// Función para crear elementos del menú con badges dinámicos - iOS Montserrat Style
const createMenuItems = (badges: { opportunities: number; wallets: number; alerts: number }) => [
  {
    title: 'DASHBOARD',
    icon: LayoutDashboard,
    href: '/',
    active: true,
    badge: null
  },
  {
    title: 'OPORTUNIDADES',
    icon: TrendingUp,
    href: '/opportunities',
    active: false,
    badge: badges.opportunities > 0 ? badges.opportunities.toString() : null
  },
  {
    title: 'PORTFOLIO',
    icon: PieChart,
    href: '/portfolio',
    active: false,
    badge: null
  },
  {
    title: 'TRANSACCIONES',
    icon: History,
    href: '/transactions',
    active: false,
    badge: null
  },
  {
    title: 'BILLETERAS',
    icon: Wallet,
    href: '/wallets',
    active: false,
    badge: badges.wallets > 0 ? badges.wallets.toString() : null
  },
  {
    title: 'REDES',
    icon: Network,
    href: '/networks',
    active: false,
    badge: null
  },
  {
    title: 'ALERTAS',
    icon: Bell,
    href: '/alerts',
    active: false,
    badge: badges.alerts > 0 ? badges.alerts.toString() : null
  },
  {
    title: 'CONFIGURACIÓN',
    icon: Settings,
    href: '/settings',
    active: false,
    badge: null
  }
]

const bottomMenuItems = [
  {
    title: 'AYUDA',
    icon: HelpCircle,
    href: '/help',
    active: false
  },
  {
    title: 'PERFIL',
    icon: User,
    href: '/profile',
    active: false
  }
]

export function Sidebar({ className, isCollapsed = false, onToggle }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(isCollapsed)
  const pathname = usePathname()
  
  // Obtener badges dinámicos - EXCLUSIVO para sidebar, sin interferir con paginación
  const { badges, isLoading, error } = useSidebarBadges()
  
  // Crear elementos del menú con badges dinámicos (TOTAL ABSOLUTO)
  const menuItems = createMenuItems(badges)

  const handleToggle = () => {
    setCollapsed(!collapsed)
    onToggle?.()
  }

  return (
    <div className={cn(
      "relative flex flex-col bg-slate-900 text-white transition-all duration-300 border-r border-slate-800",
      collapsed ? "w-16" : "w-64",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="ios-heading text-white">ARBITRAGEX</h2>
              <p className="ios-caption text-slate-400">PRO 2025</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <div key={item.href} className="relative">
              <Link href={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-left h-10 px-3",
                    collapsed ? "px-2 justify-center" : "px-3",
                    isActive 
                      ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  )}
                >
                  <Icon className={cn("w-5 h-5", collapsed ? "" : "mr-3")} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 ios-nav-item">{item.title}</span>
                      {item.badge && (
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "ml-auto text-white ios-caption px-2 py-0.5 transition-colors",
                            isLoading ? "bg-slate-500 animate-pulse" : "bg-emerald-500",
                            error && "bg-red-500"
                          )}
                        >
                          {isLoading ? "..." : item.badge}
                        </Badge>
                      )}
                    </>
                  )}
                </Button>
              </Link>
              
              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-14 top-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-slate-800 text-white text-sm px-2 py-1 rounded shadow-lg whitespace-nowrap">
                    {item.title}
                    {item.badge && (
                      <span className={cn(
                        "ml-2 text-white text-xs px-1.5 py-0.5 rounded transition-colors",
                        isLoading ? "bg-slate-500 animate-pulse" : "bg-emerald-500",
                        error && "bg-red-500"
                      )}>
                        {isLoading ? "..." : item.badge}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Status Indicator */}
      <div className="p-4 border-t border-slate-800">
        <div className={cn(
          "flex items-center space-x-3 p-3 bg-slate-800 rounded-lg",
          collapsed && "justify-center"
        )}>
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          {!collapsed && (
            <div>
              <p className="text-sm font-medium text-white">Sistema Activo</p>
              <p className="text-xs text-slate-400">9 redes conectadas</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Menu */}
      <div className="p-4 space-y-2 border-t border-slate-800">
        {bottomMenuItems.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-left h-10",
                  collapsed ? "px-2 justify-center" : "px-3",
                  "text-slate-300 hover:text-white hover:bg-slate-800"
                )}
              >
                <Icon className={cn("w-5 h-5", collapsed ? "" : "mr-3")} />
                {!collapsed && <span>{item.title}</span>}
              </Button>
            </Link>
          )
        })}
        
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-left h-10 text-red-400 hover:text-red-300 hover:bg-red-900/20",
            collapsed ? "px-2 justify-center" : "px-3"
          )}
        >
          <LogOut className={cn("w-5 h-5", collapsed ? "" : "mr-3")} />
          {!collapsed && <span>Cerrar Sesión</span>}
        </Button>
      </div>
    </div>
  )
}