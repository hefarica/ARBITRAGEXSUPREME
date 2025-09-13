import PageLoader from '@/components/ui/PageLoader'

export default function Loading() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <PageLoader message="Cargando página..." />
    </div>
  )
}