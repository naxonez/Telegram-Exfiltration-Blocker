// background.js (MV3 Service Worker) - Inyección directa del código

// Código del script de inyección como string
const INJECTION_CODE = `
(function() {
  const TELEGRAM_HOST_RX = /https?:\\/\\/(?:api\\.)?telegram\\.org\\/?/i;
  
  const SUSPICIOUS_WORDS = [
    'password', 'pass', 'pwd', 'passcode', 'passphrase',
    'username', 'user', 'login', 'email', 'mail',
    'token', 'secret', 'key', 'api', 'auth',
    'credential', 'creds', 'account',
    'ip', 'address', 'client',
    'session', 'cookie', 'bearer',
    'otp', 'code', '2fa', 'mfa', 'user-agent'
  ];
  
  const suspiciousRx = new RegExp(
    '(' + SUSPICIOUS_WORDS.join('|') + ')\\\\s*[:=]|' +
    '\\\\b(' + SUSPICIOUS_WORDS.join('|') + ')\\\\b',
    'i'
  );

  function containsSuspicious(text) {
    try { 
      if (typeof text !== 'string' || !text) return false;
      const normalized = text.toLowerCase();
      if (suspiciousRx.test(normalized)) return true;
      if (/email\\s*[:=]/i.test(text)) return true;
      if (/password\\s*[:=]/i.test(text)) return true;
      if (/\\|password:/i.test(text)) return true;
      if (/\\|email:/i.test(text)) return true;
      if (/"password"\\s*:/i.test(text)) return true;
      if (/"email"\\s*:/i.test(text)) return true;
      return false;
    } catch (e) { 
      return false; 
    }
  }

  function bodyToTextSync(body) {
    try {
      if (body == null) return '';
      if (typeof body === 'string') return body;
      if (body instanceof URLSearchParams) return body.toString();
      if (body instanceof FormData) {
        const entries = [];
        for (const [k, v] of body.entries()) {
          entries.push(k + '=' + (typeof v === 'string' ? v : '[file]'));
        }
        return entries.join('&');
      }
      if (body instanceof Blob || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
        return '__NEEDS_ASYNC_CHECK__';
      }
      try { return JSON.stringify(body); } catch (e) { return String(body); }
    } catch (e) {
      return '';
    }
  }

  async function bodyToTextAsync(body) {
    try {
      if (body == null) return '';
      if (typeof body === 'string') return body;
      if (body instanceof URLSearchParams) return body.toString();
      if (body instanceof FormData) {
        const entries = [];
        for (const [k, v] of body.entries()) {
          entries.push(k + '=' + (typeof v === 'string' ? v : '[file]'));
        }
        return entries.join('&');
      }
      if (body instanceof Blob) {
        try { return await body.text(); } catch (e) { return '(blob)'; }
      }
      if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
        try {
          const buf = body instanceof ArrayBuffer ? body : body.buffer;
          const dec = new TextDecoder('utf-8');
          return dec.decode(new Uint8Array(buf));
        } catch (e) { return '(arraybuffer)'; }
      }
      try { return JSON.stringify(body); } catch (e) { return String(body); }
    } catch (e) {
      return '';
    }
  }

  function notifyBlocked(url, method, evidence) {
    try { 
      console.warn('[TELEGRAM BLOCKER] 🛡️ BLOCKED:', method, url);
      window.postMessage({ __TELEXFIL_BLOCK__: true, url, method, evidence }, '*'); 
    } catch (e) {}
  }

  // Hook fetch
  try {
    const origFetch = window.fetch;
    window.fetch = function(resource, init) {
      try {
        const url = (typeof resource === 'string') ? resource : (resource && resource.url) || '';
        const method = (init && init.method) || 'GET';
        
        if (TELEGRAM_HOST_RX.test(url)) {
          let queryText = '';
          try { queryText = new URL(url, location.href).search; } catch (e) { queryText = ''; }
          
          const bodySync = bodyToTextSync(init && init.body);
          
          if (bodySync !== '__NEEDS_ASYNC_CHECK__') {
            const combined = queryText + '\\n' + bodySync;
            if (containsSuspicious(combined)) {
              notifyBlocked(url, method, combined);
              return Promise.reject(new Error('Blocked by Telegram Exfiltration Blocker'));
            }
          } else {
            return (async () => {
              const bodyAsync = await bodyToTextAsync(init && init.body);
              const combined = queryText + '\\n' + bodyAsync;
              if (containsSuspicious(combined)) {
                notifyBlocked(url, method, combined);
                throw new Error('Blocked by Telegram Exfiltration Blocker');
              }
              return origFetch.apply(window, arguments);
            })();
          }
        }
      } catch (e) {}
      return origFetch.apply(window, arguments);
    };
  } catch (e) {}

  // Hook XHR
  try {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url) {
      this.__tel_method = method;
      this.__tel_url = url;
      this.__tel_blocked = false;
      return origOpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(body) {
      try {
        const url = this.__tel_url || '';
        const method = (this.__tel_method || 'GET');
        
        if (TELEGRAM_HOST_RX.test(url)) {
          let queryText = '';
          try { queryText = new URL(url, location.href).search; } catch (e) { queryText = ''; }
          
          const bodySync = bodyToTextSync(body);
          
          if (bodySync !== '__NEEDS_ASYNC_CHECK__') {
            const combined = queryText + '\\n' + bodySync;
            if (containsSuspicious(combined)) {
              this.__tel_blocked = true;
              notifyBlocked(url, method, combined);
              
              setTimeout(() => {
                try {
                  Object.defineProperty(this, 'readyState', { value: 4, writable: false });
                  Object.defineProperty(this, 'status', { value: 0, writable: false });
                  Object.defineProperty(this, 'statusText', { value: 'Blocked', writable: false });
                  if (typeof this.onerror === 'function') {
                    this.onerror(new Event('error'));
                  }
                  this.dispatchEvent(new Event('error'));
                } catch (e) {}
              }, 0);
              return;
            }
          } else {
            (async () => {
              const bodyAsync = await bodyToTextAsync(body);
              const combined = queryText + '\\n' + bodyAsync;
              if (containsSuspicious(combined)) {
                this.__tel_blocked = true;
                notifyBlocked(url, method, combined);
                try {
                  if (this.abort) this.abort();
                } catch (e) {}
              }
            })();
            
            setTimeout(() => {
              if (!this.__tel_blocked) {
                origSend.apply(this, [body]);
              }
            }, 50);
            return;
          }
        }
      } catch (e) {}
      return origSend.apply(this, arguments);
    };
  } catch (e) {}

  // Hook sendBeacon
  try {
    if (navigator && navigator.sendBeacon) {
      const origSendBeacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function(url, data) {
        try {
          if (TELEGRAM_HOST_RX.test(url)) {
            const bodySync = bodyToTextSync(data);
            if (bodySync !== '__NEEDS_ASYNC_CHECK__' && containsSuspicious(bodySync)) {
              notifyBlocked(url, 'BEACON', bodySync);
              return false;
            }
          }
        } catch (e) {}
        return origSendBeacon(url, data);
      };
    }
  } catch (e) {}

  console.log('[TELEGRAM BLOCKER] Protection active');
})();
`;

async function tryInjectToTab(tabId, url) {
  const forbidden = [
    'chrome://', 
    'chrome-extension://', 
    'about:', 
    'view-source:', 
    'data:',
    'file://',
    'edge://',
    'brave://',
    'opera://'
  ];
  
  if (!url || forbidden.some(p => url.startsWith(p))) {
    return false;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || tab.status !== 'complete') {
      return false;
    }

    // Inyectar código directamente en MAIN world
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      injectImmediately: true,
      func: (code) => {
        // Evitar duplicados
        if (window.__TELEXFIL_INJECTED__) return;
        window.__TELEXFIL_INJECTED__ = true;
        
        // Evaluar el código de protección
        try {
          eval(code);
        } catch (e) {
          console.error('[TELEGRAM BLOCKER] Injection error:', e);
        }
      },
      args: [INJECTION_CODE]
    });
    
    console.log('[TELEGRAM BLOCKER] ✓ Injected into tab', tabId);
    return true;
    
  } catch (e) {
    const ignoredErrors = [
      'Frame with ID',
      'error page',
      'No frame with id',
      'Cannot access',
      'No tab with id'
    ];
    
    const isIgnored = ignoredErrors.some(msg => 
      e.message && e.message.includes(msg)
    );
    
    if (!isIgnored) {
      console.warn('[TELEGRAM BLOCKER] ✗ Injection failed for tab', tabId, ':', e.message);
    }
    
    return false;
  }
}

// Inyección al cargar/actualizar pestaña
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    tryInjectToTab(tabId, tab.url).catch(() => {});
  }
});

// Inyección al instalar/actualizar la extensión
chrome.runtime.onInstalled.addListener(() => {
  console.log('[TELEGRAM BLOCKER] Extension installed/updated');
  
  chrome.tabs.query({}, tabs => {
    let injected = 0;
    
    for (const t of tabs) {
      if (t.id && t.url && t.status === 'complete') {
        tryInjectToTab(t.id, t.url)
          .then(success => { if (success) injected++; })
          .catch(() => {});
      }
    }
    
    setTimeout(() => {
      console.log(`[TELEGRAM BLOCKER] Injected into ${injected} tabs`);
    }, 1000);
  });
});

// Mensajería (alertas desde content scripts)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  
  if (msg.type === 'blocked_exfil') {
    const alert = {
      time: new Date().toISOString(),
      url: msg.url || 'unknown',
      method: msg.method || 'POST',
      evidence: msg.evidence || '(no evidence)',
      tabId: sender.tab?.id || null,
      tabUrl: sender.tab?.url || null
    };
    
    chrome.storage.local.get({alerts: []}, items => {
      const alerts = items.alerts || [];
      alerts.unshift(alert);
      
      if (alerts.length > 200) {
        alerts.splice(200);
      }
      
      chrome.storage.local.set({alerts});
    });
    
    chrome.notifications.create('', {
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'Blocked Telegram exfiltration',
      message: `${alert.method} → ${alert.url.substring(0, 60)}...`,
      priority: 2
    });
    
    console.warn('[TELEGRAM BLOCKER] 🛡️ BLOCKED:', alert.method, alert.url);
    
  } else if (msg.type === 'clear_alerts') {
    chrome.storage.local.set({alerts: []}, () => {
      sendResponse({ok: true});
    });
    return true;
  }
});

console.log('[TELEGRAM BLOCKER] Service worker started');