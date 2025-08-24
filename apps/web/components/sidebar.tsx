'use client'

import React, { useState } from 'react'
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

interface SidebarProps {
  className?: string
  isCollapsed?: boolean
  onToggle?: () => void
}

const menuItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    href: '/',
    active: true,
    badge: null
  },
  {
    title: 'Oportunidades',
    icon: TrendingUp,
    href: '/opportunities',
    active: false,
    badge: '24'
  },
  {
    title: 'Portfolio',
    icon: PieChart,
    href: '/portfolio',
    active: false,
    badge: null
  },
  {
    title: 'Transacciones',
    icon: History,
    href: '/transactions',
    active: false,
    badge: null
  },
  {
    title: 'Billeteras',
    icon: Wallet,
    href: '/wallets',
    active: false,
    badge: '3'
  },
  {
    title: 'Redes',
    icon: Network,
    href: '/networks',
    active: false,
    badge: null
  },
  {
    title: 'Alertas',
    icon: Bell,
    href: '/alerts',
    active: false,
    badge: '2'
  },
  {
    title: 'Configuración',
    icon: Settings,
    href: '/settings',
    active: false,
    badge: null
  }
]

const bottomMenuItems = [
  {
    title: 'Ayuda',
    icon: HelpCircle,
    href: '/help',
    active: false
  },
  {
    title: 'Perfil',
    icon: User,
    href: '/profile',
    active: false
  }
]

export function Sidebar({ className, isCollapsed = false, onToggle }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(isCollapsed)

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
              <h2 className="text-lg font-bold">ArbitrageX</h2>
              <p className="text-xs text-slate-400">Pro 2025</p>
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
          return (
            <div key={item.href} className="relative">
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-left h-10 px-3",
                  collapsed ? "px-2 justify-center" : "px-3",
                  item.active 
                    ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                )}
              >
                <Icon className={cn("w-5 h-5", collapsed ? "" : "mr-3")} />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.title}</span>
                    {item.badge && (
                      <Badge 
                        variant="secondary" 
                        className="ml-auto bg-emerald-500 text-white text-xs px-2 py-0.5"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
              </Button>
              
              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-14 top-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-slate-800 text-white text-sm px-2 py-1 rounded shadow-lg whitespace-nowrap">
                    {item.title}
                    {item.badge && (
                      <span className="ml-2 bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded">
                        {item.badge}
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
            <Button
              key={item.href}
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