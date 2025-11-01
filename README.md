# Telegram Exfiltration Blocker

**Telegram Exfiltration Blocker** is a browser extension designed to protect users against phishing attacks that leverage Telegram’s API to exfiltrate credentials or other sensitive data. It detects and blocks unauthorized attempts to send sensitive information via Telegram endpoints while browsing.

---

## 🚀 Features

- Detects attempts by malicious scripts to send user credentials or data to Telegram API endpoints  
- Blocks requests that match exfiltration patterns  
- Works silently in background; minimal performance overhead  
- Popup UI to view blocked attempts  
- Fallback content script to improve detection coverage  

---

## 🧩 Architecture / Components

| Component | Purpose |
|-----------|---------|
| `background.js` | Observe outgoing web requests and intercept/block those matching Telegram exfiltration patterns |
| `content_fallback.js` | Monitors in-page scripts and DOM events, providing a fallback layer in case background interception misses something |
| `popup.html` / `popup.js` | UI to show blocked requests or logs to the user, offering transparency |
| `manifest.json` | Defines permissions, background, content scripts, host permissions, etc. |
| `icon48.png` | The extension’s icon (48×48) |
  
---

## ✅ Detection Logic

- The extension checks outgoing requests and inspects their destination URL, headers, and payload to identify if they resemble known Telegram API endpoints used for credential exfiltration  
- If a request is flagged, it is blocked and logged  
- The popup UI allows the user to review blocked attempts (e.g. URL, timestamp)  

---

## 🛠 Installation & Usage

1. Clone or download this repository  
2. Open your browser’s extensions page (e.g. `chrome://extensions/`)  
3. Enable “Developer mode”  
4. Click “Load unpacked” and select this project’s directory  
5. The extension will be active immediately  

Once installed, it runs in the background. You can click the extension icon to view blocked attempts in the popup.

---
## Detection Example
<img width="533" height="426" alt="image" src="https://github.com/user-attachments/assets/e2763dff-3ebf-43ca-9f5f-7b5e7a2db06f" />


## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.


## License

MIT License
