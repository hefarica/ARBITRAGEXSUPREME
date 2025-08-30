'use client'

import dynamic from 'next/dynamic'
import PageLoader from '@/components/ui/PageLoader'

// Lazy load del componente pesado
const RealTimeSettingsPage = dynamic(
  () => import('@/components/settings-page').then(mod => ({ default: mod.RealTimeSettingsPage })),
  { 
    loading: () => <PageLoader message="Cargando configuración..." />,
    ssr: false
  }
)

export default function SettingsPage() {
  return <RealTimeSettingsPage />
}