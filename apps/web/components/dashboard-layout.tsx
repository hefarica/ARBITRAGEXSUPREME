'use client'

import React, { useState } from 'react'
import { Sidebar } from './sidebar'
import { DashboardHeader } from './dashboard-header'
import { cn } from '@/lib/utils'

interface DashboardLayoutProps {
  children: React.ReactNode
  className?: string
  title?: string
  subtitle?: string
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function DashboardLayout({ 
  children, 
  className, 
  title, 
  subtitle, 
  onRefresh, 
  isRefreshing 
}: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar 
        isCollapsed={sidebarCollapsed} 
        onToggle={handleSidebarToggle}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <DashboardHeader 
          title={title}
          subtitle={subtitle}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />
        
        {/* Main Content */}
        <main className={cn(
          "flex-1 overflow-y-auto bg-slate-50 p-6",
          className
        )}>
          {children}
        </main>
      </div>
    </div>
  )
}