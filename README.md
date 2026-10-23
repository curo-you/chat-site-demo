const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterButton = document.getElementById('show-register');
const chatMessages = document.getElementById('chat-messages');
const onlineUsersEl = document.getElementById('online-users');
const onlineCountEl = document.getElementById('online-count');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const attachFileButton = document.getElementById('attach-file');
const fileInput = document.getElementById('file-input');
const adminControls = document.getElementById('admin-controls');

const state = {
  token: localStorage.getItem('chatToken') || '',
  user: null,
  messages: [],
  onlineUsers: [],
  replyToId: null,
  editingMessageId: null,
};

const api = {
  async request(endpoint, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
    }
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'Content-Type' in headers ? headers['Content-Type'] : 'application/json';
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
      body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || '操作に失敗しました。');
    }
    return data;
  },
};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setScreen(screenName) {
  loginScreen.classList.toggle('active', screenName === 'login');
  chatScreen.classList.toggle('active', screenName === 'chat');
}

function renderLoginError(message) {
  alert(message);
}

async function login(username, password, adminPassword) {
  try {
    const response = await api.request('/api/login', {
      method: 'POST',
      body: { username, password, adminPassword },
    });

    state.token = response.token;
    state.user = response.user;
    localStorage.setItem('chatToken', state.token);
    setScreen('chat');
    await loadMessages();
    await loadOnlineUsers();
    startPolling();
  } catch (error) {
    renderLoginError(error.message);
  }
}

async function register(username, password, confirmPassword) {
  try {
    const response = await api.request('/api/register', {
      method: 'POST',
      body: { username, password, confirmPassword },
    });

    state.token = response.token;
    state.user = response.user;
    localStorage.setItem('chatToken', state.token);
    setScreen('chat');
    await loadMessages();
    await loadOnlineUsers();
    startPolling();
  } catch (error) {
    renderLoginError(error.message);
  }
}

async function loadMessages() {
  try {
    const response = await api.request('/api/messages');
    state.messages = response.messages || [];
    renderMessages();
  } catch (error) {
    console.error('Failed to load messages', error);
  }
}

async function loadOnlineUsers() {
  try {
    const response = await api.request('/api/online');
    state.onlineUsers = response.onlineUsers || [];
    renderOnlineUsers();
    updateAdminControls();
  } catch (error) {
    console.error('Failed to load online users', error);
  }
}

function renderMessages() {
  if (!state.user) return;

  const userId = state.user.id;
  const currentRole = state.user.role;

  const visibleMessages = state.messages.filter((message) => {
    if (!message.private) return true;
    if (currentRole === 'superadmin') return true;
    if (currentRole === 'admin') return message.senderId === userId || message.toUserId === userId;
    return message.senderId === userId || message.toUserId === userId;
  });

  chatMessages.innerHTML = visibleMessages
    .map((message) => {
      const isMine = message.senderId === userId;
      const canModerate = currentRole === 'superadmin';
      const isEditable = canModerate || isMine;
      const replyName = message.replyToId ? state.messages.find((m) => m.id === message.replyToId)?.senderDisplayName || 'ユーザー' : '';
      const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const mediaHtml = message.fileUrl
        ? message.type === 'video'
          ? `<video class="message-media" controls src="${message.fileUrl}"></video>`
          : `<img class="message-media" src="${message.fileUrl}" alt="uploaded media" />`
        : '';

      return `
        <div class="message ${isMine ? 'me' : ''}" data-message-id="${message.id}">
          <div class="message-header">
            <span class="message-author">${escapeHtml(message.senderDisplayName || message.senderName)}</span>
            <span>${time}</span>
          </div>
          ${replyName ? `<div class="reply-label">↩ ${escapeHtml(replyName)}</div>` : ''}
          <div class="message-text">${escapeHtml(message.content || '')}</div>
          ${mediaHtml}
          ${(isEditable || currentRole === 'superadmin' || currentRole === 'admin') ? `
            <div class="message-actions">
              <button class="message-action-button" data-action="reply" data-message-id="${message.id}">返信</button>
              ${isEditable ? `<button class="message-action-button" data-action="edit" data-message-id="${message.id}">編集</button>` : ''}
              ${(currentRole === 'superadmin' || isMine) ? `<button class="message-action-button" data-action="delete" data-message-id="${message.id}">削除</button>` : ''}
            </div>
          ` : ''}
        </div>
      `;
    })
    .join('');

  chatMessages.scrollTop = chatMessages.scrollHeight;

  chatMessages.querySelectorAll('[data-action="reply"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const messageId = button.dataset.messageId;
      const target = state.messages.find((item) => item.id === messageId);
      if (!target) return;
      state.replyToId = messageId;
      const prefix = `返信: ${target.senderDisplayName || target.senderName}\n`;
      messageInput.value = prefix;
      messageInput.focus();
    });
  });

  chatMessages.querySelectorAll('[data-action="edit"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const messageId = button.dataset.messageId;
      const target = state.messages.find((item) => item.id === messageId);
      if (!target) return;
      state.editingMessageId = messageId;
      messageInput.value = target.content;
      messageInput.focus();
    });
  });

  chatMessages.querySelectorAll('[data-action="delete"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const messageId = button.dataset.messageId;
      try {
        await api.request(`/api/messages/${messageId}`, { method: 'DELETE' });
        await loadMessages();
      } catch (error) {
        alert(error.message);
      }
    });
  });
}

function renderOnlineUsers() {
  if (!state.user) return;

  const currentRole = state.user.role;
  onlineCountEl.textContent = String(state.onlineUsers.length);

  onlineUsersEl.innerHTML = state.onlineUsers
    .map((user) => {
      const isCurrentUser = user.id === state.user.id;
      const showIp = currentRole === 'superadmin' || currentRole === 'admin';
      const canModerate = currentRole === 'superadmin' || currentRole === 'admin';
      const canIpModerate = currentRole === 'superadmin';

      return `
        <div class="user-card">
          <button class="user-name-button" data-user-id="${user.id}" data-user-name="${escapeHtml(user.username)}">
            ${escapeHtml(user.username)}${isCurrentUser ? ' (自分)' : ''}
          </button>
          ${canModerate && !isCurrentUser ? `
            <button class="user-action-btn" data-action="mute" data-user-id="${user.id}">M</button>
            <button class="user-action-btn" data-action="unmute" data-user-id="${user.id}">MK</button>
            <button class="user-action-btn danger" data-action="ban" data-user-id="${user.id}">B</button>
            <button class="user-action-btn danger" data-action="unban" data-user-id="${user.id}">BK</button>
            ${canIpModerate ? `
              <button class="user-action-btn" data-action="ipban" data-user-id="${user.id}">P</button>
              <button class="user-action-btn" data-action="ipunban" data-user-id="${user.id}">PK</button>
            ` : ''}
          ` : ''}
          ${showIp ? `<div class="user-ip">IP: ${escapeHtml(user.ip || 'unknown')}</div>` : ''}
        </div>
      `;
    })
    .join('');

  onlineUsersEl.querySelectorAll('.user-name-button').forEach((button) => {
    button.addEventListener('click', () => {
      const username = button.dataset.userName;
      messageInput.value = `prm ${username}`;
      messageInput.focus();
    });
  });

  onlineUsersEl.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const { action, userId } = button.dataset;
      const minutes = action === 'mute' ? 1 : 0;
      try {
        await api.request('/api/moderate', {
          method: 'POST',
          body: { targetUserId: userId, action, minutes },
        });
        await loadOnlineUsers();
      } catch (error) {
        alert(error.message);
      }
    });
  });
}

function updateAdminControls() {
  if (!state.user) {
    adminControls.classList.add('hidden');
    return;
  }

  if (state.user.role === 'superadmin') {
    adminControls.classList.remove('hidden');
    adminControls.innerHTML = `
      <button data-admin-action="deleteAll">全メッセージ削除</button>
      <button data-admin-action="banAll">全ユーザーBAN</button>
    `;
    adminControls.querySelectorAll('[data-admin-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          if (btn.dataset.adminAction === 'deleteAll') {
            await api.request('/api/moderate', {
              method: 'POST',
              body: { targetUserId: state.user.id, action: 'deleteAll' },
            });
            await loadMessages();
            return;
          }
          alert('このデモでは全ユーザーBANは利用できません。');
        } catch (error) {
          alert(error.message);
        }
      });
    });
    return;
  }

  if (state.user.role === 'admin') {
    adminControls.classList.remove('hidden');
    adminControls.innerHTML = `
      <button data-admin-action="deleteAll">全メッセージ削除</button>
    `;
    adminControls.querySelectorAll('[data-admin-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api.request('/api/moderate', {
            method: 'POST',
            body: { targetUserId: state.user.id, action: 'deleteAll' },
          });
          await loadMessages();
        } catch (error) {
          alert(error.message);
        }
      });
    });
    return;
  }

  adminControls.classList.add('hidden');
  adminControls.innerHTML = '';
}

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text && !fileInput.files[0]) {
    alert('メッセージを入力してください。');
    return;
  }

  try {
    let payload = { text: text || '', replyToId: state.replyToId || null };
    let fileUrl = '';

    if (fileInput.files[0]) {
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      const uploadResponse = await api.request('/api/upload', {
        method: 'POST',
        body: formData,
      });
      fileUrl = uploadResponse.url;
      payload.fileUrl = fileUrl;
    }

    if (payload.text.startsWith('prm ')) {
      const parts = payload.text.split(' ');
      const targetUserName = parts.slice(1).join(' ');
      const targetUser = state.onlineUsers.find((user) => user.username === targetUserName || user.displayName === targetUserName);
      if (!targetUser) {
        alert('対象ユーザーがオンラインではありません。');
        return;
      }
      payload.privateTargetId = targetUser.id;
      payload.text = payload.text.replace(new RegExp(`^prm ${targetUserName}`), '').trim();
    }

    if (state.editingMessageId) {
      await api.request(`/api/messages/${state.editingMessageId}`, {
        method: 'PUT',
        body: { text: payload.text || '' },
      });
      state.editingMessageId = null;
    } else {
      await api.request('/api/messages', {
        method: 'POST',
        body: payload,
      });
    }

    state.replyToId = null;
    fileInput.value = '';
    messageInput.value = '';
    await loadMessages();
  } catch (error) {
    alert(error.message);
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const adminPassword = document.getElementById('login-admin-password').value;
  await login(username, password, adminPassword);
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = document.getElementById('register-username').value;
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm').value;
  await register(username, password, confirmPassword);
});

showRegisterButton.addEventListener('click', () => {
  const registerPanel = document.getElementById('register-panel');
  registerPanel.classList.toggle('hidden');
});

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    sendMessage();
  }
});
attachFileButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) {
    const label = fileInput.files[0].name;
    messageInput.value = label ? `${messageInput.value} ${label}`.trim() : messageInput.value;
  }
});

async function bootstrap() {
  if (!state.token) {
    setScreen('login');
    return;
  }

  try {
    const response = await api.request('/api/session');
    if (!response.user) {
      setScreen('login');
      return;
    }
    state.user = response.user;
    setScreen('chat');
    await loadMessages();
    await loadOnlineUsers();
    startPolling();
  } catch (error) {
    console.error(error);
    setScreen('login');
  }
}

let pollTimer = null;
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!state.user) return;
    await loadMessages();
    await loadOnlineUsers();
  }, 3000);
}

bootstrap();
