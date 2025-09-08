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
    <header className="flex justify-between items-center mb-6">
      <h1 className="text-2xl text-gray-800">{title}</h1>
      <div className="flex items-center gap-4">
        <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-sm">9 Redes</span>
        <Button 
          className="bg-blue-600 hover:bg-blue-700"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
          Actualizar
        </Button>
        <Bell className="text-gray-500" />
      </div>
    </header>
  )
}