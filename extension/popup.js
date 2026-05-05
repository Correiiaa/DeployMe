const loginButton = document.getElementById('login-button')
const statusNode = document.getElementById('status')
const accountNode = document.getElementById('account')

function setStatus(message, kind = '') {
  if (!statusNode) return
  statusNode.textContent = message
  statusNode.className = `status ${kind}`.trim()
}

function setAccountLabel(email = '') {
  if (!accountNode) return
  accountNode.textContent = email ? `Conta: ${email}` : ''
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve(response)
    })
  })
}

async function refreshAuthStatus() {
  try {
    const response = await sendRuntimeMessage({ type: 'DEPLOYME_GOOGLE_AUTH_STATUS' })
    if (response?.ok && response?.isAuthenticated && response?.user?.email) {
      setStatus('Sincronização com Google Drive ativa.', 'ok')
      setAccountLabel(response.user.email)
      if (loginButton) loginButton.textContent = 'Trocar conta Google'
      return
    }

    setStatus('Faz login para ativar a sincronização da extensão.', '')
    setAccountLabel('')
    if (loginButton) loginButton.textContent = 'Entrar com Google'
  } catch (error) {
    console.error('Failed to load Google auth status', error)
    setStatus('Não consegui validar o login Google.', 'error')
    setAccountLabel('')
  }
}

async function startGoogleLogin() {
  if (!loginButton) return

  loginButton.disabled = true
  setStatus('A abrir login Google...', 'ok')

  try {
    const response = await sendRuntimeMessage({ type: 'DEPLOYME_GOOGLE_LOGIN' })
    if (!response?.ok) {
      throw new Error(response?.reason ?? 'google_login_failed')
    }

    setStatus('Login concluído. Conta pronta para sincronização.', 'ok')
    setAccountLabel(response.user?.email ?? '')
    await refreshAuthStatus()
  } catch (error) {
    console.error('Failed to start Google login from extension popup', error)
    setStatus('Login cancelado ou falhou. Tenta novamente.', 'error')
  } finally {
    loginButton.disabled = false
  }
}

loginButton?.addEventListener('click', startGoogleLogin)
void refreshAuthStatus()
