'use client'

import dynamic from 'next/dynamic'
import PageLoader from '@/components/ui/PageLoader'

// Lazy load del componente principal
const ArbitrageDashboard = dynamic(
  () => import('@/components/arbitrage-dashboard').then(mod => ({ default: mod.ArbitrageDashboard })),
  { 
    loading: () => <PageLoader message="Cargando dashboard..." />,
    ssr: false
  }
)

export default function Home() {
  return (
    <div className="w-full">
      <ArbitrageDashboard />
    </div>
  )
}