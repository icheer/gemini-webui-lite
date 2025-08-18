# Gemini WebUI Lite - 自部署的 Gemini AI 代理服务

[![Deploy to Deno Deploy](https://img.shields.io/badge/Deploy%20to-Deno%20Deploy-00ADD8?style=flat-square&logo=deno)](https://dash.deno.com/)
[![Deploy to Cloudflare Workers](https://img.shields.io/badge/Deploy%20to-Cloudflare%20Workers-orange?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](#license)
[![Gemini API](https://img.shields.io/badge/Powered%20by-Gemini%20API-4285F4?style=flat-square&logo=google)](https://ai.google.dev/)

一个简单易用的 Deno Deploy / Cloudflare Worker 程序，让您能够快速部署自己的 Gemini AI 代理服务。只需要一个域名和 Gemini API Key，即可免费为家人朋友提供 AI 问答服务。

> 🎯 **推荐使用 Deno Deploy 部署**  
> 由于国内访问 Cloudflare Workers 大概率优先匹配到 HK 节点，访问可能不稳定，强烈推荐使用 **Deno Deploy** 部署本服务！

请合理使用 AI 资源，避免滥用！

## ✨ 特性

- 🚀 **一键部署** - 基于 Deno Deploy / Cloudflare Workers，免费且快速
- 🔐 **密码保护** - 支持共享密码，保护您的 API Key
- 🎯 **演示模式** - 支持临时演示密码，带有调用次数限制
- 💬 **实时对话** - 流式响应，支持打字机效果
- 📱 **响应式设计** - 完美适配桌面端和移动端
- 💾 **本地存储** - 基于 IndexedDB 的持久化历史记录
- 🎨 **极简界面** - 养老版 Gemini Chat，简洁易用
- 🌐 **多模型支持** - 支持 Gemini 2.5 Pro/Flash 等多个模型
- 📸 **分享问答** - 一键生成问答截图，方便社交分享
- 🏷️ **智能命名** - 根据问答内容自动生成会话标题，便于查找管理

## 🎯 功能说明

### 核心功能

- **代理服务**: 提供标准的 Gemini API 代理端点
- **Web 界面**: 内置精美的聊天界面
- **密码机制**: 可设置共享密码，避免直接暴露 API Key
- **流式响应**: 实时显示 AI 回答，提升用户体验

### 使用特点

- 支持两轮问答模式：每个会话可以进行一次追问
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

> ⚡ 推荐使用 Deno Deploy，访问 Gemini 更稳定。

1. **Fork 项目到您的 GitHub**

   - 将项目代码上传到您的 GitHub 仓库

2. **部署到 Deno Deploy**

   - 访问 [Deno Deploy](https://dash.deno.com/)
   - 使用 GitHub 账号登录
   - 点击 "New Project"
   - 选择您的 GitHub 仓库
   - 设置入口文件为 `worker.js`
   - 点击 "Deploy"

3. **配置环境变量（可选但推荐）**

   - 在 Deno Deploy 项目设置中添加环境变量：
     - `SECRET_PASSWORD`: 共享密码
     - `GEMINI_API_KEYS`: API Key 列表（逗号分隔）
     - `DEMO_PASSWORD`: 临时演示密码（可选）
     - `DEMO_MAX_TIMES_PER_HOUR`: 演示密码每小时调用次数限制（可选，默认 15 次）
   - 环境变量优先级高于代码中的硬编码值

4. **绑定自定义域名（可选，推荐）**

   - 在项目设置中点击 "Domains"
   - 添加您的自定义域名
   - 按照提示配置 DNS 记录
   - Deno Deploy 会自动提供 SSL 证书

5. **测试部署**
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

   - 更推荐以环境变量方式配置以上 2 个参数

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
5. **追问功能**: 在第一个问题得到回答后，可以继续追问一次
6. **智能命名**: 系统会根据问答内容自动生成会话标题，便于管理查找
7. **分享问答**: 点击右上角"分享问答"按钮，生成问答截图
8. **查看历史**: 左侧会自动保存历史会话

### 支持的模型

- `gemini-2.5-pro` - 最新的 Pro 模型
- `gemini-2.5-flash-preview-05-20` - Flash 预览版
- `gemini-2.5-flash-lite-preview-06-17` - Flash-Lite 预览版

## ⚙️ 配置说明

### 环境变量配置（推荐）

项目支持通过环境变量进行配置，这样更安全且便于管理：

**主要环境变量：**

- `SECRET_PASSWORD`: 共享密码，用于正常无限制访问
- `GEMINI_API_KEYS`: API Key 列表，多个用逗号分隔
- `DEMO_PASSWORD`: 临时演示密码，有调用次数限制
- `DEMO_MAX_TIMES_PER_HOUR`: 演示密码每小时最大调用次数（默认 15 次）

**Deno Deploy 环境变量设置：**

1. 在项目设置页面找到 "Environment Variables"
2. 添加以下环境变量：
   - `SECRET_PASSWORD`: 共享密码，如 `mypassword123`
   - `GEMINI_API_KEYS`: API Key 列表，多个用逗号分隔，如 `Key1,Key2,Key3`
   - `DEMO_PASSWORD`: 演示密码，如 `demo123`（可选）
   - `DEMO_MAX_TIMES_PER_HOUR`: 如 `10`（可选，默认 15）

**Cloudflare Workers 环境变量设置：**

1. 在 Worker 设置中找到 "Variables"
2. 添加环境变量（同上）

### 代码配置（备选）

如果不想使用环境变量，也可以直接在 `worker.js` 中修改：

```javascript
// ⚠️ 注意: 当您fork项目并且仓库为公开时，请务必谨慎操作，以免您包含Gemini密钥的Commit被暴露在公网，造成Key泄露的情况
// ⚠️ 注意: 仅当您有密码共享需求时才需要配置这些变量
// 否则无需配置，默认会使用 WebUI 填写的 API Key 进行 Gemini 请求

// 共享密码 - 您和朋友约定的密码
const SECRET_PASSWORD = 'your-shared-password';

// Gemini API Key 列表 - 多个用逗号分隔，支持自动轮换，不建议这样明文写在代码里，谨防Key泄露！
const GEMINI_API_KEYS = 'Key1,Key2,Key3';

// 临时演示密码 - 有调用次数限制
const DEMO_PASSWORD = 'demo123';

// 演示密码每小时最大调用次数
const DEMO_MAX_TIMES_PER_HOUR = 15;
```

### 配置优先级

1. **环境变量** > **代码硬编码值**
2. 如果都未配置，将使用默认值：
   - `SECRET_PASSWORD`: 随机生成（如 `yijiaren.123`）
   - `GEMINI_API_KEYS`: 示例密钥（需要替换）
   - `DEMO_PASSWORD`: 默认为空（不开启演示模式）
   - `DEMO_MAX_TIMES_PER_HOUR`: 默认为 `15`

### 使用说明

**无需配置的情况：**

- 如果您只是想个人使用，无需配置任何环境变量
- 直接在 Web 界面输入您的 API Key 即可正常使用

**需要配置的情况：**

- 想要分享给朋友使用，避免暴露真实 API Key
- 希望配置多个 API Key 实现负载均衡
- 需要统一管理 API Key
- 需要提供临时演示访问，限制调用次数

### 密码类型说明

**正式密码 (`SECRET_PASSWORD`)：**

- 无调用次数限制
- 适合长期使用
- 建议设置强密码

**演示密码 (`DEMO_PASSWORD`)：**

- 有调用次数限制（默认 15 次/小时）
- 适合临时演示和测试
- 超出限制后需要等待下一小时重置
- 可通过 `DEMO_MAX_TIMES_PER_HOUR` 调整限制

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
- 便捷分享功能：
  - **微信浏览器**: 显示图片弹窗，支持长按保存/转发
  - **其他浏览器**: 自动下载截图文件

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

**Q: 为什么推荐 Deno Deploy 而不是 Cloudflare Workers？**<br>
_A: 国内访问 Cloudflare Workers 大概率匹配到香港节点，来自香港的请求会被 Gemini 拒绝。Deno Deploy 仅在海外有节点，不存在此问题。_

**Q: 两个平台的功能有区别吗？**<br>
_A: 功能完全相同，只是部署方式不同。代码都支持流式响应、密钥轮换、Web 界面等全部特性。_

**Q: 可以同时部署到两个平台吗？**<br>
_A: 可以的！`worker.js` 内部判断了当前服务器环境，可以同时部署到两个平台。_

**Q: 为什么选择两轮问答模式？**<br>
_A: 在保持简洁的基础上，支持一次追问能够满足大多数场景需求，避免过于复杂的多轮对话造成不可控的额外开销。 当对话因误解而偏离轨道时，最佳解决方案是回到对话历史中，编辑导致偏差的那条用户提示词，而不是试图用后续的修正指令来亡羊补牢。_

**Q: 可以支持更多轮对话吗？**<br>
_A: 目前限制为两轮（一问一答+一次追问），这样设计是为了保持界面简洁和交互清晰。如需更复杂对话，建议在角色设定中添加上下文。_

**Q: 会话标题是如何生成的？**<br>
_A: 当您首次在会话中提问并得到回答后，系统会根据问题和回答的内容自动生成一个简洁的标题，方便您后续查找和管理会话。_

**Q: 分享功能在哪些环境下可用？**<br>
_A: 所有现代浏览器都支持。微信浏览器会显示图片弹窗供长按保存，其他浏览器会自动下载 PNG 文件。_

**Q: 历史记录可以导出吗？**<br>
_A: 目前使用 IndexedDB 存储，可以通过浏览器开发者工具查看和导出数据。_

**Q: 部署需要付费吗？**<br>
_A: Deno Deploy 和 Cloudflare Workers 都有免费额度，一般个人使用完全够用。_

**Q: 如何配置多个 API Key？**<br>
_A: 在环境变量 `GEMINI_API_KEYS` 中用逗号分隔多个密钥，如 `key1,key2,key3`，系统会自动轮换使用。_

**Q: 不配置环境变量可以使用吗？**<br>
_A: 可以！如果不配置环境变量，直接在 Web 界面输入您的 API Key 即可正常使用。环境变量主要用于密码共享场景。_

**Q: 环境变量和代码配置的优先级？**<br>
_A: 环境变量优先级更高。如果设置了环境变量，会优先使用环境变量的值，否则使用代码中双竖线`||`后面的默认值。_

**Q: 忘记了共享密码怎么办？**<br>
_A: 查看您部署时配置的环境变量，或查看代码中的 `SECRET_PASSWORD` 常量。_

**Q: 演示密码和正式密码有什么区别？**<br>
_A: 演示密码 (`DEMO_PASSWORD`) 有调用次数限制，默认每小时最多 15 次，适合临时演示；正式密码 (`SECRET_PASSWORD`) 无限制，适合长期使用。_

**Q: 演示密码的调用次数用完了怎么办？**<br>
_A: 需要等待下一个小时重置，或者使用正式密码继续访问。管理员可以通过 `DEMO_MAX_TIMES_PER_HOUR` 环境变量调整限制次数。_

---

如果这个项目对您有帮助，请给个 ⭐ Star！
