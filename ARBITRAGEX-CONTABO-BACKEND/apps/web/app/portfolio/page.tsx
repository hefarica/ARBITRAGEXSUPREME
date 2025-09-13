'use client'

import dynamic from 'next/dynamic'
import PageLoader from '@/components/ui/PageLoader'

// Lazy load del componente pesado
const RealTimePortfolioPage = dynamic(
  () => import('@/components/portfolio-page').then(mod => ({ default: mod.RealTimePortfolioPage })),
  { 
    loading: () => <PageLoader message="Cargando portfolio..." />,
    ssr: false
  }
)

export default function PortfolioPage() {
  return <RealTimePortfolioPage />
}