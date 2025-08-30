'use client'

import dynamic from 'next/dynamic'
import PageLoader from '@/components/ui/PageLoader'

// Lazy load del componente principal empresarial
const EnhancedArbitrageDashboard = dynamic(
  () => import('@/components/enhanced-arbitrage-dashboard').then(mod => ({ default: mod.EnhancedArbitrageDashboard })),
  { 
    loading: () => <PageLoader message="Cargando ArbitrageX Supreme Dashboard..." />,
    ssr: false
  }
)

export default function Home() {
  return (
    <div className="w-full min-h-screen">
      <EnhancedArbitrageDashboard />
    </div>
  )
}