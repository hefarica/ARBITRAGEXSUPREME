'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Key,
  Bell,
  Camera,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Star,
  TrendingUp,
  DollarSign,
  Activity,
  Award,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react'

// Interfaces TypeScript para Perfil
interface UserProfile {
  id: string
  username: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  country?: string
  timezone: string
  language: string
  avatar_url?: string
  bio?: string
  created_at: string
  last_login: string
  email_verified: boolean
  phone_verified: boolean
  kyc_status: 'pending' | 'verified' | 'rejected'
  account_type: 'basic' | 'premium' | 'enterprise'
}

interface UserStats {
  total_trades: number
  successful_trades: number
  total_profit: number
  total_volume: number
  win_rate: number
  avg_roi: number
  days_active: number
  favorite_networks: string[]
}

interface SecuritySettings {
  two_factor_enabled: boolean
  login_notifications: boolean
  trade_notifications: boolean
  api_access_enabled: boolean
  session_timeout: number
  trusted_devices: number
}

interface NotificationPreferences {
  email_alerts: boolean
  sms_alerts: boolean
  browser_notifications: boolean
  trade_updates: boolean
  market_alerts: boolean
  security_alerts: boolean
  newsletter: boolean
}

// Hook para datos del perfil
function useProfileData() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [security, setSecurity] = useState<SecuritySettings | null>(null)
  const [notifications, setNotifications] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchProfileData = async () => {
    try {
      setError(null)
      
      // Obtener perfil del usuario
      const profileResponse = await fetch('/api/proxy/api/v2/profile')
      if (!profileResponse.ok) throw new Error('Error al cargar perfil del usuario')
      const profileData = await profileResponse.json()
      setProfile(profileData.data || profileData)

      // Obtener estadísticas del usuario
      const statsResponse = await fetch('/api/proxy/api/v2/profile/stats')
      if (!statsResponse.ok) throw new Error('Error al cargar estadísticas del usuario')
      const statsData = await statsResponse.json()
      setStats(statsData.data || statsData)

      // Obtener configuración de seguridad
      const securityResponse = await fetch('/api/proxy/api/v2/profile/security')
      if (!securityResponse.ok) throw new Error('Error al cargar configuración de seguridad')
      const securityData = await securityResponse.json()
      setSecurity(securityData.data || securityData)

      // Obtener preferencias de notificación
      const notificationsResponse = await fetch('/api/proxy/api/v2/profile/notifications')
      if (!notificationsResponse.ok) throw new Error('Error al cargar preferencias de notificación')
      const notificationsData = await notificationsResponse.json()
      setNotifications(notificationsData.data || notificationsData)

      setLastUpdate(new Date())
    } catch (err) {
      console.error('Error fetching profile data:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (data: Partial<UserProfile>) => {
    setSaving(true)
    try {
      const response = await fetch('/api/proxy/api/v2/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) throw new Error('Error al actualizar perfil')
      
      await fetchProfileData()
      return true
    } catch (err) {
      console.error('Error updating profile:', err)
      setError(err instanceof Error ? err.message : 'Error al actualizar perfil')
      return false
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    fetchProfileData()
  }, [])

  return { 
    profile, 
    stats, 
    security, 
    notifications,
    loading, 
    saving,
    error, 
    lastUpdate, 
    refetch: fetchProfileData,
    updateProfile
  }
}

// Componente de estadísticas del usuario
function UserStatsCards({ stats, loading }: { stats: UserStats | null, loading: boolean }) {
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
      {/* Total Trades */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Trades</p>
              <p className="text-3xl font-bold">{stats.total_trades}</p>
              <p className="text-sm text-emerald-600">
                {stats.successful_trades} exitosos
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Profit */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Profit Total</p>
              <p className="text-3xl font-bold text-emerald-600">{formatNumber(stats.total_profit)}</p>
              <p className="text-sm text-gray-500">
                ROI promedio: {stats.avg_roi.toFixed(2)}%
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Win Rate */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tasa de Éxito</p>
              <p className="text-3xl font-bold">{stats.win_rate.toFixed(1)}%</p>
              <p className="text-sm text-gray-500">
                {stats.days_active} días activo
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Volume */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Volumen Total</p>
              <p className="text-3xl font-bold">{formatNumber(stats.total_volume)}</p>
              <p className="text-sm text-gray-500">
                Redes favoritas: {stats.favorite_networks.slice(0, 2).join(', ')}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Award className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente de información del perfil
function ProfileInfoTab({ profile, onUpdate }: { profile: UserProfile | null, onUpdate: (data: Partial<UserProfile>) => Promise<boolean> }) {
  const [formData, setFormData] = useState<UserProfile | null>(profile)

  useEffect(() => {
    setFormData(profile)
  }, [profile])

  if (!formData) return <div>Cargando...</div>

  const handleSave = async () => {
    if (formData) {
      await onUpdate(formData)
    }
  }

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'basic': return 'bg-gray-100 text-gray-800'
      case 'premium': return 'bg-blue-100 text-blue-800'
      case 'enterprise': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getKYCStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-emerald-100 text-emerald-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Información de la cuenta */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Información de la Cuenta</CardTitle>
              <CardDescription>Administra tu información personal</CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className={`${getAccountTypeColor(formData.account_type)}`}>
                {formData.account_type}
              </Badge>
              <Badge variant="outline" className={`${getKYCStatusColor(formData.kyc_status)}`}>
                KYC: {formData.kyc_status}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <Avatar className="w-24 h-24">
              <AvatarImage src={formData.avatar_url} />
              <AvatarFallback className="text-lg">
                {formData.first_name[0]}{formData.last_name[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <Button variant="outline" size="sm">
                <Camera className="w-4 h-4 mr-2" />
                Cambiar Avatar
              </Button>
              <p className="text-sm text-gray-500 mt-1">
                Formatos soportados: JPG, PNG. Máximo 2MB.
              </p>
            </div>
          </div>

          {/* Información personal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first_name">Nombre</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({...formData, first_name: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="last_name">Apellido</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({...formData, last_name: e.target.value})}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="username">Nombre de Usuario</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
            />
          </div>

          <div>
            <Label htmlFor="bio">Biografía</Label>
            <Textarea
              id="bio"
              placeholder="Cuéntanos sobre ti..."
              value={formData.bio || ''}
              onChange={(e) => setFormData({...formData, bio: e.target.value})}
              rows={3}
            />
          </div>

          {/* Información de contacto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
                {formData.email_verified ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
                {formData.phone_verified ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                )}
              </div>
            </div>
          </div>

          {/* Configuración regional */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="country">País</Label>
              <Select value={formData.country || ''} onValueChange={(value) => setFormData({...formData, country: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar país" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">Estados Unidos</SelectItem>
                  <SelectItem value="CA">Canadá</SelectItem>
                  <SelectItem value="MX">México</SelectItem>
                  <SelectItem value="ES">España</SelectItem>
                  <SelectItem value="AR">Argentina</SelectItem>
                  <SelectItem value="CO">Colombia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="timezone">Zona Horaria</Label>
              <Select value={formData.timezone} onValueChange={(value) => setFormData({...formData, timezone: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">Eastern</SelectItem>
                  <SelectItem value="America/Chicago">Central</SelectItem>
                  <SelectItem value="America/Denver">Mountain</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific</SelectItem>
                  <SelectItem value="Europe/Madrid">Madrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Información de cuenta */}
          <div className="pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <p className="font-medium">Cuenta creada:</p>
                <p>{new Date(formData.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="font-medium">Último acceso:</p>
                <p>{new Date(formData.last_login).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          Guardar Cambios
        </Button>
      </div>
    </div>
  )
}

// Componente de configuración de seguridad
function SecurityTab({ security }: { security: SecuritySettings | null }) {
  if (!security) return <div>Cargando...</div>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Seguridad</CardTitle>
          <CardDescription>Protege tu cuenta con medidas de seguridad adicionales</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="two_factor">Autenticación de Dos Factores</Label>
              <p className="text-sm text-gray-500">Agrega una capa extra de seguridad</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="two_factor" checked={security.two_factor_enabled} />
              {security.two_factor_enabled ? (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800">
                  Activo
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-gray-100 text-gray-800">
                  Inactivo
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Notificaciones de Inicio de Sesión</Label>
              <p className="text-sm text-gray-500">Recibe alertas cuando alguien acceda a tu cuenta</p>
            </div>
            <Switch checked={security.login_notifications} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Acceso a API</Label>
              <p className="text-sm text-gray-500">Permitir acceso programático a tu cuenta</p>
            </div>
            <Switch checked={security.api_access_enabled} />
          </div>

          <div>
            <Label>Timeout de Sesión (minutos)</Label>
            <Input type="number" value={security.session_timeout} className="mt-1 w-32" />
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Dispositivos de Confianza</p>
                <p className="text-sm text-gray-500">{security.trusted_devices} dispositivos registrados</p>
              </div>
              <Button variant="outline" size="sm">
                Gestionar Dispositivos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente principal de la página de Perfil
export function RealTimeProfilePage() {
  const { 
    profile, 
    stats, 
    security, 
    notifications,
    loading, 
    saving,
    error, 
    lastUpdate, 
    refetch,
    updateProfile
  } = useProfileData()

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
            <p className="text-gray-600">Gestiona tu información personal y configuración</p>
            <p className="text-sm text-gray-500">
              Última actualización: {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-2">
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

        {/* Estadísticas del Usuario */}
        <UserStatsCards stats={stats} loading={loading} />

        {/* Contenido Principal con Tabs */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="security">Seguridad</TabsTrigger>
            <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <ProfileInfoTab profile={profile} onUpdate={updateProfile} />
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <SecurityTab security={security} />
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Preferencias de Notificación</CardTitle>
                <CardDescription>Configura cómo y cuándo recibes notificaciones</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Configuración de notificaciones próximamente</p>
                  <p className="text-sm">Gestión completa de alertas y preferencias</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Loading Overlay */}
        {saving && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <p>Guardando cambios...</p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}