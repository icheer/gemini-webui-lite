# Gemini Cloudflare WebUI Lite - 自部署的 Gemini AI 代理服务

[![Deploy to Cloudflare Workers](https://img.shields.io/badge/Deploy%20to-Cloudflare%20Workers-orange?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](#license)
[![Gemini API](https://img.shields.io/badge/Powered%20by-Gemini%20API-4285F4?style=flat-square&logo=google)](https://ai.google.dev/)

一个简单易用的 Cloudflare Worker 程序，让您能够快速部署自己的 Gemini AI 代理服务。只需要一个域名和 Gemini API Key，即可免费为家人朋友提供 AI 问答服务。
请合理使用 AI 资源，避免滥用！

## ✨ 特性

- 🚀 **一键部署** - 基于 Cloudflare Workers，免费且快速
- 🔐 **密码保护** - 支持共享密码，保护您的 API Key
- 💬 **实时对话** - 流式响应，支持打字机效果
- 📱 **响应式设计** - 完美适配桌面端和移动端
- 💾 **本地存储** - 基于 IndexedDB 的持久化历史记录
- 🎨 **极简界面** - 养老版 Gemini Chat，简洁易用
- 🌐 **多模型支持** - 支持 Gemini 2.5 Pro/Flash 等多个模型

## 🎯 功能说明

### 核心功能
- **代理服务**: 提供标准的 Gemini API 代理端点
- **Web 界面**: 内置精美的聊天界面
- **密码机制**: 可设置共享密码，避免直接暴露 API Key
- **流式响应**: 实时显示 AI 回答，提升用户体验

### 使用特点
- 一事一议，一问一答的对话模式
- 历史记录保存在浏览器本地（注意：更换浏览器无法共享历史）
- 支持角色设定和系统提示词
- 支持 Markdown 渲染和代码高亮

## 🚀 快速开始

### 准备工作

1. **获取 Gemini API Key**
   - 访问 [Google AI Studio](https://aistudio.google.com/app/apikey)
   - 创建新的 API Key 并妥善保存

2. **准备域名**
   - 拥有一个域名（可以是免费域名）
   - 将域名托管到 Cloudflare

### 部署步骤

1. **创建 Cloudflare Worker**
   ```bash
   # 登录 Cloudflare Dashboard
   # 进入 Workers & Pages
   # 点击 "Create application" -> "Create Worker"
   ```

2. **配置代码**
   - 将 `worker.js` 中的代码复制到 Worker 编辑器
   - 修改以下配置：
   ```javascript
   const SECRET_PASSWORD = 'your-shared-password';  // 设置共享密码
   const UNIVERSAL_API_KEY = 'your-gemini-api-key'; // 填入您的 API Key
   ```

3. **绑定自定义域名**
   - 在 Worker 设置中添加自定义域名
   - 配置 DNS 记录（托管在Cloudflare的域名可以自动完成此步骤）

4. **测试部署**
   - 访问您的域名
   - 输入共享密码测试功能

## 📚 API 使用

### 基础端点

```
https://your-domain.com/proxy/v1beta/models/{model}:generateContent
```

### REST API 调用示例

```bash
# 使用共享密码
curl -X POST "https://your-domain.com/proxy/v1beta/models/gemini-2.5-pro:generateContent?key=your-shared-password" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "parts": [
          {
            "text": "你好，请介绍一下自己"
          }
        ]
      }
    ]
  }'

# 使用完整 API Key
curl -X POST "https://your-domain.com/proxy/v1beta/models/gemini-2.5-pro:generateContent?key=your-full-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "parts": [
          {
            "text": "Hello, how can you help me?"
          }
        ]
      }
    ]
  }'
```

### 流式请求示例

```bash
curl -X POST "https://your-domain.com/proxy/v1beta/models/gemini-2.5-pro:streamGenerateContent?key=your-password" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "parts": [
          {
            "text": "写一首关于编程的诗"
          }
        ]
      }
    ]
  }'
```

## 🎨 Web 界面使用

1. **访问界面**: 打开 `https://your-domain.com`
2. **设置密钥**: 在左侧输入共享密码或完整 API Key
3. **角色设定**: （可选）设置系统提示词或角色设定
4. **开始对话**: 选择模型并输入问题
5. **查看历史**: 左侧会自动保存历史会话

### 支持的模型

- `gemini-2.5-pro` - 最新的 Pro 模型
- `gemini-2.5-flash-preview-05-20` - Flash 预览版
- `gemini-2.5-flash-lite-preview-06-17` - Lite 预览版

## ⚙️ 配置说明

### 环境变量

在 `worker.js` 中修改以下常量：

```javascript
// 共享密码 - 您和朋友约定的密码
const SECRET_PASSWORD = 'your-shared-password';

// Gemini API Key - 您的真实 API Key
const UNIVERSAL_API_KEY = 'your-gemini-api-key';
```

### 安全建议

- 使用强密码作为 `SECRET_PASSWORD`
- 定期更换共享密码
- 不要在公开场合分享您的域名
- 考虑在 Cloudflare 中设置访问规则

## 🔧 自定义修改

### 修改界面样式
Web 界面的 HTML/CSS/JS 代码都在 `getHtmlContent()` 函数中，您可以：
- 修改主题颜色
- 调整布局结构
- 添加新功能

### 添加新模型
在 `availableModels` 数组中添加新的模型名称：
```javascript
availableModels: [
  'gemini-2.5-pro',
  'your-new-model',
  // ...
]
```

## 📱 移动端支持

界面完全适配移动端：
- 响应式布局
- 触摸友好的操作
- 侧边栏自动收缩
- 优化的输入体验

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE) 文件。

## ⚠️ 注意事项

- 历史记录仅保存在浏览器本地，更换设备或清除浏览器数据会丢失
- 请合理使用 API，避免过度消耗配额
- 建议定期备份重要的对话记录
- 本项目仅供学习和个人使用

## 🙋‍♂️ 常见问题

**Q: 为什么选择一问一答模式？**
A: 简化交互逻辑，降低复杂度，更适合快速问答场景。

**Q: 可以支持多轮对话吗？**
A: 目前暂不支持，每次都是独立的对话。如有需要可以在角色设定中添加上下文。

**Q: 历史记录可以导出吗？**
A: 目前使用 IndexedDB 存储，可以通过浏览器开发者工具查看和导出数据。

**Q: 部署需要付费吗？**
A: Cloudflare Workers 有免费额度，一般个人使用完全够用。

---

如果这个项目对您有帮助，请给个 ⭐ Star！
