function renderAlerts(alerts) {
  const root = document.getElementById('list');
  if (!alerts || !alerts.length) { root.innerHTML = '<div>No alerts</div>'; return; }
  root.innerHTML = '';
  alerts.forEach(a => {
    const d = document.createElement('div'); d.className = 'alert';
    d.innerHTML = `<div class="time">${a.time}</div><div><strong>Method:</strong> ${a.method} <strong>URL:</strong> ${a.url}</div><pre>${a.evidence || ''}</pre>`;
    root.appendChild(d);
  });
}

function load() {
  chrome.storage.local.get({alerts: []}, items => { renderAlerts(items.alerts); });
}

document.getElementById('clear').addEventListener('click', () => {
  chrome.runtime.sendMessage({type: 'clear_alerts'}, (r) => { load(); });
});

load();
