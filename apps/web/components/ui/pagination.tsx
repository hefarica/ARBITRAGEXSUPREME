import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  showing?: string
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showing,
  className
}: PaginationProps) {
  // Generar números de página a mostrar
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const showEllipsis = totalPages > 7

    if (!showEllipsis) {
      // Si hay 7 o menos páginas, mostrar todas
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Lógica compleja para mostrar páginas con elipsis
      if (currentPage <= 4) {
        // Mostrar: 1 2 3 4 5 ... último
        for (let i = 1; i <= 5; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 3) {
        // Mostrar: 1 ... ante-penúltimas páginas
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        // Mostrar: 1 ... páginas alrededor de la actual ... último
        pages.push(1)
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      }
    }

    return pages
  }

  if (totalPages <= 1) {
    return null
  }

  const pages = getPageNumbers()

  return (
    <div className={cn("flex items-center justify-between", className)}>
      {/* Información de páginas */}
      {showing && (
        <p className="text-sm text-gray-600">
          Mostrando {showing}
        </p>
      )}

      {/* Controles de paginación */}
      <div className="flex items-center space-x-1">
        {/* Botón anterior */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Números de página */}
        {pages.map((page, index) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${index}`} className="flex h-8 w-8 items-center justify-center">
                <MoreHorizontal className="h-4 w-4 text-gray-400" />
              </span>
            )
          }

          const pageNumber = page as number
          const isActive = pageNumber === currentPage

          return (
            <Button
              key={pageNumber}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(pageNumber)}
              className={cn(
                "h-8 w-8 p-0",
                isActive && "bg-emerald-600 text-white hover:bg-emerald-700"
              )}
            >
              {pageNumber}
            </Button>
          )
        })}

        {/* Botón siguiente */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}