'use client'

import dynamic from 'next/dynamic'
import PageLoader from '@/components/ui/PageLoader'

// Lazy load del componente pesado
const RealTimeProfilePage = dynamic(
  () => import('@/components/profile-page').then(mod => ({ default: mod.RealTimeProfilePage })),
  { 
    loading: () => <PageLoader message="Cargando perfil..." />,
    ssr: false
  }
)

export default function ProfilePage() {
  return <RealTimeProfilePage />
}