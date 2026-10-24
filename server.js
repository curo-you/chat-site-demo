const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'chat-data.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const SUPER_ADMIN_USERS = ['nsiJiski', 'HyUUkj', 'UKind', 'Msamu'];
const ADMIN_USERS = ['92729', '284847', '9484948', '639473', '903830'];

function normalizeIp(ip) {
  return (ip || 'unknown').replace('::ffff:', '');
}

function formatRemaining(ms) {
  if (ms <= 0) return '0秒';
  const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}時間`);
  if (minutes > 0) parts.push(`${minutes}分`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}秒`);
  return parts.join(' ');
}

function generateUniqueUsername(base) {
  const normalizedBase = (base || 'user').trim();
  if (!normalizedBase) return 'user';

  const matches = state.users.filter((u) => u.username === normalizedBase || u.username.startsWith(`${normalizedBase}#`));
  if (matches.length === 0) return normalizedBase;
  const count = matches.length;
  return `${normalizedBase}#${count}`;
}

function readState() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const seed = {
        users: [],
        messages: [],
        bans: [],
        ipBans: [],
        sessions: {},
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
      return seed;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: parsed.users || [],
      messages: parsed.messages || [],
      bans: parsed.bans || [],
      ipBans: parsed.ipBans || [],
      sessions: parsed.sessions || {},
    };
  } catch (err) {
    console.error('Failed to read state:', err);
    return {
      users: [],
      messages: [],
      bans: [],
      ipBans: [],
      sessions: {},
    };
  }
}

let state = readState();

function persistState() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function createDefaultAdminUser(username, role) {
  const existing = state.users.find((user) => user.username === username);
  if (existing) return existing;

  const user = {
    id: uuidv4(),
    username,
    displayName: username,
    password: username,
    role,
    ip: 'local',
    createdAt: Date.now(),
    online: false,
    lastSeen: Date.now(),
    banned: false,
    mutedUntil: 0,
  };

  state.users.push(user);
  persistState();
  return user;
}

function ensureDefaultUsers() {
  SUPER_ADMIN_USERS.forEach((name) => createDefaultAdminUser(name, 'superadmin'));
  ADMIN_USERS.forEach((name) => createDefaultAdminUser(name, 'admin'));
}

ensureDefaultUsers();

function userById(userId) {
  return state.users.find((u) => u.id === userId);
}

function userByUsername(username) {
  return state.users.find((u) => u.username === username);
}

function isUserBanned(userId) {
  const user = userById(userId);
  if (!user) return false;
  if (user.banned) return true;
  const ban = state.bans.find((entry) => entry.userId === userId && !entry.expiredAt);
  return Boolean(ban);
}

function getMuteRemaining(userId) {
  const user = userById(userId);
  if (!user || !user.mutedUntil) return 0;
  const remaining = Number(user.mutedUntil) - Date.now();
  return remaining > 0 ? remaining : 0;
}

function isIpBanned(ip) {
  const normalized = normalizeIp(ip);
  return state.ipBans.includes(normalized);
}

function setUserOnline(userId, isOnline) {
  const user = userById(userId);
  if (!user) return;
  user.online = Boolean(isOnline);
  user.lastSeen = Date.now();
}

function getUserFromToken(token) {
  if (!token) return null;
  const session = state.sessions[token];
  if (!session) return null;
  const user = userById(session.userId);
  if (!user) return null;
  user.online = true;
  user.lastSeen = Date.now();
  return user;
}

function getOnlineUsers() {
  const now = Date.now();
  state.users.forEach((user) => {
    if (user.online && now - user.lastSeen > 30000) {
      user.online = false;
    }
  });

  return state.users
    .filter((user) => user.online)
    .map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      ip: user.ip,
      mutedUntil: user.mutedUntil,
      banned: user.banned,
      lastSeen: user.lastSeen,
    }));
}

function canDeleteMessage(actor, message) {
  if (!actor || !message) return false;
  if (actor.role === 'superadmin') return true;
  if (message.senderId === actor.id) return true;
  return false;
}

function canEditMessage(actor, message) {
  return canDeleteMessage(actor, message);
}

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

async function performExternalRequest({ url, method = 'GET', headers = {}, body = undefined, responseType = 'json', timeout = 15000 }) {
  if (!url || typeof url !== 'string') {
    throw new Error('URLが指定されていません。');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (error) {
    throw new Error('URLの形式が正しくありません。');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('http/https のURLのみ外部通信できます。');
  }

  const requestMethod = String(method || 'GET').toUpperCase();
  const requestHeaders = { ...headers };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const requestOptions = {
      method: requestMethod,
      headers: requestHeaders,
      signal: controller.signal,
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(requestMethod) && body !== undefined && body !== null) {
      const isPlainObject = typeof body === 'object' && !ArrayBuffer.isView(body) && !(body instanceof ArrayBuffer);
      if (isPlainObject && !Object.keys(requestHeaders).some((key) => key.toLowerCase() === 'content-type')) {
        requestHeaders['Content-Type'] = 'application/json';
      }
      requestOptions.headers = requestHeaders;
      requestOptions.body = isPlainObject ? JSON.stringify(body) : String(body);
    }

    const response = await fetch(parsedUrl.toString(), requestOptions);
    const contentType = response.headers.get('content-type') || '';

    let data;
    if (responseType === 'text' || !contentType.includes('application/json')) {
      data = await response.text();
    } else {
      data = await response.json().catch(() => response.text());
    }

    return {
      ok: response.ok,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('外部通信がタイムアウトしました。');
    }
    throw new Error(error.message || '外部通信に失敗しました。');
  } finally {
    clearTimeout(timer);
  }
}

app.get('/api/session', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = getUserFromToken(token);
  if (!user) return res.json({ user: null });
  return res.json({ user: { ...user, password: undefined } });
});

app.post('/api/login', (req, res) => {
  const { username, password, adminPassword } = req.body || {};
  const normalizedUsername = String(username || '').trim();
  const normalizedPassword = String(password || '').trim();
  const normalizedAdminPassword = String(adminPassword || '').trim();

  if (!normalizedUsername || !normalizedPassword) {
    return res.status(400).json({ error: 'ユーザー名とパスワードを入力してください。' });
  }

  const user = state.users.find((u) => u.username === normalizedUsername && u.password === normalizedPassword);
  if (user) {
    if (user.banned) {
      return res.status(403).json({ error: 'このユーザーはBANされています。' });
    }
    if (isIpBanned(req.ip)) {
      return res.status(403).json({ error: 'このIPはBANされています。' });
    }

    const token = uuidv4();
    state.sessions[token] = { userId: user.id, ip: normalizeIp(req.ip), lastSeen: Date.now() };
    user.ip = normalizeIp(req.ip);
    user.online = true;
    user.lastSeen = Date.now();
    persistState();

    return res.json({ token, user: { ...user, password: undefined } });
  }

  const adminUser = state.users.find((u) => u.username === normalizedUsername && u.role !== 'user');
  if (adminUser && normalizedAdminPassword === adminUser.password) {
    if (adminUser.banned) {
      return res.status(403).json({ error: 'この管理者はBANされています。' });
    }
    if (isIpBanned(req.ip)) {
      return res.status(403).json({ error: 'このIPはBANされています。' });
    }

    const token = uuidv4();
    state.sessions[token] = { userId: adminUser.id, ip: normalizeIp(req.ip), lastSeen: Date.now() };
    adminUser.ip = normalizeIp(req.ip);
    adminUser.online = true;
    adminUser.lastSeen = Date.now();
    persistState();

    return res.json({ token, user: { ...adminUser, password: undefined } });
  }

  return res.status(401).json({ error: 'ログイン情報が正しくありません。' });
});

app.post('/api/register', (req, res) => {
  const { username, password, confirmPassword } = req.body || {};
  const trimmedUsername = String(username || '').trim();
  const trimmedPassword = String(password || '').trim();
  const trimmedConfirmPassword = String(confirmPassword || '').trim();

  if (!trimmedUsername || !trimmedPassword || !trimmedConfirmPassword) {
    return res.status(400).json({ error: 'ユーザー名、パスワード、確認用パスワードを入力してください。' });
  }

  if (trimmedPassword !== trimmedConfirmPassword) {
    return res.status(400).json({ error: 'パスワードと確認用パスワードが一致しません。' });
  }

  const ip = normalizeIp(req.ip);
  const sameIpUsers = state.users.filter((user) => user.ip === ip && user.role === 'user');
  if (sameIpUsers.length >= 3) {
    return res.status(400).json({ error: '同じIPアドレスでは3つまでアカウントを作成できます。' });
  }

  const uniqueUsername = generateUniqueUsername(trimmedUsername);

  const user = {
    id: uuidv4(),
    username: uniqueUsername,
    displayName: uniqueUsername,
    password: trimmedPassword,
    role: 'user',
    ip,
    createdAt: Date.now(),
    online: false,
    lastSeen: Date.now(),
    banned: false,
    mutedUntil: 0,
  };

  state.users.push(user);
  const token = uuidv4();
  state.sessions[token] = { userId: user.id, ip, lastSeen: Date.now() };
  user.online = true;
  persistState();

  return res.json({ token, user: { ...user, password: undefined } });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ファイルが見つかりません。' });
  const relativeUrl = `/uploads/${req.file.filename}`;
  res.json({ url: relativeUrl });
});

app.post('/api/external', async (req, res) => {
  try {
    const { url, method, headers, body, responseType, timeout } = req.body || {};
    const result = await performExternalRequest({
      url,
      method,
      headers,
      body,
      responseType,
      timeout,
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || '外部通信に失敗しました。' });
  }
});

app.get('/api/messages', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const actor = getUserFromToken(token);
  if (!actor) return res.status(401).json({ error: '認証が必要です。' });

  const visibleMessages = state.messages.filter((message) => {
    if (!message.private) return true;
    if (actor.role === 'superadmin') return true;
    if (actor.role === 'admin') return message.senderId === actor.id || message.toUserId === actor.id;
    return message.senderId === actor.id || message.toUserId === actor.id;
  });

  res.json({ messages: visibleMessages });
});

app.post('/api/messages', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const actor = getUserFromToken(token);
  if (!actor) return res.status(401).json({ error: '認証が必要です。' });

  if (actor.banned) {
    return res.status(403).json({ error: 'BAN中のため発言できません。' });
  }

  const remainingMuteMs = getMuteRemaining(actor.id);
  if (remainingMuteMs > 0) {
    return res.status(403).json({ error: `ミュート中です。残り: ${formatRemaining(remainingMuteMs)}` });
  }

  const { text, fileUrl, replyToId, privateTargetId } = req.body || {};
  const content = String(text || '').trim();

  if (content === '/削除') {
    state.messages = [];
    persistState();
    return res.json({ success: true, action: 'delete_all' });
  }

  if (!content && !fileUrl) {
    return res.status(400).json({ error: 'メッセージ内容を入力してください。' });
  }

  let target = null;
  if (privateTargetId) {
    target = state.users.find((user) => user.id === privateTargetId);
    if (!target) return res.status(404).json({ error: '指定されたユーザーが見つかりません。' });
  }

  const message = {
    id: uuidv4(),
    senderId: actor.id,
    senderName: actor.username,
    senderDisplayName: actor.displayName,
    content,
    fileUrl: fileUrl || '',
    type: fileUrl ? (fileUrl.match(/\.(mp4|webm|ogg|mov)$/i) ? 'video' : 'image') : 'text',
    createdAt: Date.now(),
    replyToId: replyToId || null,
    private: Boolean(target),
    toUserId: target ? target.id : null,
    toUserName: target ? target.username : null,
  };

  state.messages.push(message);
  persistState();
  res.json({ success: true, message });
});

app.put('/api/messages/:messageId', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const actor = getUserFromToken(token);
  if (!actor) return res.status(401).json({ error: '認証が必要です。' });

  const message = state.messages.find((entry) => entry.id === req.params.messageId);
  if (!message) return res.status(404).json({ error: 'メッセージが見つかりません。' });

  if (!canEditMessage(actor, message)) {
    return res.status(403).json({ error: '編集権限がありません。' });
  }

  const nextText = String(req.body.text || '').trim();
  if (!nextText) return res.status(400).json({ error: '編集内容を入力してください。' });

  message.content = nextText;
  message.editedAt = Date.now();
  persistState();
  res.json({ success: true, message });
});

app.delete('/api/messages/:messageId', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const actor = getUserFromToken(token);
  if (!actor) return res.status(401).json({ error: '認証が必要です。' });

  const messageIndex = state.messages.findIndex((entry) => entry.id === req.params.messageId);
  if (messageIndex === -1) return res.status(404).json({ error: 'メッセージが見つかりません。' });

  const message = state.messages[messageIndex];
  if (!canDeleteMessage(actor, message)) {
    return res.status(403).json({ error: '削除権限がありません。' });
  }

  state.messages.splice(messageIndex, 1);
  persistState();
  res.json({ success: true });
});

app.get('/api/online', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const actor = getUserFromToken(token);
  if (!actor) return res.status(401).json({ error: '認証が必要です。' });

  const onlineUsers = getOnlineUsers().map((user) => ({
    ...user,
    ip: actor.role === 'superadmin' ? user.ip : (actor.id === user.id || actor.role === 'admin' ? user.ip : undefined),
  }));

  res.json({ onlineUsers, currentUser: { ...actor, password: undefined } });
});

app.post('/api/moderate', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const actor = getUserFromToken(token);
  if (!actor) return res.status(401).json({ error: '認証が必要です。' });

  const { targetUserId, action, minutes = 1 } = req.body || {};
  const targetUser = state.users.find((user) => user.id === targetUserId);
  if (!targetUser) return res.status(404).json({ error: '対象ユーザーが見つかりません。' });

  const isSuperAdmin = actor.role === 'superadmin';
  const isAdmin = actor.role === 'admin';

  if ((targetUser.role === 'superadmin' || targetUser.role === 'admin') && actor.role === 'admin') {
    return res.status(403).json({ error: '管理者は特権管理者を操作できません。' });
  }

  if (action === 'deleteAll') {
    if (!isSuperAdmin && !isAdmin) return res.status(403).json({ error: '権限がありません。' });
    state.messages = [];
    persistState();
    return res.json({ success: true });
  }

  if (action === 'ban') {
    if (!isSuperAdmin && !isAdmin) return res.status(403).json({ error: '権限がありません。' });
    if (targetUser.role === 'superadmin') return res.status(403).json({ error: '特権管理者はBANできません。' });
    targetUser.banned = true;
    persistState();
    return res.json({ success: true, message: `${targetUser.username}をBANしました。` });
  }

  if (action === 'unban') {
    if (!isSuperAdmin && !isAdmin) return res.status(403).json({ error: '権限がありません。' });
    targetUser.banned = false;
    persistState();
    return res.json({ success: true, message: `${targetUser.username}のBANを解除しました。` });
  }

  if (action === 'mute') {
    if (!isSuperAdmin && !isAdmin) return res.status(403).json({ error: '権限がありません。' });
    if (targetUser.role === 'superadmin') return res.status(403).json({ error: '特権管理者はミュートできません。' });
    targetUser.mutedUntil = Date.now() + (Number(minutes) || 1) * 60 * 1000;
    persistState();
    return res.json({ success: true, message: `${targetUser.username}を${minutes}分ミュートしました。` });
  }

  if (action === 'unmute') {
    if (!isSuperAdmin && !isAdmin) return res.status(403).json({ error: '権限がありません。' });
    targetUser.mutedUntil = 0;
    persistState();
    return res.json({ success: true, message: `${targetUser.username}のミュートを解除しました。` });
  }

  if (action === 'ipban') {
    if (!isSuperAdmin) return res.status(403).json({ error: '特権管理者のみIPBANできます。' });
    const ip = targetUser.ip || 'unknown';
    if (!state.ipBans.includes(ip)) {
      state.ipBans.push(ip);
    }
    persistState();
    return res.json({ success: true, message: `${targetUser.username}のIP:${ip}をBANしました。` });
  }

  if (action === 'ipunban') {
    if (!isSuperAdmin) return res.status(403).json({ error: '特権管理者のみIPBAN解除できます。' });
    const ip = targetUser.ip || 'unknown';
    state.ipBans = state.ipBans.filter((entry) => entry !== ip);
    persistState();
    return res.json({ success: true, message: `${targetUser.username}のIP:${ip}のBANを解除しました。` });
  }

  return res.status(400).json({ error: '不明な操作です。' });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

setInterval(() => {
  const now = Date.now();
  state.users.forEach((user) => {
    if (user.mutedUntil && user.mutedUntil <= now) {
      user.mutedUntil = 0;
    }
  });
  persistState();
}, 5000);

app.listen(PORT, () => {
  console.log(`Chat app running at http://localhost:${PORT}`);
});
