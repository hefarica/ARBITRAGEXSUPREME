'use client'

import dynamic from 'next/dynamic'
import PageLoader from '@/components/ui/PageLoader'

// Lazy load del componente pesado
const NetworksPage = dynamic(
  () => import('@/components/networks-page').then(mod => ({ default: mod.NetworksPage })),
  { 
    loading: () => <PageLoader message="Cargando redes..." />,
    ssr: false
  }
)

export default function Networks() {
  return <NetworksPage />
}