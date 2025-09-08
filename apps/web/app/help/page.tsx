'use client'

import dynamic from 'next/dynamic'
import PageLoader from '@/components/ui/PageLoader'

// Lazy load del componente pesado
const RealTimeHelpPage = dynamic(
  () => import('@/components/help-page').then(mod => ({ default: mod.RealTimeHelpPage })),
  { 
    loading: () => <PageLoader message="Cargando ayuda..." />,
    ssr: false
  }
)

export default function HelpPage() {
  return <RealTimeHelpPage />
}