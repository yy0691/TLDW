import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Simply pass through - auth will be handled by individual routes
  // This avoids the workUnitAsyncStorage error in Next.js 15
  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  })
}