# Gemini Cloudflare WebUI Lite - 自部署的 Gemini AI 代理服务

[![Deploy to Deno Deploy](https://img.shields.io/badge/Deploy%20to-Deno%20Deploy-00ADD8?style=flat-square&logo=deno)](https://dash.deno.com/)
[![Deploy to Cloudflare Workers](https://img.shields.io/badge/Deploy%20to-Cloudflare%20Workers-orange?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](#license)
[![Gemini API](https://img.shields.io/badge/Powered%20by-Gemini%20API-4285F4?style=flat-square&logo=google)](https://ai.google.dev/)

一个简单易用的 Deno Deploy / Cloudflare Worker 程序，让您能够快速部署自己的 Gemini AI 代理服务。只需要一个域名和 Gemini API Key，即可免费为家人朋友提供 AI 问答服务。

> 🎯 **推荐使用 Deno Deploy 部署**  
> 由于国内访问 Cloudflare Workers 大概率优先匹配到 HK 节点，访问可能不稳定，强烈推荐使用 **Deno Deploy** 部署本服务，访问速度更快更稳定！

请合理使用 AI 资源，避免滥用！

## ✨ 特性

- 🚀 **一键部署** - 基于 Deno Deploy / Cloudflare Workers，免费且快速
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

2. **准备域名（可选）**
   - 拥有一个域名（可以是免费域名）
   - 用于绑定到部署服务

### 部署步骤

**🎯 方式一：Deno Deploy（推荐）**

> ⚡ 推荐使用 Deno Deploy，因为国内访问速度更快，部署更简单！

1. **Fork 项目到您的 GitHub**

   - 将项目代码上传到您的 GitHub 仓库

2. **配置代码（可选）**

   - 如需密码共享功能，可编辑 `worker.js` 文件：

   ```javascript
   const SECRET_PASSWORD = 'your-shared-password'; // 设置共享密码
   const GEMINI_API_KEYS = 'key1,key2,key3'; // API Key 列表，逗号分隔
   ```

   - 或者使用环境变量配置（推荐，无需修改源代码）

3. **部署到 Deno Deploy**

   - 访问 [Deno Deploy](https://dash.deno.com/)
   - 使用 GitHub 账号登录
   - 点击 "New Project"
   - 选择您的 GitHub 仓库
   - 设置入口文件为 `worker.js`
   - 点击 "Deploy"

4. **配置环境变量（可选但推荐）**

   - 在 Deno Deploy 项目设置中添加环境变量：
     - `SECRET_PASSWORD`: 共享密码
     - `GEMINI_API_KEYS`: API Key 列表（逗号分隔）
   - 环境变量优先级高于代码中的硬编码值

5. **绑定自定义域名（可选，推荐）**

   - 在项目设置中点击 "Domains"
   - 添加您的自定义域名
   - 按照提示配置 DNS 记录
   - Deno Deploy 会自动提供 SSL 证书

6. **测试部署**
   - 访问您的 Deno Deploy 域名（如：`https://your-project.deno.dev`）
   - 或访问您的自定义域名
   - 输入共享密码测试功能

**🛠️ 方式二：Cloudflare Workers（备选）**

> ⚠️ 由于国内访问 CF Workers 大概率匹配到 HK 节点，访问可能不稳定

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
   const SECRET_PASSWORD = 'your-shared-password'; // 设置共享密码
   const GEMINI_API_KEYS = 'key1,key2,key3'; // API Key 列表，逗号分隔
   ```

3. **绑定自定义域名**

   - 在 Worker 设置中添加自定义域名
   - 配置 DNS 记录（需要域名托管在 Cloudflare）

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
- `gemini-2.5-flash-lite-preview-06-17` - Flash-Lite 预览版

## ⚙️ 配置说明

### 环境变量配置（推荐）

项目支持通过环境变量进行配置，这样更安全且便于管理：

**Deno Deploy 环境变量设置：**

1. 在项目设置页面找到 "Environment Variables"
2. 添加以下环境变量：
   - `SECRET_PASSWORD`: 共享密码，如 `mypassword123`
   - `GEMINI_API_KEYS`: API Key 列表，多个用逗号分隔，如 `Key1,Key2,Key3`

**Cloudflare Workers 环境变量设置：**

1. 在 Worker 设置中找到 "Variables"
2. 添加环境变量（同上）

### 代码配置（备选）

如果不想使用环境变量，也可以直接在 `worker.js` 中修改：

```javascript
// ⚠️ 注意: 仅当您有密码共享需求时才需要配置这些变量
// 否则无需配置，默认会使用 WebUI 填写的 API Key 进行 Gemini 请求

// 共享密码 - 您和朋友约定的密码
const SECRET_PASSWORD = 'your-shared-password';

// Gemini API Key 列表 - 多个用逗号分隔，支持自动轮换
const GEMINI_API_KEYS = 'Key1,Key2,Key3';
```

### 配置优先级

1. **环境变量** > **代码硬编码值**
2. 如果都未配置，将使用默认值：
   - `SECRET_PASSWORD`: 随机生成（如 `yijiaren.123`）
   - `GEMINI_API_KEYS`: 示例密钥（需要替换）

### 使用说明

**无需配置的情况：**

- 如果您只是想个人使用，无需配置任何环境变量
- 直接在 Web 界面输入您的 API Key 即可正常使用

**需要配置的情况：**

- 想要分享给朋友使用，避免暴露真实 API Key
- 希望配置多个 API Key 实现负载均衡
- 需要统一管理 API Key

### 安全建议

- **优先使用环境变量**：避免在代码中硬编码敏感信息
- **使用强密码**：设置复杂的 `SECRET_PASSWORD`
- **定期轮换**：定期更换共享密码和 API Key
- **访问控制**：不要在公开场合分享您的域名
- **多密钥配置**：配置多个 API Key 提高可用性和稳定性

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
  'your-new-model'
  // ...
];
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

**Q: 为什么推荐 Deno Deploy 而不是 Cloudflare Workers？**
A: 国内访问 Cloudflare Workers 大概率匹配到香港节点，访问速度可能不稳定。Deno Deploy 在国内访问更快更稳定，且部署流程更简单。

**Q: 两个平台的功能有区别吗？**
A: 功能完全相同，只是部署方式不同。代码都支持流式响应、密钥轮换、Web 界面等全部特性。

**Q: 可以同时部署到两个平台吗？**
A: 可以的！项目提供了 `worker.js` 内部判断了当前服务器环境，可以同时部署到两个平台。

**Q: 为什么选择一问一答模式？**
A: 简化交互逻辑，降低复杂度，更适合快速问答场景。

**Q: 可以支持多轮对话吗？**
A: 目前暂不支持，每次都是独立的对话。如有需要可以在角色设定中添加上下文。

**Q: 历史记录可以导出吗？**
A: 目前使用 IndexedDB 存储，可以通过浏览器开发者工具查看和导出数据。

**Q: 部署需要付费吗？**
A: Deno Deploy 和 Cloudflare Workers 都有免费额度，一般个人使用完全够用。

**Q: 如何配置多个 API Key？**
A: 在环境变量 `GEMINI_API_KEYS` 中用逗号分隔多个密钥，如 `key1,key2,key3`，系统会自动轮换使用。

**Q: 不配置环境变量可以使用吗？**
A: 可以！如果不配置环境变量，直接在 Web 界面输入您的 API Key 即可正常使用。环境变量主要用于密码共享场景。

**Q: 环境变量和代码配置的优先级？**
A: 环境变量优先级更高。如果设置了环境变量，会优先使用环境变量的值，否则使用代码中双竖线`||`后面的默认值。

**Q: 忘记了共享密码怎么办？**
A: 需要重新编辑代码中的 `SECRET_PASSWORD` 常量并重新部署。

---

如果这个项目对您有帮助，请给个 ⭐ Star！
