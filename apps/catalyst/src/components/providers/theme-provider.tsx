/**
 * ArbitrageX Supreme - Theme Provider Component
 * Ingenio Pichichi S.A. - Provider para manejo de tema dark/light
 * 
 * Implementación metodica y disciplinada para consistencia visual
 * siguiendo las mejores prácticas de shadcn/ui y Next.js
 */

"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

interface ThemeProviderProps {
  children: React.ReactNode
  [key: string]: any
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}