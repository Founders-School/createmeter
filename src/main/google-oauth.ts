import { createHash, randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { shell } from 'electron'
import {
  AuthDomainError,
  decodeJwtPayload,
  userFromIdToken,
  type AuthSession,
  type AuthUser
} from '../shared/auth'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo'

declare const __GOOGLE_CLIENT_ID__: string | undefined

export function googleClientId(): string {
  const defined = typeof __GOOGLE_CLIENT_ID__ === 'string' ? __GOOGLE_CLIENT_ID__ : ''
  return (
    defined ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.MAIN_VITE_GOOGLE_CLIENT_ID ||
    ''
  ).trim()
}

export function googleClientSecret(): string {
  return (process.env.GOOGLE_CLIENT_SECRET || process.env.MAIN_VITE_GOOGLE_CLIENT_SECRET || '').trim()
}

function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function pkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

function successPage(email: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>CreateMeter</title>
  <style>body{font:16px/1.4 ui-serif,Georgia,serif;background:#f4efe6;color:#1b1814;display:grid;place-items:center;min-height:100vh;margin:0}main{max-width:28rem;padding:2rem;text-align:center}p{color:#6f685e}</style></head>
  <body><main><h1>You're signed in</h1><p>${email}</p><p>Return to CreateMeter in the menu bar. You can close this tab.</p></main></body></html>`
}

function errorPage(message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>CreateMeter</title>
  <style>body{font:16px/1.4 ui-serif,Georgia,serif;background:#f4efe6;color:#1b1814;display:grid;place-items:center;min-height:100vh;margin:0}main{max-width:28rem;padding:2rem;text-align:center}p{color:#6f685e}</style></head>
  <body><main><h1>Sign-in didn't finish</h1><p>${message}</p><p>Close this tab and try again from CreateMeter.</p></main></body></html>`
}

async function exchangeCode(params: {
  code: string
  redirectUri: string
  verifier: string
  refresh?: boolean
}): Promise<AuthSession> {
  const clientId = googleClientId()
  const body = new URLSearchParams({
    client_id: clientId,
    code: params.code,
    code_verifier: params.verifier,
    grant_type: 'authorization_code',
    redirect_uri: params.redirectUri
  })
  const secret = googleClientSecret()
  if (secret) body.set('client_secret', secret)

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status}).`)
  }
  const json = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    id_token?: string
    expires_in?: number
  }
  if (!json.access_token || !json.id_token) throw new Error('Google did not return tokens.')
  return sessionFromTokens(json, clientId)
}

async function sessionFromTokens(
  json: { access_token?: string; refresh_token?: string; id_token?: string; expires_in?: number },
  clientId: string,
  previous?: AuthSession
): Promise<AuthSession> {
  const idToken = json.id_token ?? previous?.idToken
  if (!idToken || !json.access_token) throw new Error('Google did not return tokens.')

  const info = await fetch(`${TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`)
  const payload = info.ok ? ((await info.json()) as ReturnType<typeof decodeJwtPayload>) : decodeJwtPayload(idToken)
  const user = userFromIdToken(payload, clientId)
  const expiresIn = Number(json.expires_in) || 3600
  return {
    user,
    accessToken: json.access_token,
    refreshToken: json.refresh_token || previous?.refreshToken,
    idToken,
    expiresAt: Date.now() + expiresIn * 1000
  }
}

export async function refreshSession(session: AuthSession): Promise<AuthSession> {
  if (!session.refreshToken) throw new Error('No refresh token')
  const clientId = googleClientId()
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken
  })
  const secret = googleClientSecret()
  if (secret) body.set('client_secret', secret)

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!response.ok) throw new Error('Session expired. Sign in again.')
  const json = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    id_token?: string
    expires_in?: number
  }
  return sessionFromTokens(json, clientId, session)
}

export async function signInWithGoogle(timeoutMs = 180_000): Promise<AuthSession> {
  const clientId = googleClientId()
  if (!clientId) {
    throw new Error('Google sign-in is not configured. Add GOOGLE_CLIENT_ID (see README).')
  }

  const { verifier, challenge } = pkce()
  const state = base64url(randomBytes(16))

  return new Promise<AuthSession>((resolve, reject) => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const url = new URL(req.url ?? '/', `http://127.0.0.1`)
        if (url.pathname !== '/') {
          res.writeHead(404)
          res.end()
          return
        }
        const query = url.searchParams
        if (query.get('error')) {
          const message = query.get('error_description') || query.get('error') || 'Access denied'
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(errorPage(message))
          cleanup()
          reject(new Error(message))
          return
        }
        if (query.get('state') !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(errorPage('This sign-in request did not match CreateMeter.'))
          cleanup()
          reject(new Error('OAuth state mismatch'))
          return
        }
        const code = query.get('code')
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(errorPage('Google did not return an authorization code.'))
          cleanup()
          reject(new Error('Missing authorization code'))
          return
        }
        const session = await exchangeCode({
          code,
          redirectUri: `http://127.0.0.1:${addressPort}`,
          verifier
        })
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(successPage(session.user.email))
        cleanup()
        resolve(session)
      } catch (error) {
        const message = error instanceof AuthDomainError ? error.message : error instanceof Error ? error.message : 'Sign-in failed'
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(errorPage(message))
        cleanup()
        reject(error instanceof Error ? error : new Error(message))
      }
    })

    let addressPort = 0
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Sign-in timed out. Try again.'))
    }, timeoutMs)

    const cleanup = (): void => {
      clearTimeout(timer)
      server.close()
    }

    server.on('error', (error) => {
      cleanup()
      reject(error)
    })

    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        cleanup()
        reject(new Error('Could not start the sign-in callback server.'))
        return
      }
      addressPort = address.port
      const redirectUri = `http://127.0.0.1:${addressPort}`
      const auth = new URL(AUTH_URL)
      auth.searchParams.set('client_id', clientId)
      auth.searchParams.set('redirect_uri', redirectUri)
      auth.searchParams.set('response_type', 'code')
      auth.searchParams.set('scope', 'openid email profile')
      auth.searchParams.set('code_challenge', challenge)
      auth.searchParams.set('code_challenge_method', 'S256')
      auth.searchParams.set('state', state)
      auth.searchParams.set('hd', 'alpha.school')
      auth.searchParams.set('prompt', 'select_account')
      auth.searchParams.set('access_type', 'offline')
      void shell.openExternal(auth.toString())
    })
  })
}

export type { AuthUser }
