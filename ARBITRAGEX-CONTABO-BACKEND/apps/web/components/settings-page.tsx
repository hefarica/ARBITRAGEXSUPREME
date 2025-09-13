'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Settings,
  Save,
  RefreshCw,
  Key,
  Shield,
  Bell,
  Database,
  Network,
  AlertTriangle,
  CheckCircle,
  User,
  Mail,
  Smartphone,
  Globe,
  Sliders
} from 'lucide-react'

// Interfaces TypeScript para Configuración
interface SystemSettings {
  // Configuración General
  system_name: string
  timezone: string
  language: string
  currency: string
  refresh_interval: number
  max_concurrent_operations: number
  
  // Configuración de API
  api_rate_limit: number
  api_timeout: number
  enable_api_logging: boolean
  
  // Configuración de Monitoreo
  monitoring_enabled: boolean
  alert_threshold: number
  auto_trading: boolean
  risk_management: boolean
  
  // Configuración de Notificaciones
  email_notifications: boolean
  sms_notifications: boolean
  browser_notifications: boolean
  webhook_url?: string
}

interface SecuritySettings {
  two_factor_auth: boolean
  session_timeout: number
  allowed_ips: string[]
  api_key_rotation_days: number
  encryption_enabled: boolean
  backup_frequency: 'daily' | 'weekly' | 'monthly'
}

interface NetworkSettings {
  networks: {
    name: string
    enabled: boolean
    rpc_url: string
    chain_id: number
    gas_limit: number
    priority_fee: number
  }[]
}

interface NotificationSettings {
  channels: {
    email: { enabled: boolean; address: string }
    sms: { enabled: boolean; number: string }
    webhook: { enabled: boolean; url: string }
    browser: { enabled: boolean }
  }
  events: {
    arbitrage_opportunities: boolean
    price_alerts: boolean
    network_issues: boolean
    wallet_activity: boolean
    system_updates: boolean
  }
}

// Hook para datos de configuración
function useSettingsData() {
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null)
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings | null>(null)
  const [networkSettings, setNetworkSettings] = useState<NetworkSettings | null>(null)
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchSettingsData = async () => {
    try {
      setError(null)
      
      // Obtener configuración del sistema
      const systemResponse = await fetch('/api/proxy/api/v2/settings/system')
      if (!systemResponse.ok) throw new Error('Error al cargar configuración del sistema')
      const systemData = await systemResponse.json()
      setSystemSettings(systemData.data || systemData)

      // Obtener configuración de seguridad
      const securityResponse = await fetch('/api/proxy/api/v2/settings/security')
      if (!securityResponse.ok) throw new Error('Error al cargar configuración de seguridad')
      const securityData = await securityResponse.json()
      setSecuritySettings(securityData.data || securityData)

      // Obtener configuración de redes
      const networkResponse = await fetch('/api/proxy/api/v2/settings/networks')
      if (!networkResponse.ok) throw new Error('Error al cargar configuración de redes')
      const networkData = await networkResponse.json()
      setNetworkSettings(networkData.data || networkData)

      // Obtener configuración de notificaciones
      const notificationResponse = await fetch('/api/proxy/api/v2/settings/notifications')
      if (!notificationResponse.ok) throw new Error('Error al cargar configuración de notificaciones')
      const notificationData = await notificationResponse.json()
      setNotificationSettings(notificationData.data || notificationData)

      setLastUpdate(new Date())
    } catch (err) {
      console.error('Error fetching settings data:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async (type: string, data: any) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/proxy/api/v2/settings/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) throw new Error(`Error al guardar configuración de ${type}`)
      
      // Refresh data after save
      await fetchSettingsData()
      return true
    } catch (err) {
      console.error(`Error saving ${type} settings:`, err)
      setError(err instanceof Error ? err.message : 'Error al guardar')
      return false
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    fetchSettingsData()
  }, [])

  return { 
    systemSettings, 
    securitySettings, 
    networkSettings, 
    notificationSettings,
    loading, 
    saving,
    error, 
    lastUpdate, 
    refetch: fetchSettingsData,
    saveSettings
  }
}

// Componente de configuración del sistema
function SystemSettingsTab({ settings, onSave }: { settings: SystemSettings | null, onSave: (data: SystemSettings) => Promise<boolean> }) {
  const [formData, setFormData] = useState<SystemSettings | null>(settings)

  useEffect(() => {
    setFormData(settings)
  }, [settings])

  if (!formData) return <div>Cargando...</div>

  const handleSave = async () => {
    if (formData) {
      const success = await onSave(formData)
      if (success) {
        // Show success message
        console.log('Settings saved successfully')
      }
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración General</CardTitle>
          <CardDescription>Ajustes básicos del sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="system_name">Nombre del Sistema</Label>
              <Input
                id="system_name"
                value={formData.system_name}
                onChange={(e) => setFormData({...formData, system_name: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="timezone">Zona Horaria</Label>
              <Select value={formData.timezone} onValueChange={(value) => setFormData({...formData, timezone: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">Eastern (EST/EDT)</SelectItem>
                  <SelectItem value="America/Chicago">Central (CST/CDT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain (MST/MDT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific (PST/PDT)</SelectItem>
                  <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="language">Idioma</Label>
              <Select value={formData.language} onValueChange={(value) => setFormData({...formData, language: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="currency">Moneda</Label>
              <Select value={formData.currency} onValueChange={(value) => setFormData({...formData, currency: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="BTC">BTC</SelectItem>
                  <SelectItem value="ETH">ETH</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuración de Operación</CardTitle>
          <CardDescription>Parámetros de funcionamiento del sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="refresh_interval">Intervalo de Actualización (segundos)</Label>
              <Input
                id="refresh_interval"
                type="number"
                value={formData.refresh_interval}
                onChange={(e) => setFormData({...formData, refresh_interval: Number(e.target.value)})}
              />
            </div>
            <div>
              <Label htmlFor="max_concurrent">Máximo Operaciones Concurrentes</Label>
              <Input
                id="max_concurrent"
                type="number"
                value={formData.max_concurrent_operations}
                onChange={(e) => setFormData({...formData, max_concurrent_operations: Number(e.target.value)})}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="monitoring_enabled">Monitoreo Habilitado</Label>
                <p className="text-sm text-gray-500">Activar el monitoreo continuo del sistema</p>
              </div>
              <Switch
                id="monitoring_enabled"
                checked={formData.monitoring_enabled}
                onCheckedChange={(checked) => setFormData({...formData, monitoring_enabled: checked})}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto_trading">Trading Automático</Label>
                <p className="text-sm text-gray-500">Ejecutar operaciones de arbitraje automáticamente</p>
              </div>
              <Switch
                id="auto_trading"
                checked={formData.auto_trading}
                onCheckedChange={(checked) => setFormData({...formData, auto_trading: checked})}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="risk_management">Gestión de Riesgos</Label>
                <p className="text-sm text-gray-500">Aplicar límites de riesgo automáticos</p>
              </div>
              <Switch
                id="risk_management"
                checked={formData.risk_management}
                onCheckedChange={(checked) => setFormData({...formData, risk_management: checked})}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuración de API</CardTitle>
          <CardDescription>Parámetros de la API del sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="api_rate_limit">Límite de Velocidad API (req/min)</Label>
              <Input
                id="api_rate_limit"
                type="number"
                value={formData.api_rate_limit}
                onChange={(e) => setFormData({...formData, api_rate_limit: Number(e.target.value)})}
              />
            </div>
            <div>
              <Label htmlFor="api_timeout">Timeout API (segundos)</Label>
              <Input
                id="api_timeout"
                type="number"
                value={formData.api_timeout}
                onChange={(e) => setFormData({...formData, api_timeout: Number(e.target.value)})}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enable_api_logging">Logging de API</Label>
              <p className="text-sm text-gray-500">Registrar todas las llamadas a la API</p>
            </div>
            <Switch
              id="enable_api_logging"
              checked={formData.enable_api_logging}
              onCheckedChange={(checked) => setFormData({...formData, enable_api_logging: checked})}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          Guardar Configuración
        </Button>
      </div>
    </div>
  )
}

// Componente de configuración de seguridad
function SecuritySettingsTab({ settings, onSave }: { settings: SecuritySettings | null, onSave: (data: SecuritySettings) => Promise<boolean> }) {
  const [formData, setFormData] = useState<SecuritySettings | null>(settings)

  useEffect(() => {
    setFormData(settings)
  }, [settings])

  if (!formData) return <div>Cargando...</div>

  const handleSave = async () => {
    if (formData) {
      await onSave(formData)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Seguridad</CardTitle>
          <CardDescription>Ajustes de seguridad y autenticación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="two_factor_auth">Autenticación de Dos Factores</Label>
              <p className="text-sm text-gray-500">Requerir 2FA para todas las operaciones críticas</p>
            </div>
            <Switch
              id="two_factor_auth"
              checked={formData.two_factor_auth}
              onCheckedChange={(checked) => setFormData({...formData, two_factor_auth: checked})}
            />
          </div>

          <div>
            <Label htmlFor="session_timeout">Timeout de Sesión (minutos)</Label>
            <Input
              id="session_timeout"
              type="number"
              value={formData.session_timeout}
              onChange={(e) => setFormData({...formData, session_timeout: Number(e.target.value)})}
            />
          </div>

          <div>
            <Label htmlFor="api_key_rotation">Rotación de API Keys (días)</Label>
            <Input
              id="api_key_rotation"
              type="number"
              value={formData.api_key_rotation_days}
              onChange={(e) => setFormData({...formData, api_key_rotation_days: Number(e.target.value)})}
            />
          </div>

          <div>
            <Label htmlFor="backup_frequency">Frecuencia de Respaldos</Label>
            <Select 
              value={formData.backup_frequency} 
              onValueChange={(value: 'daily' | 'weekly' | 'monthly') => setFormData({...formData, backup_frequency: value})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diario</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="encryption_enabled">Encriptación Habilitada</Label>
              <p className="text-sm text-gray-500">Encriptar datos sensibles en la base de datos</p>
            </div>
            <Switch
              id="encryption_enabled"
              checked={formData.encryption_enabled}
              onCheckedChange={(checked) => setFormData({...formData, encryption_enabled: checked})}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          Guardar Configuración
        </Button>
      </div>
    </div>
  )
}

// Componente principal de la página de Configuración
export function RealTimeSettingsPage() {
  const { 
    systemSettings, 
    securitySettings, 
    networkSettings, 
    notificationSettings,
    loading, 
    saving,
    error, 
    lastUpdate, 
    refetch,
    saveSettings
  } = useSettingsData()

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Configuración</h1>
            <p className="text-gray-600">Gestión de parámetros del sistema</p>
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
                  <p className="font-medium text-red-900">Error de Configuración</p>
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

        {/* Contenido Principal con Tabs */}
        <Tabs defaultValue="system" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="system">Sistema</TabsTrigger>
            <TabsTrigger value="security">Seguridad</TabsTrigger>
            <TabsTrigger value="networks">Redes</TabsTrigger>
            <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
          </TabsList>

          <TabsContent value="system" className="space-y-6">
            <SystemSettingsTab 
              settings={systemSettings} 
              onSave={(data) => saveSettings('system', data)}
            />
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <SecuritySettingsTab 
              settings={securitySettings} 
              onSave={(data) => saveSettings('security', data)}
            />
          </TabsContent>

          <TabsContent value="networks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Redes</CardTitle>
                <CardDescription>Gestión de redes blockchain conectadas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Network className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Configuración de redes próximamente</p>
                  <p className="text-sm">Gestión de RPCs, gas fees y parámetros de red</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Notificaciones</CardTitle>
                <CardDescription>Gestión de canales y eventos de notificación</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Configuración de notificaciones próximamente</p>
                  <p className="text-sm">Email, SMS, webhooks y notificaciones del navegador</p>
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
                <p>Guardando configuración...</p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}