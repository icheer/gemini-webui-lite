const isDeno = typeof Deno !== 'undefined';
const isCf =
  !isDeno &&
  typeof Request !== 'undefined' &&
  typeof Request.cf !== 'undefined';
// ⚠️注意: 仅当您有密码共享需求时才需要配置 SECRET_PASSWORD 和 GEMINI_API_KEYS 这两个环境变量! 否则您无需配置, 默认会使用WebUI填写的API Key进行gemini请求
// 这里是您和您的朋友共享的密码, 优先使用环境变量, 双竖线后可以直接硬编码(例如 'yijiaren.308' 免得去管理面板配置环境变量了, 但极不推荐这么做!)
const SECRET_PASSWORD =
  getEnv('SECRET_PASSWORD') || `yijiaren.${~~(Math.random() * 1000)}`;
// 这里是您的Gemini API密钥清单, 多个时使用逗号分隔, 会轮询(随机)使用, 同样也是优先使用环境变量, 其次使用代码中硬写的值, 注意不要在公开代码仓库中提交密钥的明文信息, 谨防泄露!!
const GEMINI_API_KEYS =
  getEnv('GEMINI_API_KEYS') ||
  'AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx,AIzayyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy';
const GEMINI_API_KEY_LIST = (GEMINI_API_KEYS || '')
  .split(',')
  .map(i => i.trim())
  .filter(i => i);

// 临时演示密码, 仅限于测试和演示使用, 每小时最多调用15次
const DEMO_PASSWORD = getEnv('DEMO_PASSWORD') || '';
const DEMO_MAX_TIMES_PER_HOUR = getEnv('DEMO_MAX_TIMES_PER_HOUR') || 15;
const demoMemory = { hour: 0, times: 0, maxTimes: DEMO_MAX_TIMES_PER_HOUR };

const GEMINI_API_BASE =
  getEnv('GEMINI_API_BASE') || 'https://generativelanguage.googleapis.com';
const htmlContent = getHtmlContent();

// 获取环境变量
const SERVER_TYPE = isDeno ? 'DENO' : isCf ? 'CF' : 'VPS';
function getEnv(key) {
  if (isDeno) {
    return Deno.env.get(key) || '';
  } else {
    return process.env[key] || '';
  }
}

// 通用的请求处理函数
async function handleRequest(request, env = {}) {
  // 1. 解析和验证请求
  const url = new URL(request.url);
  const apiPath = url.pathname.replace('/proxy', '');

  // 处理HTML页面请求
  if (apiPath === '/' || apiPath === '/index.html') {
    return new Response(htmlContent, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=43200' // 缓存12小时
      }
    });
  }

  // 直接返回客户端的原本的请求信息(用于调试)
  if (apiPath === '/whoami') {
    return new Response(
      JSON.stringify({
        serverType: SERVER_TYPE,
        serverInfo: isDeno
          ? {
              target: Deno.build.target,
              os: Deno.build.os,
              arch: Deno.build.arch,
              vendor: Deno.build.vendor
            }
          : request.cf || 'unknown',
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
        method: request.method,
        bodyUsed: request.bodyUsed
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  if (!apiPath.startsWith('/v1beta/')) {
    return createErrorResponse(
      apiPath + 'Invalid API path. Must start with /v1beta/',
      400
    );
  }

  // 2. 获取和验证API密钥
  let apiKey =
    url.searchParams.get('key') || request.headers.get('x-goog-api-key');
  let urlSearch = url.searchParams.toString();
  if (!apiKey) {
    return createErrorResponse(
      'Missing API key. Provide via ?key= parameter or x-goog-api-key header',
      401
    );
  } else if (apiKey === SECRET_PASSWORD) {
    apiKey = getRandomApiKey();
    urlSearch = urlSearch.replace(`key=${SECRET_PASSWORD}`, `key=${apiKey}`);
  } else if (apiKey === DEMO_PASSWORD) {
    // 临时密码, 仅限于测试使用, 每小时最多调用指定次数
    const hour = Math.floor(Date.now() / 3600000);
    // 检查当前小时是否超过最大调用次数
    if (demoMemory.hour === hour) {
      if (demoMemory.times >= demoMemory.maxTimes) {
        return createErrorResponse(
          'Exceeded maximum API calls for this hour',
          429
        );
      }
    } else {
      // 重置计数
      demoMemory.hour = hour;
      demoMemory.times = 0;
    }
    demoMemory.times++;
    apiKey = getRandomApiKey();
    urlSearch = urlSearch.replace(`key=${DEMO_PASSWORD}`, `key=${apiKey}`);
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
if (isDeno) {
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
    <script src="https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
    <link
      rel="stylesheet"
      href="https://unpkg.com/github-markdown-css/github-markdown-light.css"
    />
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

        // 计算IndexedDB存储空间大小（MB）
        async getTotalDataSize() {
          if (!this.db) await this.init();

          return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(
              [this.storeName],
              'readonly'
            );
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const allData = request.result;
              let totalSize = 0;

              // 计算所有数据的JSON字符串大小
              allData.forEach(item => {
                const jsonString = JSON.stringify(item);
                // 使用UTF-8编码计算字节数
                totalSize += new Blob([jsonString]).size;
              });

              // 转换为MB
              const sizeInMB = totalSize / (1024 * 1024);
              resolve(sizeInMB);
            };
          });
        }

        // 获取存储空间统计信息
        async getStorageStats() {
          if (!this.db) await this.init();

          const stats = {
            totalSizeMB: 0,
            itemCount: 0,
            largestItemKey: '',
            largestItemSizeMB: 0
          };

          return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(
              [this.storeName],
              'readonly'
            );
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const allData = request.result;
              let totalSize = 0;
              let maxSize = 0;
              let maxKey = '';

              allData.forEach(item => {
                const jsonString = JSON.stringify(item);
                const itemSize = new Blob([jsonString]).size;
                totalSize += itemSize;

                if (itemSize > maxSize) {
                  maxSize = itemSize;
                  maxKey = item.key || 'unknown';
                }
              });

              stats.totalSizeMB = totalSize / (1024 * 1024);
              stats.itemCount = allData.length;
              stats.largestItemKey = maxKey;
              stats.largestItemSizeMB = maxSize / (1024 * 1024);

              resolve(stats);
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
        position: relative;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
          sans-serif;
        background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
        min-height: 100vh;
        min-height: 100dvh;
        color: #333;
      }

      [v-cloak] {
        display: none;
      }

      /* 滚动条颜色浅一些 */
      body.pc *::-webkit-scrollbar {
        width: 10px;
        background-color: #f9fafb;
      }

      body.pc *::-webkit-scrollbar-thumb:hover {
        background-color: #d1d5db;
      }

      body.pc *::-webkit-scrollbar-thumb {
        background-color: #e5e7eb;
        border-radius: 5px;
      }

      body.pc *::-webkit-scrollbar-track {
        background-color: #f9fafb;
      }

      button,
      label {
        user-select: none;
      }

      label * {
        vertical-align: middle;
      }

      input::placeholder,
      textarea::placeholder {
        color: #a0aec0;
        user-select: none;
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

      .sidebar.mobile {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100vh;
        height: 100dvh;
        z-index: 1000;
        padding: 20px;
        transform: translateX(-100%);
        transition: transform 0.3s ease;
        backdrop-filter: blur(15px);
        background: rgba(255, 255, 255, 0.98);
        border-radius: 0;
      }

      .sidebar.mobile.show {
        transform: translateX(0);
      }

      .sidebar-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100vh;
        height: 100dvh;
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

      .main-chat {
        flex: 1 1 0;
        background: rgba(255, 255, 255, 0.95);
        border-radius: 15px;
        backdrop-filter: blur(10px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        min-width: 0; /* 防止flex子项撑大父容器 */
        overflow: hidden; /* 确保内容不会溢出 */
      }

      .header {
        position: relative;
        padding: 18px 32px 18px 18px;
        border-bottom: 1px solid #e1e5e9;
        display: flex;
        justify-content: between;
        align-items: center;
        gap: 15px;
        flex-wrap: wrap;
      }

      .header h2 {
        display: flex;
        align-items: center;
        margin: 0;
        color: #495057;
        gap: 6px;
        user-select: none;
      }

      .header .share-btn {
        position: absolute;
        top: 0;
        bottom: 0;
        right: 18px;
        margin: auto 0;
        height: 32px;
        background: none;
        border: 1px solid #e1e5e9;
        color: #666;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
      }

      .header .share-btn:hover {
        background: #f8f9fa;
        border-color: #a8edea;
        color: #2d3748;
        transform: translateY(-1px);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
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
        user-select: none;
      }

      .sessions {
        flex: 1;
        overflow-x: hidden;
        overflow-y: auto;
      }

      .session-item {
        padding: 10px 12px;
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
        font-size: 16px;
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
        background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
        color: #333;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        margin-bottom: 20px;
        transition: all 0.2s ease;
      }

      .new-session-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.12);
        color: #2d3748;
      }

      .messages-container {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 15px;
        min-width: 0; /* 防止内容撑大容器 */
      }

      .message-content {
        flex: 1;
        line-height: 1.5;
        white-space: pre-wrap;
      }

      .input-area {
        padding: 20px;
        border-top: 1px solid #e1e5e9;
        display: flex;
        gap: 10px;
        align-items: flex-end;
        position: relative;
      }

      .input-wrapper {
        flex: 1;
        position: relative;
      }

      .message-input {
        display: block;
        width: 100%;
        min-height: 44px;
        max-height: 144px;
        padding: 9px 16px;
        padding-right: 34px;
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

      .clear-btn {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 20px;
        height: 20px;
        background: #cbd5e0;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        color: #fff;
        transition: all 0.2s ease;
        opacity: 0.7;
      }

      .clear-btn:hover {
        background: #a0aec0;
        opacity: 1;
        transform: translateY(-50%) scale(1.1);
      }

      .send-btn {
        padding: 12px 18px;
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
        padding: 0px 16px 16px;
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
        body {
          overflow: hidden;
        }

        .container {
          flex-direction: column;
          padding: 10px;
          height: 100vh;
          height: 100dvh;
          position: relative;
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

        .header .share-btn {
          top: 16px;
          bottom: auto;
          margin: 0;
        }

        .model-select {
          width: 100%;
        }

        .input-area {
          padding: 12px;
          gap: 6px;
        }

        .input-wrapper {
          flex: 1;
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
        max-height: 30vh;
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

      .copy-btn,
      .reset-btn {
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

      .reset-btn {
        padding: 3px 8px;
        opacity: 1 !important;
      }

      .copy-btn:hover {
        background: #f8f9fa;
        border-color: #a8edea;
      }

      .content-section:hover .copy-btn {
        opacity: 1;
      }

      .session-content {
        display: flex;
        flex-direction: column;
        gap: 15px;
        padding: 8px;
      }

      .content-section {
        flex: 0 0 auto;
        position: relative;
        padding: 15px;
        border-radius: 8px;
        border: 1px solid #e1e5e9;
      }

      .content-section > h4 {
        margin: 0 0 10px 0;
        color: #495057;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .content-section > h4 small {
        color: #6c757d;
        font-size: 12px;
        font-weight: normal;
      }

      .content-section > h4:has(input:checked) {
        margin-bottom: 0;
      }

      .content-section > h4:has(input:checked) + .rendered-content {
        display: none;
      }

      .role-section {
        background: #f8f9fa;
      }

      .question-section {
        background: linear-gradient(
          135deg,
          rgba(168, 237, 234, 0.18),
          rgba(254, 214, 227, 0.18)
        );
      }

      .answer-section {
        background: #ffffff;
      }

      .markdown-body {
        background: none;
        white-space-collapse: collapse;
        overflow-x: auto;
        max-width: 100%;
        word-wrap: break-word;
      }

      /* 表格样式 - 防止溢出 */
      .markdown-body table {
        max-width: 100%;
        width: 100%;
        table-layout: auto;
        border-collapse: collapse;
        margin: 1em 0;
        font-size: 0.9em;
      }

      .markdown-body th,
      .markdown-body td {
        padding: 8px 12px;
        border: 1px solid #e1e5e9;
        text-align: left;
        vertical-align: top;
        word-break: break-word;
        min-width: 0;
      }

      .markdown-body th {
        background-color: #f8f9fa;
        font-weight: 600;
      }

      /* 表格容器 - 提供水平滚动 */
      .rendered-content {
        position: relative;
        line-height: 1.6;
        overflow-x: auto;
        overflow-y: visible;
        max-width: 100%;
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
        border: 1px solid #e1e5e9;
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

      .streaming-answer {
        min-height: 1.5em;
      }
    </style>
  </head>

  <body>
    <div id="app">
      <!-- 移动端菜单按钮 -->
      <button v-show="isMobile" class="mobile-menu-btn" @click="toggleSidebar">
        {{ !showSidebar ? '☰' : '＜' }}
      </button>
      <!-- 移动端遮罩层 -->
      <div
        class="sidebar-overlay"
        :class="{ show: showSidebar && isMobile }"
        v-cloak
        @click="hideSidebar"
      ></div>
      <div class="container">
        <!-- 侧边栏 -->
        <div
          class="sidebar"
          :class="{ show: showSidebar || !isMobile, mobile: isMobile }"
          v-cloak
        >
          <!-- API Key 设置 -->
          <div class="api-key-section">
            <label
              for="apiKey"
              style="display: block; margin-bottom: 8px; font-weight: 500"
              >API Key:</label
            >
            <input
              type="password"
              id="apiKey"
              v-model="apiKey"
              @input="saveApiKey"
              class="api-key-input"
              placeholder="请输入您的 Gemini API Key"
              autocomplete="new-password"
            />
          </div>
          <!-- 角色设定 -->
          <div class="role-setting">
            <label
              for="rolePrompt"
              style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                font-weight: 500;
              "
            >
              <span>角色设定 (可选):</span>
              <button
                v-if="globalRolePrompt"
                class="reset-btn"
                @click="clearRolePrompt"
                title="清空角色设定"
              >
                清空
              </button>
            </label>
            <textarea
              id="rolePrompt"
              v-model="globalRolePrompt"
              @input="updateGlobalRolePrompt"
              class="role-textarea"
              placeholder="输入系统提示词或角色设定..."
            >
            </textarea>
          </div>
          <!-- 新建会话按钮 -->
          <button @click="createNewSession" class="new-session-btn">
            + 新建会话
          </button>
          <!-- 会话列表 -->
          <div class="sessions">
            <div
              v-for="session in sessions"
              :key="session.id"
              @click="switchSession(session.id)"
              :class="['session-item', { active: currentSessionId === session.id }]"
              :title="session.title || '新会话'"
            >
              <div class="session-title">{{ session.title || '新会话' }}</div>
              <button
                @click.stop="deleteSession(session.id)"
                class="delete-btn"
                title="删除会话"
              >
                ×
              </button>
            </div>
          </div>
        </div>
        <!-- 主聊天区域 -->
        <div class="main-chat">
          <!-- 头部 -->
          <div class="header">
            <h2>
              <svg
                height="24"
                viewBox="0 0 24 24"
                width="24"
                xmlns="http://www.w3.org/2000/svg"
                color="#fff"
                style="flex: 0 0 auto; line-height: 1"
              >
                <title>Gemini</title>
                <path
                  d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
                  fill="#3186FF"
                ></path>
                <path
                  d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
                  fill="url(#lobe-icons-gemini-fill-0)"
                ></path>
                <path
                  d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
                  fill="url(#lobe-icons-gemini-fill-1)"
                ></path>
                <path
                  d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
                  fill="url(#lobe-icons-gemini-fill-2)"
                ></path>
                <defs>
                  <linearGradient
                    gradientUnits="userSpaceOnUse"
                    id="lobe-icons-gemini-fill-0"
                    x1="7"
                    x2="11"
                    y1="15.5"
                    y2="12"
                  >
                    <stop stop-color="#08B962"></stop>
                    <stop
                      offset="1"
                      stop-color="#08B962"
                      stop-opacity="0"
                    ></stop>
                  </linearGradient>
                  <linearGradient
                    gradientUnits="userSpaceOnUse"
                    id="lobe-icons-gemini-fill-1"
                    x1="8"
                    x2="11.5"
                    y1="5.5"
                    y2="11"
                  >
                    <stop stop-color="#F94543"></stop>
                    <stop
                      offset="1"
                      stop-color="#F94543"
                      stop-opacity="0"
                    ></stop>
                  </linearGradient>
                  <linearGradient
                    gradientUnits="userSpaceOnUse"
                    id="lobe-icons-gemini-fill-2"
                    x1="3.5"
                    x2="17.5"
                    y1="13.5"
                    y2="12"
                  >
                    <stop stop-color="#FABC12"></stop>
                    <stop
                      offset=".46"
                      stop-color="#FABC12"
                      stop-opacity="0"
                    ></stop>
                  </linearGradient>
                </defs>
              </svg>
              <span>Gemini Chat</span>
            </h2>
            <select
              v-model="selectedModel"
              class="model-select"
              :disabled="isLoading || isStreaming"
              @change="saveData()"
            >
              <option
                v-for="i in availableModels"
                :key="i.value"
                :value="i.value"
              >
                {{ i.label }}
              </option>
            </select>
            <button
              v-if="currentSession && currentSession.answer && !isLoading && !isStreaming"
              class="share-btn"
              @click="shareSession"
            >
              分享问答
            </button>
          </div>
          <!-- 消息区域 -->
          <div class="messages-container" ref="messagesContainer">
            <div
              v-if="!currentSession || (!currentSession.question && !currentSession.answer)"
              class="empty-state"
            >
              <h3>开始与 Gemini 对话</h3>
              <p>选择一个模型并输入您的问题</p>
            </div>
            <div
              v-if="currentSession && (currentSession.question || currentSession.answer)"
              class="session-content"
            >
              <!-- 角色设定显示 -->
              <div
                v-if="currentSession.role.trim()"
                class="content-section role-section"
              >
                <h4>
                  <span>
                    <label for="fold">
                      <span>角色设定　</span>
                      <input type="checkbox" id="fold" v-model="isFoldRole" />
                      <small>&nbsp;折叠</small>
                    </label>
                  </span>
                  <button
                    @click="copyToClipboard(currentSession.role)"
                    class="copy-btn"
                    title="复制角色设定"
                  >
                    复制
                  </button>
                </h4>
                <div
                  class="rendered-content markdown-body"
                  v-html="renderMarkdown(currentSession.role)"
                ></div>
              </div>
              <!-- 问题1 -->
              <div
                v-if="currentSession.question"
                class="content-section question-section"
              >
                <h4>
                  <span>
                    问题
                    <small v-if="currentSession.createdAt"
                      >&emsp;{{ new
                      Date(currentSession.createdAt).toLocaleString() }}</small
                    >
                  </span>
                  <div>
                    <button
                      v-if="!isLoading && !isStreaming && !currentSession.question2"
                      class="copy-btn"
                      title="编辑问题"
                      @click="editQuestion()"
                    >
                      编辑
                    </button>
                    <button
                      @click="copyToClipboard(currentSession.question)"
                      class="copy-btn"
                      title="复制问题"
                    >
                      复制
                    </button>
                  </div>
                </h4>
                <div
                  class="rendered-content markdown-body"
                  v-html="renderMarkdown(currentSession.question)"
                ></div>
              </div>
              <!-- 回答1 -->
              <div
                v-if="currentSession.answer || isStreaming"
                class="content-section answer-section"
              >
                <h4>
                  <span>
                    回答
                    <small v-if="currentSession.model"
                      >&emsp;{{ getModelName(currentSession.model) }}</small
                    >
                  </span>
                  <div v-if="!isStreaming">
                    <button
                      v-if="!currentSession.question2"
                      class="copy-btn"
                      title="删除并重新回答"
                      @click="regenerateAnswer()"
                    >
                      重新回答
                    </button>
                    <button
                      class="copy-btn"
                      title="复制回答"
                      @click="copyToClipboard(currentSession.answer)"
                    >
                      复制
                    </button>
                  </div>
                </h4>
                <div
                  class="rendered-content markdown-body streaming-answer"
                  v-html="renderMarkdown(isStreaming && !currentSession.question2 ? streamingContent : currentSession.answer)"
                ></div>
              </div>
              <!-- 问题2 -->
              <div
                v-if="currentSession.question2"
                class="content-section question-section"
              >
                <h4>
                  <span>
                    追问
                    <small v-if="currentSession.createdAt2"
                      >&emsp;{{ new
                      Date(currentSession.createdAt2).toLocaleString() }}</small
                    >
                  </span>
                  <div>
                    <button
                      v-if="!isLoading && !isStreaming"
                      class="copy-btn"
                      title="编辑追问"
                      @click="editQuestion()"
                    >
                      编辑
                    </button>
                    <button
                      @click="copyToClipboard(currentSession.question2)"
                      class="copy-btn"
                      title="复制问题"
                    >
                      复制
                    </button>
                  </div>
                </h4>
                <div
                  class="rendered-content markdown-body"
                  v-html="renderMarkdown(currentSession.question2)"
                ></div>
              </div>
              <!-- 回答2 -->
              <div
                v-if="currentSession.question2 && (currentSession.answer2 || isStreaming)"
                class="content-section answer-section"
              >
                <h4>
                  <span>
                    回答
                    <small v-if="currentSession.model2"
                      >&emsp;{{ getModelName(currentSession.model2) }}</small
                    >
                  </span>
                  <div v-if="!isStreaming">
                    <button
                      class="copy-btn"
                      title="删除并重新回答"
                      @click="regenerateAnswer()"
                    >
                      重新回答
                    </button>
                    <button
                      class="copy-btn"
                      title="复制回答"
                      @click="copyToClipboard(currentSession.answer2)"
                    >
                      复制
                    </button>
                  </div>
                </h4>
                <div
                  class="rendered-content markdown-body streaming-answer"
                  v-html="renderMarkdown(isStreaming ? streamingContent : currentSession.answer2)"
                ></div>
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
            <div class="input-wrapper">
              <textarea
                v-model="messageInput"
                @input="onInputChange"
                @keydown="handleKeyDown"
                class="message-input"
                :placeholder="inputPlaceholder"
                :disabled="!canInput"
                rows="1"
                ref="messageInputRef"
              ></textarea>
              <button
                v-show="messageInput.trim()"
                @click="clearInput"
                class="clear-btn"
                title="清空输入"
              >
                ×
              </button>
            </div>
            <button
              v-if="isCurrentEnd"
              class="send-btn"
              @click="createNewSession"
            >
              新会话
            </button>
            <button
              v-else
              @click="sendMessage"
              :disabled="!canSend"
              class="send-btn"
            >
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
              { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
              { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
              { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' }
            ],
            sessions: [],
            currentSessionId: null,
            isFoldRole: false,
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
            const session = this.currentSession;
            return session && session.answer && session.answer2;
          },
          isTotallyBlank() {
            const list = this.sessions || [];
            return !list.some(s => s.answer);
          },
          inputPlaceholder() {
            const session = this.currentSession || {};
            if (!this.apiKey) {
              return '请先在左上角设置 API Key';
            } else if (this.isLoading) {
              return 'AI 正在思考中...';
            } else if (this.isStreaming) {
              return 'AI 正在生成回答...';
            } else if (session.answer2) {
              return '当前会话已结束';
            } else if (session.answer) {
              return '输入您的追问...';
            } else {
              return '输入您的问题...';
            }
          },
          canInput() {
            const session = this.currentSession;
            return (
              this.apiKey &&
              !this.isLoading &&
              !this.isStreaming &&
              (!session || !session.answer2)
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
          if (this.sessions.length === 0) {
            this.createNewSession();
          }
          // 检测是否为移动端
          this.checkMobile();
          window.addEventListener('resize', this.checkMobile);

          // 计算geminiDB总数据量
          const totalDataSize = await window.geminiDB.getTotalDataSize();
          if (totalDataSize > 2) {
            Swal.fire({
              title: '数据量过大',
              text:
                '当前存储的数据量为' +
                totalDataSize.toFixed(2) +
                ' MB，超过了 2MB，可能会影响性能。建议清理一些旧会话。',
              icon: 'warning',
              confirmButtonText: '知道了'
            });
          }
        },

        beforeUnmount() {
          window.removeEventListener('resize', this.checkMobile);
        },
        methods: {
          sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
          },
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
            this.autoFoldRolePrompt();

            // 加载选中的模型
            this.selectedModel =
              (await window.geminiDB.getItem('gemini_selected_model')) ||
              this.availableModels[0].value;

            // 加载当前会话的草稿
            this.loadDraftFromCurrentSession();

            // 首次向用户询问 API Key
            if (!this.apiKey && this.isTotallyBlank) {
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
            // 保存当前会话的草稿
            this.saveDraftToCurrentSession();
            const firstSession = this.sessions[0];
            if (firstSession && !firstSession.question) {
              this.currentSessionId = firstSession.id;
            } else {
              const newSession = {
                id: Date.now().toString(),
                title: '新会话',
                hasSummary: false,
                model: '',
                model2: '',
                role: '',
                question: '',
                answer: '',
                question2: '',
                answer2: '',
                createdAt: '',
                createdAt2: '',
                draft: ''
              };
              this.sessions.unshift(newSession);
              this.currentSessionId = newSession.id;
            }
            // 加载新会话的草稿
            this.loadDraftFromCurrentSession();
            this.saveData();
            // 移动端创建新会话后隐藏侧边栏
            if (this.isMobile) {
              this.hideSidebar();
            }
          },

          switchSession(sessionId) {
            if (this.isLoading) return;
            // 保存当前会话的草稿
            this.saveDraftToCurrentSession();
            this.currentSessionId = sessionId;
            // 加载新会话的草稿
            this.loadDraftFromCurrentSession();
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
              this.loadDraftFromCurrentSession();
              this.saveData();
            };
            // 如果是空会话, 直接删除
            const session = this.sessions.find(s => s.id === sessionId);
            if (!session) return;
            if (!session.question && !session.answer && !session.draft) {
              doDelete();
              return;
            }
            Swal.fire({
              title: '确认删除',
              text: '您确定要删除这个会话吗？',
              icon: 'warning',
              showCancelButton: true,
              confirmButtonColor: '#d33',
              confirmButtonText: '删除',
              cancelButtonText: '取消',
              reverseButtons: true
            }).then(result => {
              if (result.isConfirmed) {
                doDelete();
              }
            });
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

          clearRolePrompt() {
            this.globalRolePrompt = '';
            this.updateGlobalRolePrompt();
          },

          checkMobile() {
            const isUaMobile = navigator.userAgent
              .toLowerCase()
              .includes('mobile');
            const isSizeMobile = window.innerWidth <= 768;
            this.isMobile = isUaMobile || isSizeMobile;
            if (this.isMobile) {
              document.body.className = 'mobile';
            } else {
              document.body.className = 'pc';
              this.showSidebar = true;
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

          shareSession() {
            const sessionContent = document.querySelector('.session-content');
            if (!sessionContent) {
              Swal.fire({
                title: '截图失败',
                text: '未找到要截图的内容',
                icon: 'error',
                confirmButtonText: '确定'
              });
              return;
            }

            // 显示加载提示
            Swal.fire({
              title: '正在生成截图...',
              allowOutsideClick: false,
              didOpen: () => {
                Swal.showLoading();
              }
            });

            // 使用html2canvas截图
            html2canvas(sessionContent, {
              backgroundColor: '#ffffff',
              scale: window.devicePixelRatio || 1,
              useCORS: true,
              allowTaint: false,
              logging: false,
              height: null,
              width: null
            })
              .then(canvas => {
                // 检测是否为微信浏览器环境
                const userAgent = navigator.userAgent.toLowerCase();
                const isWechat =
                  userAgent.includes('micromessenger') &&
                  userAgent.includes('mobile');
                if (isWechat) {
                  // 微信环境：显示图片让用户长按保存
                  const imageDataUrl = canvas.toDataURL('image/png');
                  Swal.fire({
                    title: '长按图片保存',
                    html:
                      '<img src="' +
                      imageDataUrl +
                      '" style="max-width: 100%; height: auto; border-radius: 8px;" />',
                    showConfirmButton: true,
                    confirmButtonText: '我知道了',
                    width: '92%',
                    padding: '0.25em 0 2em',
                    customClass: {
                      htmlContainer: 'swal-image-container'
                    }
                  });
                } else {
                  // 非微信环境：使用原有的下载逻辑
                  const link = document.createElement('a');
                  const regex = new RegExp('[\/\: ]', 'g');
                  link.download =
                    'gemini-chat-' +
                    new Date().toLocaleString().replace(regex, '-') +
                    '.png';
                  link.href = canvas.toDataURL('image/png');

                  // 触发下载
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);

                  // 显示成功消息
                  Swal.fire({
                    title: '截图成功',
                    text: '图片已保存到下载文件夹',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                  });
                }
              })
              .catch(error => {
                console.error('截图失败:', error);
                Swal.fire({
                  title: '截图失败',
                  text: '生成图片时出现错误: ' + error.message,
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

          getModelName(value) {
            return (
              this.availableModels.find(i => i.value === value)?.label || value
            );
          },

          async sendMessage() {
            if (!this.messageInput.trim() || !this.apiKey) return;
            if (this.isLoading || this.isStreaming) return;

            // 如果当前会话已有回答，创建新会话
            if (this.currentSession && this.currentSession.answer2) {
              this.createNewSession();
              return;
            }

            this.errorMessage = '';
            const userMessage = this.messageInput.trim();
            this.clearInput();
            // 清空当前会话的草稿
            if (this.currentSession) {
              this.currentSession.draft = '';
            }

            // 添加用户消息
            if (!this.currentSession) {
              this.createNewSession();
            }
            const session = this.currentSession;
            session.role = this.globalRolePrompt.trim();

            // 判断是第一轮or第二轮问答
            if (!session.answer) {
              session.createdAt = new Date().toISOString();
              session.model = this.selectedModel;
              session.question = userMessage;
              session.answer = '';
              session.question2 = '';
              session.answer2 = '';
              this.autoFoldRolePrompt();
            } else {
              session.createdAt2 = new Date().toISOString();
              session.model2 = this.selectedModel;
              session.question2 = userMessage;
              session.answer2 = '';
            }
            this.updateSessionTitle();
            this.saveData();
            this.scrollToBottom();

            // 发送到 Gemini API (流式)
            const contents = [];
            this.isLoading = true;
            this.isStreaming = false;
            this.streamingContent = '';
            this.abortController = new AbortController();

            // 组装contents
            if (this.globalRolePrompt.trim()) {
              contents.push(
                {
                  role: 'user',
                  parts: [
                    {
                      text: '#角色设定:\\n' + this.globalRolePrompt
                    }
                  ]
                },
                {
                  role: 'model',
                  parts: [
                    {
                      text: '好的，我明白了。'
                    }
                  ]
                }
              );
            }
            // 继续组装QA消息
            ['question', 'answer', 'question2', 'answer2'].forEach(key => {
              const text = session[key];
              if (!text) return;
              contents.push({
                role: key.startsWith('question') ? 'user' : 'model',
                parts: [{ text }]
              });
            });

            try {
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
                  contents,
                  generationConfig: {
                    temperature: 1,
                    topP: 1
                  }
                }),
                signal: this.abortController.signal
              }).catch(e => {
                throw e;
              });

              if (!response.ok) {
                const errorData = await response.json().catch(e => ({}));
                throw new Error(
                  errorData.error ||
                    errorData?.[0]?.error?.message ||
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
                            data.candidates[0].content.parts?.[0]?.text || '';
                          if (delta) {
                            const shouldScroll = !this.streamingContent;
                            this.streamingContent += delta;
                            if (shouldScroll) {
                              this.scrollToBottom();
                            }
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
              const answerKey = session.question2 ? 'answer2' : 'answer';
              this.currentSession[answerKey] = this.streamingContent;
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
              this.generateSessionSummary();
              // this.scrollToBottom();
            }
          },

          // 编辑已经问过的问题
          editQuestion() {
            if (this.isLoading || this.isStreaming) return;
            if (!this.currentSession) return;
            // 二次确认
            Swal.fire({
              title: '确认编辑问题',
              text: '这会导致对应的回答被清空，您确定要编辑这个问题吗？',
              icon: 'warning',
              showCancelButton: true,
              confirmButtonText: '确定',
              confirmButtonColor: '#d33',
              cancelButtonText: '取消',
              reverseButtons: true
            }).then(result => {
              if (!result.isConfirmed) return;
              const session = this.currentSession;
              const questionText = session.question2 || session.question || '';
              if (session.question2) {
                session.question2 = '';
                session.createdAt2 = '';
                session.model2 = '';
                session.answer2 = '';
              } else {
                session.question = '';
                session.createdAt = '';
                session.model = '';
                session.answer = '';
                session.title = '新会话';
                session.hasSummary = false;
              }
              session.draft = questionText;
              this.messageInput = questionText;
              this.saveData();
            });
          },

          // 删除最新的回答并重新回答
          regenerateAnswer() {
            // 二次确认
            Swal.fire({
              title: '确认删除回答',
              text: '确定要删除这个回答并重新生成吗？',
              icon: 'warning',
              showCancelButton: true,
              confirmButtonText: '确定',
              confirmButtonColor: '#d33',
              cancelButtonText: '取消',
              reverseButtons: true
            }).then(result => {
              if (!result.isConfirmed) return;
              if (this.isLoading || this.isStreaming) return;
              if (!this.currentSession || !this.currentSession.answer) return;
              // 如果是第二轮问答，删除第二轮回答
              if (this.currentSession.answer2) {
                this.currentSession.answer2 = '';
                this.currentSession.createdAt2 = '';
                this.currentSession.model2 = '';
                this.messageInput = this.currentSession.question2 || '';
                this.currentSession.question2 = '';
              } else {
                // 如果是第一轮问答，删除第一轮回答
                this.currentSession.answer = '';
                this.currentSession.createdAt = '';
                this.currentSession.model = '';
                this.messageInput = this.currentSession.question || '';
                this.currentSession.question = '';
              }
              this.saveData();
              this.sendMessage();
            });
          },

          // 生成会话摘要
          async generateSessionSummary() {
            const session = this.currentSession;
            if (!session || !session.question || !session.answer) return;
            if (session.hasSummary) return;
            let { id, question, answer } = session;
            question =
              question.length <= 300
                ? question
                : question.slice(0, 150) + '......' + question.slice(-150);
            answer =
              answer.length <= 300
                ? answer
                : answer.slice(0, 150) + '......' + answer.slice(-150);
            const contents = [
              {
                role: 'user',
                parts: [{ text: question }]
              },
              {
                role: 'model',
                parts: [{ text: answer }]
              },
              {
                role: 'user',
                parts: [
                  {
                    text: '请为以上的一问一答生成一个简短的摘要，概括对话的主题，12字以内（不要有任何开场白、解释说明、结尾总结，也不要任何格式，句中可以包含标点符号，但不要以标点符号结尾）'
                  }
                ]
              }
            ];
            fetch(
              '/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' +
                this.apiKey,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  contents,
                  generationConfig: {
                    temperature: 1,
                    topP: 1,
                    maxOutputTokens: 100
                  }
                })
              }
            )
              .then(response => {
                if (!response.ok) {
                  throw new Error(
                    'HTTP ' + response.status + ': ' + response.statusText
                  );
                }
                return response.json();
              })
              .then(async data => {
                if (
                  data.candidates &&
                  data.candidates[0] &&
                  data.candidates[0].content
                ) {
                  let summary =
                    data.candidates[0].content.parts?.[0]?.text || '';
                  if (summary) {
                    const item = this.sessions.find(s => s.id === id);
                    if (item) {
                      if (
                        summary.endsWith('。') ||
                        summary.endsWith('！') ||
                        summary.endsWith('？')
                      ) {
                        summary = summary.slice(0, -1);
                      }
                      item.title = summary;
                      item.hasSummary = true;
                      await this.sleep(800);
                      this.saveData();
                    }
                  }
                } else {
                  throw new Error('未能生成摘要');
                }
              })
              .catch(error => {
                console.error('生成摘要失败:', error);
              });
          },

          // 根据全局角色设定的字符长度决定是否折叠
          autoFoldRolePrompt() {
            const len = this.globalRolePrompt.length;
            if (len > 150) {
              this.isFoldRole = true;
            } else {
              this.isFoldRole = false;
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
                  Math.min(textarea.scrollHeight, 144) + 'px';
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
          },

          // 如果当前已经滑动到底部，则保持在底部
          async stickToBottom() {
            await this.$nextTick();
            const vh = window.innerHeight;
            const container = this.$refs.messagesContainer;
            if (!container) return;
            // 如果当前容器滚动高度低于1.5倍window.innerHeight, 强制滚动到底部
            if (container.scrollHeight < vh * 1.5) {
              container.scrollTop = container.scrollHeight;
              return;
            }
            const isAtBottom =
              container.scrollHeight - container.scrollTop <=
              container.clientHeight + vh * 0.25;
            if (isAtBottom) {
              container.scrollTop = container.scrollHeight;
            }
          },

          // 清空输入框
          clearInput() {
            this.messageInput = '';
            this.saveDraftToCurrentSession();
          },

          // 输入变化时的处理
          onInputChange() {
            this.saveDraftToCurrentSession();
          },

          // 保存草稿到当前会话
          saveDraftToCurrentSession() {
            if (this.currentSession) {
              this.currentSession.draft = this.messageInput;
              this.saveData();
            }
          },

          // 从当前会话加载草稿
          loadDraftFromCurrentSession() {
            if (this.currentSession) {
              this.messageInput = (this.currentSession.draft || '').trim();
            } else {
              this.messageInput = '';
            }
          }
        },
        watch: {
          messageInput() {
            this.autoResizeTextarea();
          },
          streamingContent() {
            this.stickToBottom();
          }
        }
      }).mount('#app');
    </script>
  </body>
</html>
  `;
}
