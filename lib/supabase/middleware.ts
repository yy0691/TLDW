import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Silently refresh the session - no need to check for errors
  // This will automatically refresh the token if it's valid
  // Only attempt auth check if there are auth cookies present
  const hasAuthCookies = request.cookies.getAll().some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')
  )

  if (hasAuthCookies) {
    await supabase.auth.getUser().catch(() => {
      // Silently ignore errors
    })
  }

  return supabaseResponse
}