interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function LoadingSpinner({ 
  size = 'md', 
  className = '' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      <div className={`loading-spinner ${sizeClasses[size]} text-primary-500`}>
        <div className="sr-only">Cargando...</div>
      </div>
    </div>
  )
}