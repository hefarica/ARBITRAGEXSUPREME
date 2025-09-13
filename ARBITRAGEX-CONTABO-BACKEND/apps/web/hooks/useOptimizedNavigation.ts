'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useTransition } from 'react'

export function useOptimizedNavigation() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const navigate = useCallback((href: string) => {
    startTransition(() => {
      router.push(href)
    })
  }, [router])

  const prefetchRoute = useCallback((href: string) => {
    router.prefetch(href)
  }, [router])

  return {
    navigate,
    prefetchRoute,
    isPending
  }
}