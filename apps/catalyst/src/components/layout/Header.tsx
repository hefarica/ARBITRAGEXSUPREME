'use client'

import { useState } from 'react'
import { ThemeToggle } from "@/components/ui/theme-toggle"

interface HeaderProps {
  onMenuClick?: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {

  return (
    <div className="sticky top-0 z-40 lg:mx-auto lg:max-w-7xl lg:px-8">
      <div className="flex h-16 items-center gap-x-4 border-b border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-4 shadow-sm backdrop-blur-md sm:gap-x-6 sm:px-6 lg:px-0 lg:shadow-none">
        {/* Mobile menu button */}
        {onMenuClick && (
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 dark:text-gray-300 lg:hidden"
            onClick={onMenuClick}
          >
            <span className="sr-only">Open sidebar</span>
            <span className="text-xl">☰</span>
          </button>
        )}

        {/* Separator */}
        <div className="h-6 w-px bg-gray-200 dark:bg-slate-600 lg:hidden" />

        {/* Search */}
        <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
          <form className="relative flex flex-1" action="#" method="GET">
            <label htmlFor="search-field" className="sr-only">
              Buscar protocolos, tokens, estrategias...
            </label>
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 dark:text-gray-500">
              🔍
            </span>
            <input
              id="search-field"
              className="block h-full w-full border-0 py-0 pl-10 pr-0 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0 sm:text-sm bg-transparent"
              placeholder="Buscar protocolos, tokens, estrategias..."
              type="search"
              name="search"
            />
          </form>
        </div>

        {/* Right side buttons */}
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* System Status */}
          <div className="hidden sm:flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Sistema Activo
              </span>
            </div>
          </div>

          {/* Dark mode toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <button
            type="button"
            className="relative p-2 text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200 transition-colors duration-200"
          >
            <span className="sr-only">View notifications</span>
            <span className="text-lg">🔔</span>
            {/* Notification badge */}
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-danger-500 text-white text-xs rounded-full flex items-center justify-center">
              3
            </span>
          </button>

          {/* Separator */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200 dark:lg:bg-slate-600" />

          {/* Profile */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-gradient-arbitrage rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">HC</span>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                Hector Fabio
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Ingenio Pichichi S.A.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}