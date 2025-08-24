import { type ClassValue, clsx } from "clsx"

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value)
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(3)}%`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

export function getNetworkStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'text-emerald-600'
    case 'inactive':
      return 'text-red-600'
    case 'maintenance':
      return 'text-amber-600'
    default:
      return 'text-slate-500'
  }
}

export function getProfitColor(profit: number): string {
  return profit > 0 ? 'text-emerald-600' : profit < 0 ? 'text-red-600' : 'text-slate-500'
}

export function formatTimeAgo(timestamp: string): string {
  const now = new Date()
  const time = new Date(timestamp)
  const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000)
  
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  return `${Math.floor(diffInSeconds / 86400)}d ago`
}

export function getNetworkColor(network: string): string {
  const colors: Record<string, string> = {
    'Ethereum': 'bg-blue-100 text-blue-800 border-blue-200',
    'BSC': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Polygon': 'bg-purple-100 text-purple-800 border-purple-200',
    'Arbitrum': 'bg-blue-100 text-blue-800 border-blue-200',
    'Optimism': 'bg-red-100 text-red-800 border-red-200',
    'Avalanche': 'bg-red-100 text-red-800 border-red-200',
    'Solana': 'bg-green-100 text-green-800 border-green-200',
    'Fantom': 'bg-blue-100 text-blue-800 border-blue-200',
    'Base': 'bg-blue-100 text-blue-800 border-blue-200',
    'Cardano': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Bitcoin': 'bg-orange-100 text-orange-800 border-orange-200',
    'Cosmos': 'bg-purple-100 text-purple-800 border-purple-200',
  }
  return colors[network] || 'bg-slate-100 text-slate-800 border-slate-200'
}