// content_fallback.js - Versión mejorada con bloqueo robusto

const TELEGRAM_HOST_RX = /https?:\/\/(?:api\.)?telegram\.org\/?/i;
// Lista expandida de palabras sospechosas
const SUSPICIOUS_WORDS = [
  'password', 'pass', 'pwd', 'passcode', 'passphrase',
  'username', 'user', 'login', 'email', 'mail',
  'token', 'secret', 'key', 'api', 'auth',
  'credential', 'creds', 'account',
  'ip', 'address', 'client',
  'session', 'cookie', 'bearer',
  'otp', 'code', '2fa', 'mfa'
];

// Regex más flexible - busca las palabras con o sin word boundaries
const suspiciousRx = new RegExp(
  '(' + SUSPICIOUS_WORDS.join('|') + ')\\s*[:=]|' +  // "password:" o "password="
  '\\b(' + SUSPICIOUS_WORDS.join('|') + ')\\b',      // palabra completa
  'i'
);

function containsSuspicious(text) {
  try { 
    if (typeof text !== 'string' || !text) return false;
    
    // Normalizar para mejor detección
    const normalized = text.toLowerCase();
    
    // Test principal con regex
    if (suspiciousRx.test(normalized)) return true;
    
    // Validación adicional: buscar patrones comunes de email/password
    if (/email\s*[:=]/i.test(text)) return true;
    if (/password\s*[:=]/i.test(text)) return true;
    if (/\|password:/i.test(text)) return true;
    if (/\|email:/i.test(text)) return true;
    if (/"password"\s*:/i.test(text)) return true;
    if (/"email"\s*:/i.test(text)) return true;
    
    return false;
  } catch (e) { 
    return false; 
  }
}

// Conversión síncrona
function bodyToTextSync(body) {
  try {
    if (body == null) return '';
    if (typeof body === 'string') return body;
    if (body instanceof URLSearchParams) return body.toString();
    if (body instanceof FormData) {
      const entries = [];
      for (const [k, v] of body.entries()) {
        entries.push(`${k}=${typeof v === 'string' ? v : '[file]'}`);
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

// Conversión asíncrona
async function bodyToTextAsync(body) {
  try {
    if (body == null) return '';
    if (typeof body === 'string') return body;
    if (body instanceof URLSearchParams) return body.toString();
    if (body instanceof FormData) {
      const entries = [];
      for (const [k, v] of body.entries()) {
        entries.push(`${k}=${typeof v === 'string' ? v : '[file]'}`);
      }
      return entries.join('&');
    }
    if (typeof Blob !== 'undefined' && body instanceof Blob) {
      try { return await body.text(); } catch (e) { return '(blob)'; }
    }
    if (typeof ArrayBuffer !== 'undefined' && (body instanceof ArrayBuffer || ArrayBuffer.isView(body))) {
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

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function prettyPrintEvidence(text) {
  try {
    const maybe = (text||'').trim();
    if ((maybe.startsWith('{') && maybe.endsWith('}')) || (maybe.startsWith('[') && maybe.endsWith(']'))) {
      const obj = JSON.parse(maybe);
      return `<pre>${escapeHtml(JSON.stringify(obj, null, 2))}</pre>`;
    }
  } catch (e) {}
  if (/[=].+?(&|$)/.test(text || '')) {
    const replaced = (text||'').replace(/&/g, '\n').replace(/=/g, ': ');
    return `<pre>${escapeHtml(replaced)}</pre>`;
  }
  return `<pre>${escapeHtml(text || '')}</pre>`;
}

// UI overlay
const OVERLAY_ID = '__telexfil_overlay_v3';
const STYLE_ID = '__telexfil_style_v3';

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const css = `
#${OVERLAY_ID} { position: fixed; inset: 0; display:flex; align-items:center; justify-content:center; z-index:2147483647; background: rgba(0,0,0,0.42); font-family: Inter, Roboto, Arial, sans-serif; }
#${OVERLAY_ID} .card { width: 520px; max-width: 94%; background: #fff; border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,0.3); overflow: hidden; border: 1px solid #e6e6e9; }
#${OVERLAY_ID} .hdr { display:flex; gap:12px; align-items:center; padding:14px; border-bottom:1px solid #eee; background: linear-gradient(90deg,#fff7e6,#fff); }
#${OVERLAY_ID} .icon { width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:linear-gradient(180deg,#fff0e6,#fff7f0); }
#${OVERLAY_ID} .title { font-weight:700; font-size:16px; color:#2b2b2b; }
#${OVERLAY_ID} .sub { font-size:13px;color:#555;margin-top:4px; }
#${OVERLAY_ID} .body { padding:12px; max-height:420px; overflow:auto; font-size:13px; color:#222; }
#${OVERLAY_ID} .evidence { background:#f6f7fb;border:1px solid #eceef6;padding:10px;border-radius:6px;margin-top:8px;font-family:monospace;font-size:12px;color:#111; white-space:pre-wrap; word-break:break-word; }
#${OVERLAY_ID} .actions { display:flex; gap:8px; padding:12px; justify-content:flex-end; border-top:1px solid #eee; }
button.telexfil-btn { padding:8px 12px;border-radius:8px;border:1px solid #cfcfd6;background:#fff;cursor:pointer;font-size:13px; }
button.telexfil-btn.primary { background: linear-gradient(90deg,#ff6b6b,#ff4d4d); color:#fff; border-color:transparent; }
`;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = css;
  (document.head || document.documentElement).appendChild(s);
}

function createOverlay(alert) {
  ensureStyle();
  const prev = document.getElementById(OVERLAY_ID);
  if (prev) prev.remove();
  const c = document.createElement('div');
  c.id = OVERLAY_ID;
  c.innerHTML = `
  <div class="card" role="dialog" aria-live="assertive">
    <div class="hdr">
      <div class="icon" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C7.58997 2 4 5.58997 4 10V14L2 16V17H22V16L20 14V10C20 5.58997 16.41 2 12 2Z" stroke="#ff4d4d" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8.99999 20C9.66666 21 10.7778 22 12 22C13.2222 22 14.3333 21 14.9999 20" stroke="#ff4d4d" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div style="flex:1 1 auto;">
        <div class="title">Posible fuga de credenciales bloqueada</div>
        <div class="sub">Se ha detenido una solicitud saliente que podría contener credenciales o datos sensibles.</div>
      </div>
    </div>
    <div class="body">
      <div><strong>Método:</strong> ${escapeHtml(alert.method||'-')}</div>
      <div style="margin-top:6px;"><strong>Destino:</strong> <span style="word-break:break-all">${escapeHtml(alert.url||'-')}</span></div>
      <div class="evidence">${prettyPrintEvidence(alert.evidence||'(no evidence)')}</div>
      <div style="margin-top:10px;font-size:13px;color:#444;">
        Revoca credenciales que pudieran haberse expuesto, cambia las contraseñas afectadas y audita procesos que envíen datos sensibles.
      </div>
    </div>
    <div class="actions">
      <button class="telexfil-btn" id="telexfil-copy">Copiar evidencia</button>
      <button class="telexfil-btn primary" id="telexfil-close">Cerrar</button>
    </div>
  </div>
  `;
  return c;
}

function showOverlay(alert) {
  try {
    const node = createOverlay(alert);
    (document.body || document.documentElement).appendChild(node);

    const copyBtn = document.getElementById('telexfil-copy');
    const closeBtn = document.getElementById('telexfil-close');
    copyBtn && copyBtn.addEventListener('click', () => {
      const txt = alert.evidence || '';
      try { 
        navigator.clipboard.writeText(txt); 
        copyBtn.textContent = 'Copiado'; 
        setTimeout(()=>copyBtn.textContent='Copiar evidencia',2000); 
      } catch(e){ 
        fallbackCopy(txt); 
      }
    });
    closeBtn && closeBtn.addEventListener('click', () => {
      const el = document.getElementById(OVERLAY_ID); 
      if (el) el.remove();
    });
  } catch (e) {}
}

function fallbackCopy(txt) {
  try {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position='fixed'; 
    ta.style.left='-99999px';
    document.body.appendChild(ta);
    ta.select(); 
    document.execCommand('copy'); 
    ta.remove();
  } catch (e) {}
}

function dispatchLocalAlertAndShow(url, method, evidence) {
  try {
    if (typeof chrome !== 'undefined' && chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
      try { 
        chrome.runtime.sendMessage({ type:'blocked_exfil', url, method, evidence }); 
      } catch (e) {}
    } else {
      try {
        window.postMessage({ __TELEXFIL_TO_EXT__: true, type: 'blocked_exfil', url, method, evidence }, '*');
      } catch (e) {}
    }
  } catch (e) {}
  try { showOverlay({ time: new Date().toISOString(), url, method, evidence }); } catch (e) {}
}

// Intercepción mejorada
(function() {
  try { if (window.top !== window) return; } catch (e) {}

  // Hook fetch con validación síncrona prioritaria
  try {
    const origFetch = window.fetch.bind(window);
    window.fetch = function(resource, init) {
      try {
        const url = (typeof resource === 'string') ? resource : (resource && resource.url) || '';
        const method = (init && init.method) || 'GET';
        
        if (TELEGRAM_HOST_RX.test(url)) {
          let queryText = '';
          try { queryText = new URL(url, location.href).search; } catch (e) { queryText = ''; }
          
          const bodySync = bodyToTextSync(init && init.body);
          
          if (bodySync !== '__NEEDS_ASYNC_CHECK__') {
            const combined = `${queryText}\n${bodySync}`;
            if (containsSuspicious(combined)) {
              dispatchLocalAlertAndShow(url, method, combined);
              return Promise.reject(new Error('Blocked by Telegram Exfiltration Blocker'));
            }
          } else {
            return (async () => {
              const bodyAsync = await bodyToTextAsync(init && init.body);
              const combined = `${queryText}\n${bodyAsync}`;
              if (containsSuspicious(combined)) {
                dispatchLocalAlertAndShow(url, method, combined);
                throw new Error('Blocked by Telegram Exfiltration Blocker');
              }
              return origFetch(resource, init);
            })();
          }
        }
      } catch (e) {}
      return origFetch(resource, init);
    };
  } catch (e) {}

  // Hook XHR con bloqueo preventivo
  try {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
      try { 
        this.__tel_method = method; 
        this.__tel_url = url; 
        this.__tel_blocked = false;
      } catch (e) {}
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
            const combined = `${queryText}\n${bodySync}`;
            if (containsSuspicious(combined)) {
              this.__tel_blocked = true;
              dispatchLocalAlertAndShow(url, method, combined);
              
              // Bloqueo inmediato
              setTimeout(() => {
                try {
                  Object.defineProperty(this, 'readyState', { value: 4, writable: false });
                  Object.defineProperty(this, 'status', { value: 0, writable: false });
                  Object.defineProperty(this, 'statusText', { value: 'Blocked', writable: false });
                  if (typeof this.onerror === 'function') {
                    this.onerror(new Event('error'));
                  }
                  const errorEvent = new Event('error');
                  this.dispatchEvent(errorEvent);
                } catch (e) {}
              }, 0);
              return;
            }
          } else {
            // Validación asíncrona sin enviar hasta validar
            (async () => {
              const bodyAsync = await bodyToTextAsync(body);
              const combined = `${queryText}\n${bodyAsync}`;
              if (containsSuspicious(combined)) {
                this.__tel_blocked = true;
                dispatchLocalAlertAndShow(url, method, combined);
                try {
                  if (this.abort) this.abort();
                  Object.defineProperty(this, 'readyState', { value: 4, writable: false });
                  Object.defineProperty(this, 'status', { value: 0, writable: false });
                  if (typeof this.onerror === 'function') {
                    this.onerror(new Event('error'));
                  }
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
              dispatchLocalAlertAndShow(url, 'BEACON', bodySync);
              return false;
            }
          }
        } catch (e) {}
        return origSendBeacon(url, data);
      };
    }
  } catch (e) {}

  // Listener para mensajes del MAIN world
  try {
    window.addEventListener('message', event => {
      try {
        const d = event.data;
        if (d && d.__TELEXFIL_BLOCK__) {
          dispatchLocalAlertAndShow(d.url, d.method || 'POST', d.evidence || '(no evidence)');
        }
        if (d && d.__TELEXFIL_TO_EXT__) {
          if (typeof chrome !== 'undefined' && chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
            try { 
              chrome.runtime.sendMessage({ type: d.type, url: d.url, method: d.method, evidence: d.evidence }); 
            } catch (e) {}
          }
        }
      } catch (e) {}
    }, false);
  } catch (e) {}

})();