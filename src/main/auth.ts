import Store from 'electron-store'
import { shell } from 'electron'
import { createServer } from 'node:http'
import { URL } from 'node:url'
import { randomBytes } from 'node:crypto'
import { google } from 'googleapis'
import type { Credentials, OAuth2Client } from 'google-auth-library'

const OAUTH_STORE_KEY = 'googleOAuthTokens'
const OAUTH_STATE_BYTES = 24
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
]

type TokenStore = {
  [OAUTH_STORE_KEY]?: Credentials
}

export type AuthProfile = {
  name: string
  email: string
}

export class GoogleAuthService {
  private readonly store = new Store<TokenStore>({ name: 'auth-store' })

  private readonly redirectUri =
    process.env.GOOGLE_REDIRECT_URI ?? 'http://127.0.0.1:42813/oauth2callback'

  private readonly client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    this.redirectUri
  )

  constructor() {
    this.client.on('tokens', (tokens) => {
      const currentTokens = this.store.get(OAUTH_STORE_KEY)
      this.store.set(OAUTH_STORE_KEY, {
        ...currentTokens,
        ...tokens
      })
    })
  }

  private hasOAuthConfig(): boolean {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  }

  private getRedirectPort(): number {
    const uri = new URL(this.redirectUri)
    if (!uri.port) {
      throw new Error(
        'GOOGLE_REDIRECT_URI must include an explicit port, e.g. http://127.0.0.1:42813/oauth2callback'
      )
    }

    return Number(uri.port)
  }

  private restoreStoredTokens(): Credentials | undefined {
    const tokens = this.store.get(OAUTH_STORE_KEY)
    if (tokens?.access_token || tokens?.refresh_token) {
      this.client.setCredentials(tokens)
      return tokens
    }

    return undefined
  }

  async login(): Promise<AuthProfile> {
    if (!this.hasOAuthConfig()) {
      throw new Error(
        'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.'
      )
    }

    const state = randomBytes(OAUTH_STATE_BYTES).toString('hex')
    const authUrl = this.client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GOOGLE_SCOPES,
      state
    })

    const authCode = await new Promise<string>((resolve, reject) => {
      const server = createServer((req, res) => {
        const requestUrl = req.url ? new URL(req.url, this.redirectUri) : null

        if (!requestUrl || requestUrl.pathname !== new URL(this.redirectUri).pathname) {
          res.writeHead(404)
          res.end('Not found')
          return
        }

        const incomingState = requestUrl.searchParams.get('state')
        const code = requestUrl.searchParams.get('code')
        const error = requestUrl.searchParams.get('error')

        if (incomingState !== state) {
          res.writeHead(400)
          res.end('Invalid OAuth state')
          server.close()
          reject(new Error('Invalid OAuth state'))
          return
        }

        if (error) {
          res.writeHead(400)
          res.end('Google login failed. You can close this tab.')
          server.close()
          reject(new Error(`Google login failed: ${error}`))
          return
        }

        if (!code) {
          res.writeHead(400)
          res.end('Missing OAuth code')
          server.close()
          reject(new Error('OAuth callback did not include code'))
          return
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<h2>DeployMe conectado com sucesso. Pode fechar esta janela.</h2>')
        server.close()
        resolve(code)
      })

      server.listen(this.getRedirectPort(), '127.0.0.1', async () => {
        try {
          await shell.openExternal(authUrl)
        } catch (error) {
          server.close()
          reject(error)
        }
      })

      server.on('error', (error) => {
        reject(error)
      })
    })

    const tokenResponse = await this.client.getToken(authCode)
    this.client.setCredentials(tokenResponse.tokens)
    this.store.set(OAUTH_STORE_KEY, tokenResponse.tokens)

    const profile = await this.getCurrentUser()
    if (!profile) {
      throw new Error('Authenticated with Google but user profile could not be loaded.')
    }

    return profile
  }

  async getAuthorizedClient(): Promise<OAuth2Client | null> {
    if (!this.hasOAuthConfig()) {
      return null
    }

    const tokens = this.restoreStoredTokens()
    if (!tokens) {
      return null
    }

    await this.client.getAccessToken()
    return this.client
  }

  async getCurrentUser(): Promise<AuthProfile | null> {
    const authClient = await this.getAuthorizedClient()
    if (!authClient) {
      return null
    }

    const oauth2 = google.oauth2({ auth: authClient, version: 'v2' })
    const { data } = await oauth2.userinfo.get()

    if (!data.email) {
      return null
    }

    return {
      name: data.name ?? data.email,
      email: data.email
    }
  }
}

export const googleAuthService = new GoogleAuthService()
