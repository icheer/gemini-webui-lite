const SERVER_TYPE = typeof Deno !== 'undefined' ? 'DENO' : 'CF';
const isDeno = SERVER_TYPE === 'DENO';

// ⚠️注意: 仅当您有密码共享需求时才需要配置 SECRET_PASSWORD 和 GEMINI_API_KEYS 这两个环境变量! 否则您无需配置, 默认会使用WebUI填写的API Key进行gemini请求
// 这里是您和您的朋友共享的密码, 优先使用环境变量, 双竖线后可以直接在代码中固定写死(免得去管理面板配置环境变量了) 例如 'yijiaren.308'
const SECRET_PASSWORD = (isDeno ? Deno.env.get('SECRET_PASSWORD') : process.env.SECRET_PASSWORD) || `yijiaren.${~~(Math.random() * 1000)}`;
// 这里是您的Gemini API密钥清单, 多个时使用逗号分隔, 会轮询(随机)使用, 同样也是优先使用环境变量, 其次使用代码中写死的值, 注意不要在公开代码仓库中提交密钥的明文信息, 谨防泄露!!
const GEMINI_API_KEYS = (isDeno ? Deno.env.get('GEMINI_API_KEYS') : process.env.GEMINI_API_KEYS) || 'AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx,AIzayyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy'

const GEMINI_API_KEY_LIST = GEMINI_API_KEYS.split(',');
const htmlContent = getHtmlContent();

// 通用的请求处理函数
async function handleRequest(request, env = {}) {
  const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';

  // 1. 解析和验证请求
  const url = new URL(request.url);
  const apiPath = url.pathname.replace('/proxy', '');

  // 处理HTML页面请求
  if (apiPath === '/' || apiPath === '/index.html') {
    return new Response(htmlContent, {
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "public, max-age=86400" // 缓存1d
      }
    });
  }

  if (!apiPath.startsWith('/v1beta/')) {
    return createErrorResponse(apiPath + 'Invalid API path. Must start with /v1beta/', 400);
  }

  // 2. 获取和验证API密钥
  let apiKey = url.searchParams.get('key') || request.headers.get('x-goog-api-key');
  let urlSearch = url.searchParams.toString();
  if (!apiKey) {
    return createErrorResponse('Missing API key. Provide via ?key= parameter or x-goog-api-key header', 401);
  } else if (apiKey === SECRET_PASSWORD) {
    apiKey = getRandomApiKey();
    urlSearch = urlSearch.replace(`key=${SECRET_PASSWORD}`, `key=${apiKey}`);
  }

  // 3. 构建请求
  const targetUrl = `${GEMINI_API_BASE}${apiPath}?${urlSearch}`;
  const proxyRequest = buildProxyRequest(request, apiKey);

  // 4. 发起请求并处理响应
  try {
    const response = await fetch(targetUrl, proxyRequest);

    // 直接透传响应 - 无缓冲流式处理
    return new Response(response.body, {
      status: response.status,
      headers: response.headers
    });

  } catch (error) {
    console.error('Proxy request failed:', error);
    return createErrorResponse('Proxy request failed', 502);
  }
}

// Cloudflare Workers 导出
export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
};

// Deno Deploy 支持
if (typeof Deno !== 'undefined') {
  Deno.serve(handleRequest);
}

/**
 * 构建代理请求配置
 */
function buildProxyRequest(originalRequest, apiKey) {
  const headers = new Headers();

  // 复制必要的请求头
  const headersToForward = [
    'content-type',
    'accept',
    'accept-encoding',
    'user-agent'
  ];

  headersToForward.forEach(headerName => {
    const value = originalRequest.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  });

  // 设置API密钥
  headers.set('x-goog-api-key', apiKey);

  return {
    method: originalRequest.method,
    headers: headers,
    body: originalRequest.body,
    redirect: 'follow'
  };
}

/**
 * 创建错误响应
 */
function createErrorResponse(message, status) {
  return new Response(
    JSON.stringify({
      error: message,
      timestamp: new Date().toISOString()
    }),
    {
      status: status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

function getRandomApiKey() {
  const len = GEMINI_API_KEY_LIST.length;
  const idx = ~~(Math.random() * len);
  return GEMINI_API_KEY_LIST[idx];
}

function getHtmlContent() {
  return `
<!DOCTYPE html>
<html lang="zh-Hans">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>✨ Gemini Chat</title>
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
  <script src="https://unpkg.com/sweetalert2@11"></script>
  <script src="https://unpkg.com/showdown@2.1.0/dist/showdown.min.js"></script>
  <link rel="stylesheet" href="https://unpkg.com/github-markdown-css/github-markdown-light.css" />
  <script>
    // IndexedDB 封装
    class GeminiDB {
      constructor() {
        this.dbName = 'GeminiChatDB';
        this.version = 1;
        this.storeName = 'chatData';
        this.db = null;
      }

      async init() {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(this.dbName, this.version);

          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            this.db = request.result;
            resolve(this.db);
          };

          request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
              db.createObjectStore(this.storeName, { keyPath: 'key' });
            }
          };
        });
      }

      async setItem(key, value) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
          const transaction = this.db.transaction(
            [this.storeName],
            'readwrite'
          );
          const store = transaction.objectStore(this.storeName);
          const request = store.put({ key, value });

          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
        });
      }

      async getItem(key) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
          const transaction = this.db.transaction(
            [this.storeName],
            'readonly'
          );
          const store = transaction.objectStore(this.storeName);
          const request = store.get(key);

          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const result = request.result;
            resolve(result ? result.value : null);
          };
        });
      }
    }

    // 全局实例
    window.geminiDB = new GeminiDB();
  </script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
        sans-serif;
      background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
      min-height: 100vh;
      color: #333;
    }

    [v-cloak] {
      display: none;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      height: 100vh;
      display: flex;
      gap: 20px;
    }

    .sidebar {
      width: 300px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 15px;
      padding: 20px;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
    }

    .main-chat {
      flex: 1;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 15px;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
    }

    .header {
      padding: 20px;
      border-bottom: 1px solid #e1e5e9;
      display: flex;
      justify-content: between;
      align-items: center;
      gap: 15px;
      flex-wrap: wrap;
    }

    .api-key-section {
      margin-bottom: 20px;
    }

    .api-key-input {
      width: 100%;
      padding: 12px;
      border: 2px solid #e1e5e9;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.3s;
    }

    .api-key-input:focus {
      outline: none;
      border-color: #a8edea;
    }

    .model-select {
      padding: 8px 12px;
      border: 2px solid #e1e5e9;
      border-radius: 6px;
      background: white;
      font-size: 14px;
      cursor: pointer;
    }

    .sessions {
      flex: 1;
      overflow-x: hidden;
      overflow-y: auto;
    }

    .session-item {
      padding: 12px;
      margin-bottom: 8px;
      background: #f8f9fa;
      border: 1px solid transparent;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .session-item:hover {
      background: #e9ecef;
      /* transform: translateX(3px); */
    }

    .session-item.active {
      background: #ffffff;
      color: #2d3748;
      border: 1px solid #a8edea;
      box-shadow: 0 2px 8px rgba(168, 237, 234, 0.2);
    }

    .session-title {
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      margin-right: 8px;
    }

    .delete-btn {
      background: none;
      border: none;
      color: #dc3545 !important;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 14px;
      opacity: 0.7;
    }

    .delete-btn:hover {
      opacity: 1;
      background: rgba(220, 53, 69, 0.1);
    }

    .session-item.active .delete-btn {
      color: rgba(0, 0, 0, 0.6);
    }

    .session-item.active .delete-btn:hover {
      color: rgba(0, 0, 0, 0.8);
      background: rgba(0, 0, 0, 0.1);
    }

    .new-session-btn {
      width: 100%;
      padding: 12px;
      background: #ffffff;
      color: #4a5568;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      margin-bottom: 20px;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .new-session-btn:hover {
      background: #f7fafc;
      border-color: #a8edea;
      color: #2d3748;
      transform: translateY(-1px);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }

    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .message {
      max-width: 80%;
      padding: 15px 20px;
      border-radius: 18px;
      word-wrap: break-word;
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }

    .message.user {
      align-self: flex-end;
      background: linear-gradient(135deg, #a8edea, #fed6e3);
      color: #333;
      margin-left: auto;
    }

    .message.assistant {
      align-self: flex-start;
      background: #f1f3f5;
      color: #333;
    }

    .message-content {
      flex: 1;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .message-delete {
      background: none;
      border: none;
      color: rgba(0, 0, 0, 0.4);
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      margin-left: 8px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .message:hover .message-delete {
      opacity: 1;
    }

    .message.assistant .message-delete {
      color: rgba(0, 0, 0, 0.4);
    }

    .message-delete:hover {
      background: rgba(0, 0, 0, 0.1);
    }

    .input-area {
      padding: 20px;
      border-top: 1px solid #e1e5e9;
      display: flex;
      gap: 10px;
      align-items: flex-end;
    }

    .message-input {
      flex: 1;
      min-height: 44px;
      max-height: 120px;
      padding: 9px 16px;
      border: 2px solid #e1e5e9;
      border-radius: 22px;
      resize: none;
      font-family: inherit;
      font-size: 14px;
      line-height: 1.4;
      transition: border-color 0.3s;
    }

    .message-input:focus {
      outline: none;
      border-color: #a8edea;
    }

    .send-btn {
      padding: 12px 20px;
      background: #4299e1;
      color: white;
      border: none;
      border-radius: 22px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
      min-width: 60px;
      height: 44px;
      box-shadow: 0 2px 4px rgba(66, 153, 225, 0.3);
    }

    .send-btn:hover:not(:disabled) {
      background: #3182ce;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(66, 153, 225, 0.4);
    }

    .send-btn:disabled {
      background: #cbd5e0;
      color: #a0aec0;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .loading {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #a8edea;
      padding: 15px 20px;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid #e1e5e9;
      border-top: 2px solid #a8edea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }

      100% {
        transform: rotate(360deg);
      }
    }

    /* 移动端适配 */
    @media (max-width: 768px) {
      .container {
        flex-direction: column;
        padding: 10px;
        height: 100vh;
        position: relative;
      }

      .sidebar {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100vh;
        z-index: 1000;
        padding: 20px;
        transform: translateX(-100%);
        transition: transform 0.3s ease;
        backdrop-filter: blur(15px);
        background: rgba(255, 255, 255, 0.98);
      }

      .sidebar.show {
        transform: translateX(0);
      }

      .sidebar-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
      }

      .sidebar-overlay.show {
        opacity: 1;
        visibility: visible;
      }

      .mobile-menu-btn {
        position: fixed;
        top: 20px;
        left: 20px;
        width: 44px;
        height: 44px;
        background: rgba(255, 255, 255, 0.35);
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        cursor: pointer;
        z-index: 1001;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        color: #4a5568;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;
      }

      .mobile-menu-btn:hover {
        /* background: #f7fafc; */
        transform: scale(1.05);
      }

      .sidebar-close-btn {
        display: none;
        /* display: flex; */
        position: absolute;
        top: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        background: none;
        border: none;
        cursor: pointer;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        color: #4a5568;
        border-radius: 6px;
        transition: background 0.2s ease;
      }

      .sidebar-close-btn:hover {
        background: rgba(0, 0, 0, 0.05);
      }

      .main-chat {
        flex: 1;
        min-height: 0;
        width: 100%;
        margin-top: 0;
      }

      .header {
        padding: 15px;
        padding-left: 70px;
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }

      .model-select {
        width: 100%;
      }

      .message {
        max-width: 90%;
        padding: 12px 16px;
      }

      .input-area {
        padding: 15px;
        gap: 8px;
      }

      .message-input {
        font-size: 16px;
        /* 防止iOS缩放 */
      }

      .sessions {
        max-height: none;
        flex: 1;
      }
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      color: #6c757d;
      text-align: center;
      padding: 40px;
    }

    .empty-state h3 {
      margin-bottom: 10px;
      color: #495057;
    }

    .error-message {
      background: #f8d7da;
      color: #721c24;
      padding: 12px 16px;
      border-radius: 8px;
      margin: 10px 0;
      border: 1px solid #f5c6cb;
    }

    .role-setting {
      margin-bottom: 15px;
    }

    .role-textarea {
      width: 100%;
      min-height: 90px;
      padding: 12px;
      border: 2px solid #e1e5e9;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      transition: border-color 0.3s;
    }

    .role-textarea:focus {
      outline: none;
      border-color: #a8edea;
    }

    .copy-btn {
      background: none;
      border: 1px solid #e1e5e9;
      color: #666;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      margin-left: 8px;
      opacity: 0;
      transition: all 0.2s;
    }

    .copy-btn:hover {
      background: #f8f9fa;
      border-color: #a8edea;
    }

    .message:hover .copy-btn,
    .session-content:hover .copy-btn {
      opacity: 1;
    }

    .session-content {
      display: flex;
      flex-direction: column;
      gap: 15px;
      padding: 0;
    }

    .content-section {
      position: relative;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #e1e5e9;
    }

    .content-section h4 {
      margin: 0 0 10px 0;
      color: #495057;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .content-section h4 small {
      color: #6c757d;
      font-size: 12px;
    }

    .role-section {
      background: #f8f9fa;
    }

    .question-section {
      background: linear-gradient(135deg,
          rgba(168, 237, 234, 0.1),
          rgba(254, 214, 227, 0.1));
    }

    .answer-section {
      background: #ffffff;
    }

    .rendered-content {
      line-height: 1.6;
    }

    .markdown-body {
      background: none;
      white-space-collapse: collapse;
    }

    .rendered-content h1,
    .rendered-content h2,
    .rendered-content h3,
    .rendered-content h4,
    .rendered-content h5,
    .rendered-content h6 {
      margin: 1em 0 0.5em 0;
      color: #333;
    }

    .rendered-content h1:first-child,
    .rendered-content h2:first-child,
    .rendered-content h3:first-child,
    .rendered-content h4:first-child,
    .rendered-content h5:first-child,
    .rendered-content h6:first-child {
      margin-top: 0;
    }

    .rendered-content p {
      margin: 0.5em 0;
    }

    .rendered-content code {
      background: #f1f3f5;
      padding: 2px 4px;
      border-radius: 3px;
      white-space: pre-wrap !important;
      word-break: break-all !important;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.9em;
    }

    .rendered-content pre {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      white-space-collapse: collapse;
      margin: 1em 0;
    }

    .rendered-content pre code {
      background: none;
      padding: 0;
    }

    .rendered-content blockquote {
      border-left: 4px solid #a8edea;
      margin: 1em 0;
      padding-left: 1em;
      color: #666;
    }

    .rendered-content ul,
    .rendered-content ol {
      margin: 0.5em 0 0.5em 2em;
    }

    .rendered-content li {
      margin: 0.25em 0;
    }

    /* 打字机效果 */
    .typewriter-cursor {
      display: inline-block;
      width: 2px;
      height: 1.2em;
      background-color: #4299e1;
      animation: blink 1s infinite;
      margin-left: 2px;
      vertical-align: text-bottom;
    }

    @keyframes blink {

      0%,
      50% {
        opacity: 1;
      }

      51%,
      100% {
        opacity: 0;
      }
    }

    .streaming-answer {
      min-height: 1.5em;
    }
  </style>
</head>

<body>
  <div id="app">
    <!-- 移动端菜单按钮 -->
    <button @click="toggleSidebar" class="mobile-menu-btn" v-show="isMobile">
      ☰
    </button>

    <!-- 移动端遮罩层 -->
    <div class="sidebar-overlay" :class="{ show: showSidebar && isMobile }" v-cloak @click="hideSidebar"></div>

    <div class="container">
      <!-- 侧边栏 -->
      <div class="sidebar" :class="{ show: showSidebar || !isMobile }" v-cloak>
        <!-- 移动端关闭按钮 -->
        <button @click="hideSidebar" class="sidebar-close-btn" v-show="isMobile">
          ×
        </button>

        <!-- API Key 设置 -->
        <div class="api-key-section">
          <label for="apiKey" style="display: block; margin-bottom: 8px; font-weight: 500">API Key:</label>
          <input type="password" id="apiKey" v-model="apiKey" @input="saveApiKey" class="api-key-input"
            placeholder="请输入您的 Gemini API Key" />
        </div>

        <!-- 角色设定 -->
        <div class="role-setting">
          <label style="display: block; margin-bottom: 8px; font-weight: 500">角色设定 (可选):</label>
          <textarea v-model="globalRolePrompt" @input="updateGlobalRolePrompt" class="role-textarea"
            placeholder="输入系统提示词或角色设定...">
            </textarea>
        </div>

        <!-- 新建会话按钮 -->
        <button @click="createNewSession" class="new-session-btn">
          + 新建会话
        </button>

        <!-- 会话列表 -->
        <div class="sessions">
          <div v-for="session in sessions" :key="session.id" @click="switchSession(session.id)"
            :class="['session-item', { active: currentSessionId === session.id }]">
            <div class="session-title">{{ session.title || '新会话' }}</div>
            <button @click.stop="deleteSession(session.id)" class="delete-btn" title="删除会话">
              ×
            </button>
          </div>
        </div>
      </div>

      <!-- 主聊天区域 -->
      <div class="main-chat">
        <!-- 头部 -->
        <div class="header">
          <h2 style="color: #495057; margin: 0">Gemini Chat</h2>
          <select v-model="selectedModel" class="model-select" :disabled="isLoading || isStreaming">
            <option v-for="model in availableModels" :key="model" :value="model">
              {{ model }}
            </option>
          </select>
        </div>

        <!-- 消息区域 -->
        <div class="messages-container" ref="messagesContainer">
          <div v-if="!currentSession || (!currentSession.question && !currentSession.answer)" class="empty-state">
            <h3>开始与 Gemini 对话</h3>
            <p>选择一个模型并输入您的问题</p>
          </div>

          <div v-if="currentSession && (currentSession.question || currentSession.answer)" class="session-content">
            <!-- 角色设定显示 -->
            <div v-if="currentSession.role.trim()" class="content-section role-section">
              <h4>
                角色设定
                <button @click="copyToClipboard(currentSession.role)" class="copy-btn" title="复制角色设定">
                  复制
                </button>
              </h4>
              <div class="rendered-content markdown-body" v-html="renderMarkdown(currentSession.role)"></div>
            </div>

            <!-- 问题显示 -->
            <div v-if="currentSession.question" class="content-section question-section">
              <h4>
                <span>
                  问题
                  <small v-if="currentSession.createdAt">&emsp;{{ new Date(currentSession.createdAt).toLocaleString()
                    }}</small>
                </span>
                <button @click="copyToClipboard(currentSession.question)" class="copy-btn" title="复制问题">
                  复制
                </button>
              </h4>
              <div class="rendered-content markdown-body" v-html="renderMarkdown(currentSession.question)"></div>
            </div>

            <!-- 回答显示 -->
            <div v-if="currentSession.answer || isStreaming" class="content-section answer-section">
              <h4>
                <span>
                  回答
                  <small v-if="currentSession.model">&emsp;{{ currentSession.model }}</small>
                </span>
                <button v-if="currentSession.answer && !isStreaming" @click="copyToClipboard(currentSession.answer)"
                  class="copy-btn" title="复制回答">
                  复制
                </button>
              </h4>
              <div class="rendered-content markdown-body streaming-answer"
                v-html="renderMarkdown(isStreaming ? streamingContent : currentSession.answer) + (isStreaming ? '<span class=\\'typewriter-cursor\\'></span>' : '')">
              </div>
            </div>
          </div>

          <div v-if="isLoading && !isStreaming" class="loading">
            <div class="spinner"></div>
            <span>AI 正在思考中...</span>
          </div>

          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
        </div>

        <!-- 输入区域 -->
        <div class="input-area">
          <textarea v-model="messageInput" @keydown="handleKeyDown" class="message-input"
            :placeholder="inputPlaceholder" :disabled="!canInput" rows="1" ref="messageInputRef"></textarea>
          <button v-if="isCurrentEnd" class="send-btn" @click="createNewSession">新会话</button>
          <button v-else @click="sendMessage" :disabled="!canSend" class="send-btn">
            发送
          </button>
        </div>
      </div>
    </div>
  </div>

  <script>
    const { createApp } = Vue;

    window.app = createApp({
      data() {
        return {
          apiKey: '',
          messageInput: '',
          isLoading: false,
          errorMessage: '',
          selectedModel: 'gemini-2.5-pro',
          availableModels: [
            'gemini-2.5-pro',
            'gemini-2.5-flash-preview-05-20',
            'gemini-2.5-flash-lite-preview-06-17'
          ],
          sessions: [],
          currentSessionId: null,
          converter: null,
          globalRolePrompt: '',
          isMobile: window.innerWidth <= 768,
          showSidebar: false,
          isStreaming: false,
          streamingContent: '',
          abortController: null
        };
      },
      computed: {
        isPC() {
          return !this.isMobile;
        },
        currentSession() {
          return this.sessions.find(s => s.id === this.currentSessionId);
        },
        isCurrentEnd() {
          return this.currentSession && this.currentSession.answer;
        },
        isBlank() {
          const list = this.sessions || [];
          return !list.some(s => s.answer);
        },
        inputPlaceholder() {
          if (!this.apiKey) {
            return '请先在左上角设置 API Key';
          } else if (this.isLoading || this.isStreaming) {
            return 'AI 正在思考中...';
          } else if (this.currentSession && this.currentSession.answer) {
            return '当前会话已结束';
          } else {
            return '输入您的问题...';
          }
        },
        canInput() {
          return (
            this.apiKey &&
            !this.isLoading &&
            !this.isStreaming &&
            (!this.currentSession || !this.currentSession.answer)
          );
        },
        canSend() {
          return this.messageInput.trim() && this.canInput;
        }
      },
      async mounted() {
        // 初始化 IndexedDB
        await window.geminiDB.init();

        this.converter = new showdown.Converter({
          simpleLineBreaks: true,
          simplifiedAutoLink: true,
          openLinksInNewWindow: true,
          excludeTrailingPunctuationFromURLs: true,
          literalMidWordUnderscores: true,
          strikethrough: true,
          tasklists: true,
          tables: true
        });

        await this.loadData();
        this.autoResizeTextarea();
        if (this.sessions.length === 0) {
          this.createNewSession();
        }

        // 检测是否为移动端
        this.checkMobile();
        window.addEventListener('resize', this.checkMobile);
      },

      beforeUnmount() {
        window.removeEventListener('resize', this.checkMobile);
      },
      methods: {
        async loadData() {
          // 加载 API Key
          this.apiKey =
            (await window.geminiDB.getItem('gemini_api_key')) || '';

          // 加载全局角色设定
          this.globalRolePrompt =
            (await window.geminiDB.getItem('gemini_global_role_prompt')) ||
            '';

          // 加载会话数据
          const savedSessions = await window.geminiDB.getItem(
            'gemini_sessions'
          );
          if (savedSessions) {
            this.sessions = JSON.parse(savedSessions);
          }

          // 加载当前会话ID
          const savedCurrentId = await window.geminiDB.getItem(
            'gemini_current_session'
          );
          if (
            savedCurrentId &&
            this.sessions.find(s => s.id === savedCurrentId)
          ) {
            this.currentSessionId = savedCurrentId;
          } else if (this.sessions.length > 0) {
            this.currentSessionId = this.sessions[0].id;
          }

          // 加载选中的模型
          this.selectedModel =
            (await window.geminiDB.getItem('gemini_selected_model')) ||
            this.availableModels[0];

          // 首次向用户询问 API Key
          if (!this.apiKey && this.isBlank) {
            this.askApiKeyIfNeeded();
          }
        },

        async saveData() {
          await window.geminiDB.setItem(
            'gemini_sessions',
            JSON.stringify(this.sessions)
          );
          await window.geminiDB.setItem(
            'gemini_current_session',
            this.currentSessionId
          );
          await window.geminiDB.setItem(
            'gemini_selected_model',
            this.selectedModel
          );
        },

        async saveApiKey() {
          await window.geminiDB.setItem('gemini_api_key', this.apiKey);
        },

        askApiKeyIfNeeded() {
          if (this.apiKey) return;
          Swal.fire({
            title: '请输入 API Key',
            input: 'password',
            inputPlaceholder: '请输入您的 Gemini API Key',
            showCancelButton: true,
            confirmButtonText: '保存',
            cancelButtonText: '取消',
            reverseButtons: true,
            preConfirm: value => {
              if (!value) {
                Swal.showValidationMessage('API Key 不能为空');
                return false;
              }
              this.apiKey = value;
              this.saveApiKey();
            }
          });
        },

        createNewSession() {
          if (this.isLoading) return;
          const newSession = {
            id: Date.now().toString(),
            title: '新会话',
            role: '',
            question: '',
            answer: '',
            model: '',
            createdAt: new Date().toISOString()
          };
          this.sessions.unshift(newSession);
          this.currentSessionId = newSession.id;
          this.saveData();
          // 移动端创建新会话后隐藏侧边栏
          if (this.isMobile) {
            this.hideSidebar();
          }
        },

        switchSession(sessionId) {
          if (this.isLoading) return;
          this.currentSessionId = sessionId;
          this.saveData();
          // 移动端切换会话后隐藏侧边栏
          if (this.isMobile) {
            this.hideSidebar();
          }
          // this.scrollToBottom();
        },

        deleteSession(sessionId) {
          if (this.isLoading) return;
          const doDelete = () => {
            this.sessions = this.sessions.filter(s => s.id !== sessionId);
            if (this.currentSessionId === sessionId) {
              this.currentSessionId =
                this.sessions.length > 0 ? this.sessions[0].id : null;
            }
            if (this.sessions.length === 0) {
              this.createNewSession();
            }
            this.saveData();
          }
          // 如果是空会话, 直接删除
          const session = this.sessions.find(s => s.id === sessionId);
          if (!session || !session.question) {
            doDelete();
            return;
          }
          Swal.fire({
            title: '确认删除',
            text: '您确定要删除这个会话吗？',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            reverseButtons: true
          }).then(result => {
            if (result.isConfirmed) {
              doDelete();
            }
          });
        },

        deleteMessage(index) {
          // 这个方法不再需要，因为我们改为单轮对话
        },

        updateRolePrompt() {
          this.saveData();
        },

        async updateGlobalRolePrompt() {
          await window.geminiDB.setItem(
            'gemini_global_role_prompt',
            this.globalRolePrompt
          );
        },

        checkMobile() {
          this.isMobile = window.innerWidth <= 768;
          if (!this.isMobile) {
            this.showSidebar = false;
          }
        },

        toggleSidebar() {
          if (this.isLoading || this.isStreaming) return;
          this.showSidebar = !this.showSidebar;
        },

        hideSidebar() {
          this.showSidebar = false;
        },

        cancelStreaming() {
          if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
          }
          this.isStreaming = false;
          this.isLoading = false;
          this.streamingContent = '';
        },

        renderMarkdown(text) {
          if (!text) return '';
          return this.converter.makeHtml(text);
        },

        copyToClipboard(text) {
          navigator.clipboard
            .writeText(text)
            .then(() => {
              Swal.fire({
                title: '复制成功',
                text: '内容已复制到剪贴板',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
              });
            })
            .catch(() => {
              Swal.fire({
                title: '复制失败',
                text: '请手动复制内容',
                icon: 'error',
                confirmButtonText: '确定'
              });
            });
        },

        updateSessionTitle() {
          if (this.currentSession && this.currentSession.question) {
            this.currentSession.title =
              this.currentSession.question.slice(0, 30) +
              (this.currentSession.question.length > 30 ? '...' : '');
          }
        },

        async sendMessage() {
          if (!this.messageInput.trim() || !this.apiKey) return;

          // 如果当前会话已有回答，创建新会话
          if (this.currentSession && this.currentSession.answer) {
            this.createNewSession();
          }

          this.errorMessage = '';
          const userMessage = this.messageInput.trim();
          this.messageInput = '';

          // 添加用户消息
          if (!this.currentSession) {
            this.createNewSession();
          }

          this.currentSession.question = userMessage;
          this.updateSessionTitle();
          this.saveData();
          this.scrollToBottom();

          // 发送到 Gemini API (流式)
          if (this.isLoading || this.isStreaming) return;

          this.isLoading = true;
          this.isStreaming = false;
          this.streamingContent = '';
          this.abortController = new AbortController();

          try {
            // 构建消息内容
            let systemPrompt = '';
            if (this.globalRolePrompt) {
              systemPrompt =
                '#角色设定:\\n' + this.globalRolePrompt + '\\n\\n---\\n\\n';
            }
            const fullMessage = systemPrompt + userMessage;

            const url =
              '/v1beta/models/' +
              this.selectedModel +
              ':streamGenerateContent?key=' +
              this.apiKey;

            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: fullMessage
                      }
                    ]
                  }
                ],
                generationConfig: {
                  temperature: 1,
                  topP: 1
                }
              }),
              signal: this.abortController.signal
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(
                errorData.error?.message ||
                'HTTP ' + response.status + ': ' + response.statusText
              );
            }

            // 开始流式读取
            this.isLoading = false;
            this.isStreaming = true;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();

              if (done) break;

              buffer += decoder.decode(value, { stream: true });

              // 寻找完整的JSON对象
              let braceCount = 0;
              let startIndex = -1;

              for (let i = 0; i < buffer.length; i++) {
                if (buffer[i] === '{') {
                  if (braceCount === 0) {
                    startIndex = i;
                  }
                  braceCount++;
                } else if (buffer[i] === '}') {
                  braceCount--;
                  if (braceCount === 0 && startIndex !== -1) {
                    // 找到完整的JSON对象
                    const jsonStr = buffer.substring(startIndex, i + 1);

                    try {
                      const data = JSON.parse(jsonStr);

                      if (
                        data.candidates &&
                        data.candidates[0] &&
                        data.candidates[0].content
                      ) {
                        const delta =
                          data.candidates[0].content.parts[0]?.text || '';
                        if (delta) {
                          this.streamingContent += delta;
                          this.scrollToBottom();
                        }
                      }
                    } catch (parseError) {
                      console.warn(
                        '解析流式数据失败:',
                        parseError,
                        'JSON:',
                        jsonStr
                      );
                    }

                    // 移除已处理的部分
                    buffer = buffer.substring(i + 1);
                    i = -1; // 重置循环
                    startIndex = -1;
                    braceCount = 0;
                  }
                }
              }
            }

            // 流式完成
            this.currentSession.answer = this.streamingContent;
            this.currentSession.role = this.globalRolePrompt;
            this.currentSession.model = this.selectedModel;
            this.saveData();
          } catch (error) {
            console.error('Error:', error);

            if (error.name === 'AbortError') {
              this.errorMessage = '请求已取消';
            } else {
              this.errorMessage = '发送失败: ' + error.message;

              // 显示错误提示
              Swal.fire({
                title: '发送失败',
                text: error.message,
                icon: 'error',
                confirmButtonText: '确定'
              });
            }
          } finally {
            this.isLoading = false;
            this.isStreaming = false;
            this.streamingContent = '';
            this.abortController = null;
            this.scrollToBottom();
          }
        },

        handleKeyDown(event) {
          if (this.isPC && event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
          }
        },

        autoResizeTextarea() {
          this.$nextTick(() => {
            const textarea = this.$refs.messageInputRef;
            if (textarea) {
              textarea.style.height = 'auto';
              textarea.style.height =
                Math.min(textarea.scrollHeight, 120) + 'px';
            }
          });
        },

        scrollToBottom() {
          this.$nextTick(() => {
            const container = this.$refs.messagesContainer;
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
          });
        }
      },
      watch: {
        messageInput() {
          this.autoResizeTextarea();
        },

        selectedModel() {
          this.saveData();
        },

        currentSessionId() {
          this.scrollToBottom();
        }

        // streamingContent() {
        //   this.scrollToBottom();
        // }
      }
    }).mount('#app');
  </script>
</body>

</html>
  `;
}
