// Minimal, ASCII-only login handler to survive encoding issues in inline script
(() => {
  const log = function() { try { console.log.apply(console, ['[login-fallback]'].concat(Array.prototype.slice.call(arguments))); } catch (_) {} };
  const warn = function() { try { console.warn.apply(console, ['[login-fallback]'].concat(Array.prototype.slice.call(arguments))); } catch (_) {} };
  const errorLog = function() { try { console.error.apply(console, ['[login-fallback]'].concat(Array.prototype.slice.call(arguments))); } catch (_) {} };

  function cleanQueryIfCredentialsPresent() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has('email') || params.has('password')) {
        window.history.replaceState({}, document.title, window.location.pathname);
        log('removed credentials from URL');
      }
    } catch (e) {
      // ignore
    }
  }

  async function doApiLogin(email, password) {
    // Prefer app.apiFetch when available
    if (window.app && typeof window.app.apiFetch === 'function') {
      return await window.app.apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
    }
    // Fallback to native fetch
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    if (!resp.ok) {
      let msg = 'Login failed';
      try {
        const data = await resp.json();
        msg = data && (data.message || data.error) || msg;
      } catch (_) {}
      throw new Error(msg);
    }
    return await resp.json();
  }

  function attachHandler() {
    const form = document.getElementById('loginForm');
    if (!form) { warn('loginForm not found'); return; }

    if (form.dataset.fallbackBound === '1') {
      return; // already bound
    }
    form.dataset.fallbackBound = '1';

    const messageContainer = document.getElementById('messageContainer');
    const submitButton = document.getElementById('submitButton');

    form.addEventListener('submit', async (event) => {
      try {
        event.preventDefault();

        // prevent double submit across multiple handlers
        if (window.__loginSubmitting) { return; }
        window.__loginSubmitting = true;

        if (messageContainer) {
          messageContainer.textContent = '';
          messageContainer.className = 'text-sm text-center font-medium';
        }
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Entrando...';
        }

        const emailEl = document.getElementById('email');
        const passEl = document.getElementById('password');
        const email = emailEl ? emailEl.value : '';
        const password = passEl ? passEl.value : '';

        const data = await doApiLogin(email, password);

        try {
          const key = (window.app && window.app.config && window.app.config.tokenKey) || 'authToken';
          localStorage.setItem(key, data.token);
        } catch (_) {}

        // Só redireciona se o login foi bem-sucedido
        window.location.href = data.redirectUrl || 'home.html';
        
      } catch (err) {
        errorLog('login error:', err);
        
        // Mensagens de erro mais específicas
        let errorMessage = 'Erro ao fazer login';
        if (err.message && err.message.includes('404')) {
          errorMessage = 'Serviço temporariamente indisponível. Por favor, tente novamente em alguns minutos.';
        } else if (err.message && err.message.includes('401')) {
          errorMessage = 'Email ou senha incorretos. Verifique suas credenciais enviadas por email após a compra do plano.';
        } else if (err.message && err.message.includes('403')) {
          errorMessage = 'Você não possui um plano ativo. Adquira um plano em editaliza.com.br para ter acesso.';
        } else if (err.message && err.message.includes('Usuário não encontrado')) {
          errorMessage = 'Usuário não encontrado. Certifique-se de usar o email cadastrado no Cackto.';
        } else if (err.message && err.message.includes('Senha incorreta')) {
          errorMessage = 'Senha incorreta. Use a senha enviada por email após a compra.';
        } else if (err.message && err.message.includes('plano ativo')) {
          errorMessage = 'Você não possui um plano ativo. Entre em contato com o suporte.';
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        if (window.notifications && typeof window.notifications.error === 'function') {
          window.notifications.error(errorMessage);
        }
        if (messageContainer) {
          messageContainer.textContent = errorMessage;
          messageContainer.classList.add('text-red-600');
          messageContainer.style.padding = '10px';
          messageContainer.style.backgroundColor = '#fee2e2';
          messageContainer.style.borderRadius = '4px';
          messageContainer.style.marginTop = '10px';
        }
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Entrar';
        }
        window.__loginSubmitting = false;
      }
    });

    log('submit handler attached');
  }

  async function handleAuthParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      // Secure session token retrieval flow
      if (params.get('auth_success') === '1') {
        try {
          const resp = await ((window.app && window.app.apiFetch ? window.app.apiFetch('/auth/session-token') : fetch('/api/auth/session-token')));
          const data = typeof resp.json === 'function' ? await resp.json() : resp; // app.apiFetch returns data directly
          if (data && data.success && data.token) {
            const key = (window.app && window.app.config && window.app.config.tokenKey) || 'authToken';
            localStorage.setItem(key, data.token);
            window.history.replaceState({}, document.title, window.location.pathname);
            window.location.href = 'home.html';
            return true;
          }
          throw new Error('Token nao encontrado na sessao');
        } catch (e) {
          errorLog('Erro ao recuperar token de sessao:', e);
          window.location.href = '/login.html?error=token_retrieval_failed';
          return true;
        }
      }

      // OAuth direct return with token in URL (legacy)
      if (params.get('auth') === 'success') {
        const token = params.get('token');
        const refresh = params.get('refresh');
        if (token) {
          const key = (window.app && window.app.config && window.app.config.tokenKey) || 'authToken';
          localStorage.setItem(key, decodeURIComponent(token));
          if (refresh) localStorage.setItem('refreshToken', decodeURIComponent(refresh));
          const msg = document.getElementById('messageContainer');
          if (msg) {
            msg.textContent = 'Login com Google realizado com sucesso!';
            msg.classList.add('text-green-600');
          }
          setTimeout(() => { window.location.href = 'home.html'; }, 1000);
        }
        return true;
      }

      // OAuth error reporting
      if (params.get('error')) {
        const errType = params.get('error');
        let errMsg = 'Erro na autenticacao.';
        if (errType === 'auth_failed' || errType === 'oauth_failed') {
          errMsg = 'Falha na autenticacao com Google. Tente novamente.';
        } else if (errType === 'google_auth_denied') {
          errMsg = 'Autenticacao cancelada pelo usuario.';
        } else if (errType === 'no_code') {
          errMsg = 'Codigo de autenticacao nao recebido.';
        } else if (errType === 'oauth_callback_failed') {
          errMsg = 'Erro no processo de autenticacao. Tente novamente.';
        }
        const msg = document.getElementById('messageContainer');
        if (msg) {
          msg.textContent = errMsg;
          msg.classList.add('text-red-600');
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        return false;
      }
      return false;
    } catch (e) {
      // ignore
      return false;
    }
  }

  async function init() {
    try { cleanQueryIfCredentialsPresent(); } catch (_) {}
    // If user already has token, redirect quickly
    try {
      const hasToken = !!(window.app && window.app.config && localStorage.getItem(window.app.config.tokenKey));
      if (hasToken) {
        window.location.href = 'home.html';
        return;
      }
    } catch (_) {}

    const handled = await handleAuthParams();
    if (!handled) attachHandler();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


