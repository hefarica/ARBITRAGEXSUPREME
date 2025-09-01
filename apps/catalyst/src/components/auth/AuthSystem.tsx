/**
 * ArbitrageX Supreme - Authentication System
 * Ingenio Pichichi S.A. - Actividades 41-50
 * 
 * Sistema completo de autenticación y gestión de usuarios
 */

'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  User, 
  Shield, 
  Key, 
  Settings, 
  Crown,
  Lock,
  Unlock,
  UserPlus,
  LogOut
} from 'lucide-react'

// Types
export interface User {
  id: string
  username: string
  email: string
  role: 'admin' | 'trader' | 'viewer'
  tier: 'basic' | 'premium' | 'enterprise'
  walletAddress?: string
  permissions: string[]
  lastLogin: number
  isActive: boolean
  tradingLimits: {
    maxTradeSize: number
    dailyLimit: number
    strategies: string[]
  }
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
}

// Context
const AuthContext = createContext<{
  authState: AuthState
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  register: (userData: any) => Promise<boolean>
  updateUser: (updates: Partial<User>) => void
}>({
  authState: { user: null, isAuthenticated: false, loading: false },
  login: async () => false,
  logout: () => {},
  register: async () => false,
  updateUser: () => {}
})

/**
 * Authentication Provider
 */
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    loading: false
  })

  const login = async (username: string, password: string): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, loading: true }))
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock user based on credentials
      const mockUser: User = {
        id: 'user_' + Date.now(),
        username,
        email: `${username}@example.com`,
        role: username === 'admin' ? 'admin' : 'trader',
        tier: username === 'admin' ? 'enterprise' : 'premium',
        permissions: [
          'trade:execute',
          'analytics:view',
          'portfolio:manage',
          ...(username === 'admin' ? ['admin:all', 'users:manage'] : [])
        ],
        lastLogin: Date.now(),
        isActive: true,
        tradingLimits: {
          maxTradeSize: username === 'admin' ? 1000000 : 100000,
          dailyLimit: username === 'admin' ? 10000000 : 1000000,
          strategies: ['INTRA_DEX', 'INTER_DEX', 'FLASH_LOAN']
        }
      }
      
      setAuthState({
        user: mockUser,
        isAuthenticated: true,
        loading: false
      })
      
      return true
    } catch (error) {
      setAuthState(prev => ({ ...prev, loading: false }))
      return false
    }
  }

  const logout = () => {
    setAuthState({
      user: null,
      isAuthenticated: false,
      loading: false
    })
  }

  const register = async (userData: any): Promise<boolean> => {
    // Simulate registration
    return true
  }

  const updateUser = (updates: Partial<User>) => {
    setAuthState(prev => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...updates } : null
    }))
  }

  return (
    <AuthContext.Provider value={{ authState, login, logout, register, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

/**
 * Login Component
 */
export const LoginForm = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { login, authState } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await login(username, password)
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          ArbitrageX Supreme Login
        </CardTitle>
        <CardDescription>
          Access your trading dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>
          <Button 
            type="submit" 
            className="w-full"
            disabled={authState.loading}
          >
            {authState.loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
        
        <div className="mt-4 text-sm text-gray-600">
          <p>Demo credentials:</p>
          <p>• Username: admin | Password: admin (Enterprise)</p>
          <p>• Username: trader | Password: trader (Premium)</p>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * User Profile Component
 */
export const UserProfile = () => {
  const { authState, logout, updateUser } = useAuth()
  
  if (!authState.user) return null

  const { user } = authState

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Username</Label>
              <p className="font-medium">{user.username}</p>
            </div>
            <div>
              <Label>Email</Label>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <Label>Role</Label>
              <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                {user.role}
              </Badge>
            </div>
            <div>
              <Label>Tier</Label>
              <Badge variant={user.tier === 'enterprise' ? 'default' : 'outline'}>
                <Crown className="h-3 w-3 mr-1" />
                {user.tier}
              </Badge>
            </div>
          </div>

          <div>
            <Label>Trading Limits</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="p-2 bg-gray-50 rounded">
                <p className="text-xs text-gray-600">Max Trade</p>
                <p className="font-bold">${user.tradingLimits.maxTradeSize.toLocaleString()}</p>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <p className="text-xs text-gray-600">Daily Limit</p>
                <p className="font-bold">${user.tradingLimits.dailyLimit.toLocaleString()}</p>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <p className="text-xs text-gray-600">Strategies</p>
                <p className="font-bold">{user.tradingLimits.strategies.length}</p>
              </div>
            </div>
          </div>

          <div>
            <Label>Permissions</Label>
            <div className="flex flex-wrap gap-1 mt-2">
              {user.permissions.map(permission => (
                <Badge key={permission} variant="outline" className="text-xs">
                  {permission}
                </Badge>
              ))}
            </div>
          </div>

          <Button onClick={logout} variant="outline" className="w-full">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}