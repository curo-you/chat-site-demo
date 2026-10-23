* {
  box-sizing: border-box;
}

:root {
  --bg-1: #04070d;
  --bg-2: #09192c;
  --panel: rgba(12, 23, 38, 0.9);
  --panel-alt: rgba(12, 34, 49, 0.95);
  --primary: #0b6ecb;
  --primary-2: #3ca7ff;
  --accent: #7fe7ff;
  --text: #eaf5ff;
  --muted: #9cc1dc;
  --danger: #ff6a6a;
  --success: #82f6b9;
  --shadow: rgba(3, 13, 23, 0.5);
}

html, body {
  margin: 0;
  min-height: 100%;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, var(--bg-1), var(--bg-2));
  color: var(--text);
}

body {
  min-height: 100vh;
}

button, input {
  font: inherit;
}

#app {
  min-height: 100vh;
}

.screen {
  display: none;
  min-height: 100vh;
  padding: 24px;
}

.screen.active {
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-card {
  width: min(460px, 100%);
  background: rgba(9, 18, 28, 0.88);
  border: 1px solid rgba(122, 201, 255, 0.2);
  border-radius: 20px;
  box-shadow: 0 24px 50px var(--shadow);
  padding: 28px 24px;
}

.auth-card h1, .auth-card h2 {
  margin-top: 0;
  color: var(--accent);
  text-align: center;
}

form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--muted);
  font-size: 0.95rem;
}

input[type="text"], input[type="password"], input[type="email"] {
  background: rgba(17, 31, 46, 0.75);
  border: 1px solid rgba(122, 201, 255, 0.25);
  border-radius: 10px;
  color: var(--text);
  padding: 12px 14px;
}

.primary-btn, .secondary-btn {
  border: none;
  border-radius: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: 0.2s ease;
}

.primary-btn {
  background: linear-gradient(135deg, var(--primary), var(--primary-2));
  color: #fff;
  font-weight: 700;
}

.secondary-btn {
  background: rgba(77, 148, 255, 0.12);
  border: 1px solid rgba(153, 219, 255, 0.4);
  color: var(--text);
}

.primary-btn:hover, .secondary-btn:hover {
  transform: translateY(-1px);
}

.hidden {
  display: none !important;
}

.chat-shell {
  width: min(1400px, 100%);
  height: min(92vh, 920px);
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  background: rgba(6, 17, 28, 0.9);
  border: 1px solid rgba(128, 202, 255, 0.2);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 20px 40px var(--shadow);
}

.sidebar {
  background: var(--panel);
  border-right: 1px solid rgba(145, 200, 255, 0.16);
  padding: 14px 12px;
}

.online-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--accent);
  font-weight: 700;
  margin-bottom: 14px;
  padding: 8px 6px;
}

.online-user-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
}

.user-card {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  background: rgba(14, 31, 47, 0.9);
  border: 1px solid rgba(117, 202, 255, 0.18);
  border-radius: 10px;
  padding: 8px 8px;
}

.user-name-button {
  flex: 1 1 110px;
  background: transparent;
  border: none;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  padding: 4px 0;
}

.user-action-btn {
  background: rgba(108, 176, 255, 0.15);
  border: 1px solid rgba(161, 221, 255, 0.28);
  color: var(--text);
  border-radius: 6px;
  padding: 3px 6px;
  font-size: 0.72rem;
  cursor: pointer;
}

.user-action-btn.danger {
  border-color: rgba(255, 102, 102, 0.5);
  background: rgba(255, 120, 120, 0.1);
}

.user-ip {
  width: 100%;
  font-size: 0.68rem;
  color: var(--accent);
  word-break: break-all;
}

.chat-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: linear-gradient(180deg, rgba(6, 21, 31, 0.94), rgba(9, 31, 40, 0.8));
}

.chat-messages {
  flex: 1;
  overflow: auto;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  max-width: min(72%, 700px);
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(17, 51, 75, 0.8);
  border: 1px solid rgba(158, 220, 255, 0.12);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}

.message.me {
  align-self: flex-end;
  background: rgba(13, 92, 160, 0.34);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 0.76rem;
  color: var(--muted);
}

.message-author {
  font-weight: 700;
  color: var(--accent);
}

.message-text {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}

.message-media {
  display: block;
  max-width: 100%;
  margin-top: 8px;
  border-radius: 12px;
}

.message-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}

.message-action-button {
  background: rgba(112, 180, 255, 0.18);
  color: var(--text);
  border: 1px solid rgba(137, 206, 255, 0.3);
  border-radius: 8px;
  cursor: pointer;
  padding: 4px 8px;
}

.composer-wrap {
  padding: 12px 18px 18px;
  border-top: 1px solid rgba(155, 218, 255, 0.12);
  background: rgba(9, 23, 34, 0.92);
}

.admin-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  min-height: 20px;
}

.admin-controls button {
  background: rgba(123, 186, 255, 0.14);
  border: 1px solid rgba(165, 214, 255, 0.3);
  color: var(--text);
  border-radius: 8px;
  padding: 5px 10px;
  cursor: pointer;
}

.composer-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

#message-input {
  flex: 1;
  min-width: 0;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(161, 214, 255, 0.2);
  background: rgba(13, 32, 44, 0.8);
  color: var(--text);
}

.small {
  white-space: nowrap;
  padding: 12px 12px;
}

@media (max-width: 768px) {
  .chat-shell {
    grid-template-columns: 1fr;
    height: 100vh;
  }

  .sidebar {
    border-right: none;
    border-bottom: 1px solid rgba(145, 200, 255, 0.16);
    max-height: 220px;
    overflow: auto;
  }

  .chat-messages {
    padding: 12px;
  }

  .message {
    max-width: 90%;
  }

  .composer-row {
    flex-wrap: wrap;
  }

  #message-input {
    width: 100%;
    flex-basis: 100%;
  }

  .primary-btn, .secondary-btn {
    width: 100%;
  }
}
