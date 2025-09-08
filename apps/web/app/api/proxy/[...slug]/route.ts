import { NextRequest, NextResponse } from 'next/server'

// =============================================
// ARBITRAGEX PRO 2025 - PROXY REAL SIN MOCK DATA
// =============================================

const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:3001'

console.log(`🔗 Proxy configurado para backend: ${API_BASE_URL}`)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const resolvedParams = await params
    const path = resolvedParams.slug.join('/')
    const url = new URL(request.url)
    const searchParams = url.searchParams.toString()
    const fullUrl = `${API_BASE_URL}/api/v2/${path}${searchParams ? `?${searchParams}` : ''}`

    console.log(`🔗 Proxy Request: ${fullUrl}`)

    // Obtener headers de autenticación del request original
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': request.headers.get('Authorization') || '',
      'X-Client-ID': request.headers.get('X-Client-ID') || '',
      'X-Client-Secret': request.headers.get('X-Client-Secret') || '',
      'X-Wallet-Address': request.headers.get('X-Wallet-Address') || '',
      'X-Network-ID': request.headers.get('X-Network-ID') || 'mainnet',
    }

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: authHeaders,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Backend Error ${response.status}:`, errorText)
      return NextResponse.json(
        { 
          error: `Backend Error: ${response.status}`,
          message: errorText,
          endpoint: fullUrl
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log(`✅ Successful proxy response for: ${path}`)
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('❌ Proxy error:', error)
    return NextResponse.json(
      { 
        error: 'Proxy connection failed',
        message: error?.message || 'Unknown error',
        backendUrl: API_BASE_URL,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const resolvedParams = await params
    const path = resolvedParams.slug.join('/')
    const body = await request.json()
    
    const fullUrl = `${API_BASE_URL}/api/v2/${path}`
    console.log(`🔗 Proxy POST: ${fullUrl}`)

    // Obtener headers de autenticación del request original
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': request.headers.get('Authorization') || '',
      'X-Client-ID': request.headers.get('X-Client-ID') || '',
      'X-Client-Secret': request.headers.get('X-Client-Secret') || '',
      'X-Wallet-Address': request.headers.get('X-Wallet-Address') || '',
      'X-Network-ID': request.headers.get('X-Network-ID') || 'mainnet',
    }
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Backend POST Error ${response.status}:`, errorText)
      return NextResponse.json(
        { 
          error: `Backend Error: ${response.status}`,
          message: errorText,
          endpoint: fullUrl
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log(`✅ Successful POST proxy response for: ${path}`)
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('❌ Proxy POST error:', error)
    return NextResponse.json(
      { 
        error: 'Proxy POST connection failed',
        message: error?.message || 'Unknown error',
        backendUrl: API_BASE_URL,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const resolvedParams = await params
    const path = resolvedParams.slug.join('/')
    const body = await request.json()
    
    const fullUrl = `${API_BASE_URL}/api/v2/${path}`
    console.log(`🔗 Proxy PUT: ${fullUrl}`)

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': request.headers.get('Authorization') || '',
      'X-Client-ID': request.headers.get('X-Client-ID') || '',
      'X-Client-Secret': request.headers.get('X-Client-Secret') || '',
    }
    
    const response = await fetch(fullUrl, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `Backend Error: ${response.status}`, message: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('❌ Proxy PUT error:', error)
    return NextResponse.json(
      { error: 'Proxy PUT connection failed', message: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const resolvedParams = await params
    const path = resolvedParams.slug.join('/')
    
    const fullUrl = `${API_BASE_URL}/api/v2/${path}`
    console.log(`🔗 Proxy DELETE: ${fullUrl}`)

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': request.headers.get('Authorization') || '',
      'X-Client-ID': request.headers.get('X-Client-ID') || '',
      'X-Client-Secret': request.headers.get('X-Client-Secret') || '',
    }
    
    const response = await fetch(fullUrl, {
      method: 'DELETE',
      headers: authHeaders,
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `Backend Error: ${response.status}`, message: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('❌ Proxy DELETE error:', error)
    return NextResponse.json(
      { error: 'Proxy DELETE connection failed', message: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}