'use client'

import dynamic from 'next/dynamic'
import PageLoader from '@/components/ui/PageLoader'

// Lazy load del componente pesado
const RealTimeTransactionsPage = dynamic(
  () => import('@/components/transactions-page').then(mod => ({ default: mod.RealTimeTransactionsPage })),
  { 
    loading: () => <PageLoader message="Cargando transacciones..." />,
    ssr: false
  }
)

export default function TransactionsPage() {
  return <RealTimeTransactionsPage />
}