import { NextResponse } from 'next/server'

const API_BASE_URL = 'http://localhost:3001'

export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Backend API not available' },
        { status: 503 }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      { error: 'Backend connection failed' },
      { status: 503 }
    )
  }
}