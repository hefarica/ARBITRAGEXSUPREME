'use client'

import React, { useState, useEffect } from 'react'
import { useIntegratedWallets, type WalletInfo, type WalletToken, type WalletStats } from '@/hooks/useIntegratedWallets'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Wallet,
  Plus,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle,
  AlertTriangle,
  Activity,
  DollarSign,
  TrendingUp,
  Shield,
  Key,
  Network,
  Link
} from 'lucide-react'

// Las interfaces ahora se importan desde useIntegratedWallets

// El hook de datos ahora se maneja con useIntegratedWallets

// Componente de estadísticas de billeteras
function WalletStatsCards({ stats, loading }: { stats: WalletStats | null, loading: boolean }) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`
    return `$${num.toFixed(2)}`
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Total Billeteras */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Billeteras</p>
              <p className="text-3xl font-bold">{stats.total_wallets}</p>
              <p className="text-sm text-emerald-600">
                {stats.active_wallets} activas
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balance Total */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Balance Total</p>
              <p className="text-3xl font-bold">{formatNumber(stats.total_balance_usd)}</p>
              <p className="text-sm text-gray-500">
                Promedio: {formatNumber(stats.average_balance)}
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tipos de Billeteras */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Distribución</p>
              <div className="space-y-1 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-orange-600">Hot:</span>
                  <span className="font-medium">{stats.hot_wallets}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-blue-600">Cold:</span>
                  <span className="font-medium">{stats.cold_wallets}</span>
                </div>
              </div>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Tokens */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tokens</p>
              <p className="text-3xl font-bold">{stats.total_tokens}</p>
              <p className="text-sm text-gray-500">
                Balance máximo: {formatNumber(stats.highest_balance)}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Activity className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente de card individual de billetera
function WalletCard({ wallet, tokens }: { wallet: WalletInfo, tokens: WalletToken[] }) {
  const [showAddress, setShowAddress] = useState(false)
  const [showTokens, setShowTokens] = useState(false)

  const getStatusColor = (status: WalletInfo['status']) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'compromised': return 'bg-red-100 text-red-800'
      case 'monitoring': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeColor = (type: WalletInfo['type']) => {
    switch (type) {
      case 'hot': return 'bg-orange-100 text-orange-800'
      case 'cold': return 'bg-blue-100 text-blue-800'
      case 'hardware': return 'bg-purple-100 text-purple-800'
      case 'multisig': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRiskColor = (risk: WalletInfo['risk_level']) => {
    switch (risk) {
      case 'low': return 'text-emerald-600'
      case 'medium': return 'text-yellow-600'
      case 'high': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }
  
  const isMetaMaskWallet = wallet.is_metamask || false

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              {wallet.name}
              {isMetaMaskWallet && (
                <span className="text-orange-500 text-sm">🦊</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className={`text-xs ${getStatusColor(wallet.status)}`}>
                {wallet.status}
              </Badge>
              <Badge variant="outline" className={`text-xs ${getTypeColor(wallet.type)}`}>
                {wallet.type}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {wallet.network}
              </Badge>
              {isMetaMaskWallet && (
                <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                  Web3 Conectada
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">${wallet.balance_usd.toLocaleString()}</p>
            <p className="text-sm text-gray-500">
              {wallet.native_balance.toFixed(4)} {wallet.native_token}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Dirección de Billetera */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-600">Dirección:</label>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddress(!showAddress)}
                className="h-8 w-8 p-0"
              >
                {showAddress ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(wallet.address)}
                className="h-8 w-8 p-0"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  const explorerUrls: { [key: string]: string } = {
                    'ethereum': `https://etherscan.io/address/${wallet.address}`,
                    'polygon': `https://polygonscan.com/address/${wallet.address}`,
                    'bsc': `https://bscscan.com/address/${wallet.address}`,
                    'arbitrum': `https://arbiscan.io/address/${wallet.address}`,
                    'optimism': `https://optimistic.etherscan.io/address/${wallet.address}`
                  }
                  const explorerUrl = explorerUrls[wallet.network] || `https://etherscan.io/address/${wallet.address}`
                  window.open(explorerUrl, '_blank')
                }}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="bg-gray-50 p-2 rounded font-mono text-sm">
            {showAddress ? wallet.address : `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`}
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t">
            <div>
              <p className="text-sm text-gray-600">Tokens</p>
              <p className="font-medium">{wallet.token_count}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Nivel de Riesgo</p>
              <p className={`font-medium capitalize ${getRiskColor(wallet.risk_level)}`}>
                {wallet.risk_level}
              </p>
            </div>
          </div>

          {/* Estado de Conexión */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${wallet.is_connected ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                {wallet.is_connected ? 'Conectada' : 'Desconectada'}
              </span>
              {isMetaMaskWallet && (
                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700">
                  Tiempo Real
                </Badge>
              )}
            </div>
            <span className="text-xs text-gray-500">
              Última actividad: {new Date(wallet.last_activity).toLocaleDateString()}
            </span>
          </div>

          {/* Tokens (si están disponibles) */}
          {tokens && tokens.length > 0 && (
            <div className="pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTokens(!showTokens)}
                className={`w-full ${
                  isMetaMaskWallet ? 'border-orange-200 text-orange-700 hover:bg-orange-50' : ''
                }`}
              >
                {showTokens ? 'Ocultar' : 'Ver'} Tokens ({tokens.length})
                {isMetaMaskWallet && (
                  <span className="ml-2 text-xs">🔄 Sincronizado</span>
                )}
              </Button>
              {showTokens && (
                <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                  {tokens.map((token, index) => (
                    <div key={index} className={`flex justify-between items-center text-sm p-2 rounded ${
                      isMetaMaskWallet ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'
                    }`}>
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {token.symbol}
                          {isMetaMaskWallet && token.symbol === wallet.native_token && (
                            <span className="text-xs text-orange-600">🔥 En Vivo</span>
                          )}
                        </p>
                        <p className="text-gray-500">{token.balance.toFixed(6)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${token.balance_usd.toFixed(2)}</p>
                        <p className={`text-xs ${token.change_24h >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {token.change_24h >= 0 ? '+' : ''}{token.change_24h.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Componente para agregar nueva billetera
function AddWalletDialog() {
  const [open, setOpen] = useState(false)
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const [network, setNetwork] = useState('')
  const [type, setType] = useState<WalletInfo['type']>('hot')

  const handleAddWallet = async () => {
    try {
      const response = await fetch('/api/proxy/api/v2/wallets/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, name, network, type })
      })
      
      if (response.ok) {
        setOpen(false)
        setAddress('')
        setName('')
        setNetwork('')
        setType('hot')
        // Refrescar datos
        window.location.reload()
      }
    } catch (err) {
      console.error('Error adding wallet:', err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Agregar Billetera
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar Nueva Billetera</DialogTitle>
          <DialogDescription>
            Conecta una nueva billetera al sistema de monitoreo
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nombre</label>
            <Input
              placeholder="Mi Billetera Principal"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Dirección</label>
            <Input
              placeholder="0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Red</label>
            <Select value={network} onValueChange={setNetwork}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar red" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ethereum">Ethereum</SelectItem>
                <SelectItem value="bsc">BSC</SelectItem>
                <SelectItem value="polygon">Polygon</SelectItem>
                <SelectItem value="arbitrum">Arbitrum</SelectItem>
                <SelectItem value="optimism">Optimism</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Tipo</label>
            <Select value={type} onValueChange={(value: WalletInfo['type']) => setType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de billetera" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hot">Hot Wallet</SelectItem>
                <SelectItem value="cold">Cold Wallet</SelectItem>
                <SelectItem value="hardware">Hardware</SelectItem>
                <SelectItem value="multisig">Multisig</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAddWallet} className="w-full">
            Agregar Billetera
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Componente principal de la página de Billeteras
export function RealTimeWalletsPage() {
  const { 
    wallets, 
    tokens, 
    stats, 
    loading, 
    error, 
    lastUpdate, 
    refetch, 
    metamask,
    isMetaMaskWallet,
    hasMetaMask
  } = useIntegratedWallets()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const filteredWallets = wallets.filter(wallet => {
    const matchesSearch = wallet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         wallet.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         wallet.network.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || wallet.status === statusFilter
    const matchesType = typeFilter === 'all' || wallet.type === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              Billeteras
              {hasMetaMask() && (
                <Badge variant="outline" className="text-sm bg-orange-100 text-orange-700 border-orange-300">
                  🦊 Sincronizada
                </Badge>
              )}
            </h1>
            <p className="text-gray-600">Gestión y monitoreo de billeteras conectadas</p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>Última actualización: {lastUpdate.toLocaleTimeString()}</span>
              {metamask.isConnected && (
                <span className="text-emerald-600 font-medium">
                  ⚡ Tiempo real activo
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {/* Mostrar estado de MetaMask */}
            {metamask.isMetaMaskInstalled && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-md ${
                metamask.isConnected 
                  ? 'bg-emerald-50 border border-emerald-200' 
                  : 'bg-orange-50 border border-orange-200'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  metamask.isConnected ? 'bg-emerald-500' : 'bg-orange-500'
                }`}></div>
                <span className={`text-sm font-medium ${
                  metamask.isConnected ? 'text-emerald-700' : 'text-orange-700'
                }`}>
                  🦊 MetaMask: {metamask.isConnected ? 'Conectado' : 'Disponible'}
                </span>
                {!metamask.isConnected && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={metamask.connect}
                    disabled={metamask.isLoading}
                    className="border-orange-300 text-orange-700 hover:bg-orange-100"
                  >
                    {metamask.isLoading ? 'Conectando...' : 'Conectar'}
                  </Button>
                )}
                {metamask.isConnected && metamask.balance && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-600 font-medium">
                      {parseFloat(metamask.balance).toFixed(4)} {metamask.supportedNetworks[metamask.chainId as keyof typeof metamask.supportedNetworks]?.symbol || 'ETH'}
                    </span>
                    {hasMetaMask() && (
                      <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-700">
                        Auto-Detectada
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}
            <AddWalletDialog />
            <Button onClick={refetch} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-900">Error de Conectividad</p>
                  <p className="text-red-700">{error}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2 border-red-300 text-red-700 hover:bg-red-100"
                    onClick={refetch}
                  >
                    Reintentar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estadísticas de Billeteras */}
        <WalletStatsCards stats={stats} loading={loading} />

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre, dirección o red..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activa</SelectItem>
                  <SelectItem value="inactive">Inactiva</SelectItem>
                  <SelectItem value="compromised">Comprometida</SelectItem>
                  <SelectItem value="monitoring">Monitoreo</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="hot">Hot</SelectItem>
                  <SelectItem value="cold">Cold</SelectItem>
                  <SelectItem value="hardware">Hardware</SelectItem>
                  <SelectItem value="multisig">Multisig</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Grid de Billeteras */}
        {loading && wallets.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-32 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWallets.map((wallet) => (
              <WalletCard
                key={wallet.id}
                wallet={wallet}
                tokens={tokens[wallet.id] || []}
              />
            ))}
          </div>
        )}

        {filteredWallets.length === 0 && !loading && (
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <Wallet className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {wallets.length === 0 ? 'No hay billeteras conectadas' : 'No se encontraron billeteras'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {wallets.length === 0 ? 
                    (metamask.isMetaMaskInstalled && !metamask.isConnected ?
                      'Conecta MetaMask para monitoreo automático y en tiempo real' :
                      metamask.isMetaMaskInstalled ?
                        '⚡ MetaMask detectado - ¡Tu billetera se agregará automáticamente al conectar!' :
                        'Instala MetaMask para monitoreo automático o agrega billeteras manualmente') : 
                    'Ajusta los filtros para encontrar las billeteras que buscas'}
                </p>
                {wallets.length === 0 && (
                  <div className="space-y-3">
                    {metamask.isMetaMaskInstalled ? (
                      !metamask.isConnected ? (
                        <div className="space-y-3">
                          <Button 
                            onClick={metamask.connect}
                            disabled={metamask.isLoading}
                            className="w-full max-w-xs bg-orange-500 hover:bg-orange-600 text-white"
                          >
                            {metamask.isLoading ? 'Conectando...' : '🦊 Conectar MetaMask'}
                          </Button>
                          <div className="text-center">
                            <span className="text-gray-400 text-sm">o</span>
                          </div>
                          <AddWalletDialog />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-emerald-600 font-medium">
                            ✓ MetaMask conectado automáticamente - {metamask.balance} {metamask.supportedNetworks[metamask.chainId as keyof typeof metamask.supportedNetworks]?.symbol || 'ETH'}
                          </p>
                          <AddWalletDialog />
                        </div>
                      )
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-blue-700 text-sm font-medium mb-2">
                            🌟 ¡Instala MetaMask para detección automática!
                          </p>
                          <p className="text-blue-600 text-sm">
                            Con MetaMask, tu billetera se detectará y sincronizará automáticamente sin configuración manual.
                          </p>
                          <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" 
                             className="text-blue-600 hover:underline font-medium">
                            → Descargar MetaMask
                          </a>
                        </div>
                        <AddWalletDialog />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}