'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Bell, 
  Search, 
  RefreshCw, 
  Settings,
  User,
  ChevronDown,
  Activity,
  Wifi,
  WifiOff
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardHeaderProps {
  className?: string
  title?: string
  subtitle?: string
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function DashboardHeader({ 
  className, 
  title = "Dashboard de Arbitraje", 
  subtitle = "Monitoreo en tiempo real",
  onRefresh,
  isRefreshing = false 
}: DashboardHeaderProps) {
  return (
    <header className={cn(
      "flex items-center justify-between p-6 bg-white border-b border-slate-200",
      className
    )}>
      {/* Left Section - Title and Subtitle */}
      <div className="flex items-center space-x-4">
        <div>
          <h1 className="ios-dashboard-title text-slate-900">{title.toUpperCase()}</h1>
          <div className="ios-body text-slate-600 flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            <span className="ios-caption">{subtitle.toUpperCase()}</span>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-200 ios-live-indicator">
              LIVE
            </Badge>
          </div>
        </div>
      </div>

      {/* Right Section - Actions and User */}
      <div className="flex items-center space-x-3">
        {/* Network Status */}
        <div className="flex items-center space-x-2 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200 ios-glass">
          <Wifi className="w-4 h-4 text-emerald-600" />
          <span className="ios-status text-emerald-700">9 REDES</span>
        </div>

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center space-x-2 ios-button-secondary"
        >
          <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          <span className="hidden md:block font-montserrat uppercase font-semibold tracking-wide">ACTUALIZAR</span>
        </Button>

        {/* Notifications */}
        <Button variant="outline" size="sm" className="relative">
          <Bell className="w-4 h-4" />
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center text-xs"
          >
            3
          </Badge>
        </Button>

        {/* Settings */}
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4" />
        </Button>

        {/* User Profile */}
        <div className="flex items-center space-x-2 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="hidden md:block">
            <p className="ios-subheading text-slate-900">HECTOR FABIO</p>
            <p className="ios-caption text-slate-600">ADMIN</p>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-600" />
        </div>
      </div>
    </header>
  )
}