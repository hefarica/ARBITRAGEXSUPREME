'use client'

import dynamic from 'next/dynamic'
import PageLoader from '@/components/ui/PageLoader'

// Lazy load del componente pesado
const RealTimeAlertsPage = dynamic(
  () => import('@/components/alerts-page').then(mod => ({ default: mod.RealTimeAlertsPage })),
  { 
    loading: () => <PageLoader message="Cargando alertas..." />,
    ssr: false
  }
)

export default function AlertsPage() {
  return <RealTimeAlertsPage />
}