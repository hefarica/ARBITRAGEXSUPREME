'use client'

import dynamic from 'next/dynamic'
import PageLoader from '@/components/ui/PageLoader'

// Lazy load del componente pesado con loading personalizado
const RealTimeOpportunitiesPage = dynamic(
  () => import('@/components/opportunities-page').then(mod => ({ default: mod.RealTimeOpportunitiesPage })),
  { 
    loading: () => <PageLoader message="Cargando oportunidades..." />,
    ssr: false // Mejorar velocidad inicial de carga
  }
)

export default function OpportunitiesPage() {
  return <RealTimeOpportunitiesPage />
}