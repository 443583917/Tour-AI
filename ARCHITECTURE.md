# Tour-AI 项目功能架构文档

> **最后更新**: 2026-06-06  
> **项目定位**: 基于 AI 大模型的智能旅行规划平台  
> **技术栈**: Next.js 15 + TypeScript + Prisma + MySQL + 阿里千问大模型

---

## 一、项目概述

Tour-AI 是一个面向 C 端用户的智能旅行规划 Web 应用。用户通过三个入口（关键词搜索、地图选点、小红书笔记解析）输入需求，后端调用阿里通义千问大模型生成结构化的每日行程，结合高德地图补充真实景点图片，最终以可视化卡片和交互式地图形式呈现。

### 核心价值

| 能力 | 实现方式 |
|------|----------|
| AI 行程生成 | 千问 qwen-turbo 根据城市+天数+偏好生成 JSON 行程 |
| AI 对话助手 | 千问 qwen-max 流式 SSE 回答旅行相关问题 |
| 小红书攻略解析 | Puppeteer 爬取 + 百度 OCR + 千问 qwen3.5-plus 结构化提取 |
| 地图可视化 | Leaflet 交互式地图，标记点 + 路线连线 |
| 个人数据管理 | 行程收藏、旅行日记 CRUD、个人信息管理 |

---

## 二、技术栈总览

```
┌─────────────────────────────────────────────────────┐
│                    前端层                             │
│  React 19 + Next.js 15 (App Router) + TypeScript    │
│  Tailwind CSS + Framer Motion + Radix UI            │
│  Leaflet / React-Leaflet (地图)                      │
│  Zustand (状态管理) + React Markdown (AI渲染)        │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                    服务层                             │
│  Next.js API Routes (18 routes)                     │
│  NextAuth.js v4 (JWT Session + Credentials)         │
│  Prisma ORM + MySQL (TiDB Cloud)                    │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                 外部服务集成                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ 千问大模型 │ │ 高德地图  │ │ 百度 OCR  │            │
│  │ (3模型)   │ │ (图片搜索) │ │ (图片识别) │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Puppeteer│ │  Resend  │ │ apihz.cn │            │
│  │ (小红书爬)│ │ (邮件发送) │ │ (备用图片) │            │
│  └──────────┘ └──────────┘ └──────────┘            │
└─────────────────────────────────────────────────────┘
```

---

## 三、目录结构

```
Tour-AI/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 根布局 (SessionProvider)
│   ├── AppLayout.tsx             # 应用壳 (Header + Sidebar + Main)
│   ├── metadata.ts               # SEO 元数据
│   ├── page.tsx                  # 首页：城市搜索 + 关键词标签
│   ├── create/page.tsx           # 地图选点规划
│   ├── jg/page.tsx               # 行程结果展示
│   ├── reply/page.tsx            # AI 对话助手
│   ├── xhs/page.tsx              # 小红书笔记解析入口
│   ├── dd/page.tsx               # 笔记解析结果 + 路线地图
│   ├── cc/page.tsx               # 我的收藏（行程 + 笔记）
│   ├── diary/page.tsx            # 旅行日记 CRUD
│   ├── profile/page.tsx          # 个人中心
│   ├── login/page.tsx            # 登录
│   ├── register/page.tsx         # 注册
│   ├── contact/page.tsx          # 联系我们
│   ├── forgot-password/page.tsx  # 忘记密码
│   ├── pricing/page.tsx          # 定价方案
│   ├── store/                    # Zustand 状态管理
│   │   ├── useAuthStore.ts       # 认证状态
│   │   ├── useTourStore.ts       # 行程数据
│   │   └── useXhsStore.ts        # 小红书解析数据
│   └── api/                      # API 路由 (18 routes)
│       ├── auth/[...nextauth]/   # NextAuth 认证
│       ├── chat/                 # AI 对话 (SSE 流式)
│       ├── getTourismGuide/      # 行程生成 (核心)
│       ├── xhs/parse/            # 小红书爬取
│       ├── xhs/analyze/          # 小红书 AI 解析
│       ├── xhs/add/              # 旧版解析 (讯飞)
│       ├── xhs/list/             # 笔记列表
│       ├── xhs/[id]/             # 笔记详情/删除
│       ├── itinerary/list/       # 行程列表
│       ├── itinerary/delete/     # 行程删除
│       ├── diary/                # 旅行日记 CRUD
│       ├── profile/              # 个人信息
│       ├── register/             # 注册 + 验证码
│       ├── verify/               # 邮箱验证
│       ├── forgot-password/      # 忘记密码
│       ├── reset-password/       # 重置密码
│       ├── contact/              # 联系反馈
│       └── image-proxy/          # 图片代理
├── components/                   # UI 组件
│   ├── Header.tsx                # 顶部导航
│   ├── sidebar.tsx               # 侧边栏菜单
│   ├── Map.tsx                   # Leaflet 城市选择地图
│   ├── MapComponent.tsx          # 路线可视化地图
│   ├── PostCard.tsx              # 内容卡片
│   └── ui/                       # shadcn/ui 组件库
│       └── (14 UI components)
├── lib/                          # 共享库
│   ├── auth.ts                   # NextAuth 配置
│   ├── prisma.ts                 # Prisma 客户端单例
│   ├── tidb.ts                   # TiDB 连接池
│   ├── utils.ts                  # 工具函数 (cn)
│   ├── xhsApi.ts                 # 小红书链接解析 + 内容提取
│   ├── xhsSign.ts                # 小红书反爬签名 + Puppeteer
│   └── xhsvm_v2.js              # 浏览器注入的签名 JS
├── prisma/
│   └── schema.prisma             # 数据库模型 (7 models)
├── hooks/                        # 自定义 Hooks
├── type/                         # TypeScript 类型定义
├── middleware.ts                  # 路由保护中间件
├── package.json
└── ARCHITECTURE.md               # 本文档
```

---

## 四、数据库设计 (ER)

```
┌──────────────────────────────────────────────────────┐
│                       User                           │
│  id (UUID PK)  username (unique)  email (unique)     │
│  name?  bio? (Text)  password                       │
└───────┬──────┬──────┬──────┬──────┬─────────────────┘
        │      │      │      │      │
   ┌────▼─┐ ┌──▼──┐ ┌─▼──┐ ┌─▼───┐ ┌─▼──────────┐
   │Account│ │Sess.│ │Itin.│ │XhsN.│ │TravelDiary │
   │       │ │     │ │     │ │     │ │            │
   │userId │ │user │ │user │ │user │ │userId      │
   │type   │ │Id   │ │Id   │ │Id   │ │title       │
   │provide│ │token│ │city │ │title│ │content     │
   │r      │ │     │ │sched│ │body │ │city        │
   │provider│ │expir│ │ule  │ │image│ │date        │
   │Account│ │es   │ │(JSON│ │s    │ │mood        │
   │Id     │ │     │ │)    │ │(JSON│ │images(JSON)│
   └───────┘ └─────┘ └─────┘ │)    │ └────────────┘
                              │ocrTe│
                              │xts? │
                              │jsonB│
                              │ody  │
                              │(JSON│
                              │)    │
                              └─────┘
```

### 模型说明

| 模型 | 用途 | 关键字段 | 限制 |
|------|------|----------|------|
| **User** | 用户账户 | id, username, email, password, bio | 唯一: username, email |
| **Account** | NextAuth OAuth 账户关联 | userId, provider, providerAccountId | @@unique[provider, id] |
| **Session** | NextAuth 会话 | userId, sessionToken, expires | - |
| **VerificationToken** | 邮箱验证令牌 | identifier, token, expires | @@unique[identifier, token] |
| **Itinerary** | AI 生成的行程 | userId, city, schedule(JSON) | 每用户最多 9 条 |
| **XhsNote** | 小红书解析笔记 | userId, title, body, images(JSON), jsonBody(JSON) | 每用户最多 6 条 |
| **TravelDiary** | 用户旅行日记 | userId, title, content, city, date, mood, images(JSON) | 无限制 |

---

## 五、功能架构

### 5.1 功能模块全景图

```
                          ┌──────────────┐
                          │   用户入口    │
                          └──┬───┬───┬──┘
                             │   │   │
        ┌────────────────────┼───┼───┼────────────────────┐
        │                    │   │   │                    │
   ┌────▼─────┐    ┌────────▼───▼───▼────────┐    ┌──────▼──────┐
   │ 景点推荐  │    │      路线规划            │    │  笔记解析    │
   │ (首页 /) │    │    (/create)             │    │  (/xhs)     │
   │          │    │                         │    │             │
   │ 城市输入  │    │ Step1: 地图选城          │    │ 粘贴链接     │
   │ 天数选择  │    │ Step2: 偏好配置          │    │ 自动爬取     │
   │ 关键词标签│    │ (艺术/历史/美食/自然等8项)│    │ OCR识别     │
   │          │    │                         │    │ AI结构化     │
   └────┬─────┘    └──────────┬──────────────┘    └──────┬──────┘
        │                     │                          │
        └─────────────────────┼──────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Qwen 千问大模型   │
                    │  (行程生成/解析)    │
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────▼─────┐  ┌──────▼──────┐  ┌─────▼─────┐
        │ 高德图片增强│  │ 数据库存储   │  │ 结果展示   │
        │ 真实照片   │  │ MySQL/TiDB │  │ /jg /dd   │
        └───────────┘  └─────────────┘  └───────────┘
```

### 5.2 六大功能模块

#### 模块一：景点推荐（AI 生成行程）

| 属性 | 内容 |
|------|------|
| **入口** | 首页 `/` |
| **输入** | 城市名 + 天数(1-3) + 关键词(8选1，可选) |
| **API** | `GET /api/getTourismGuide?city=&days=&keyword=` |
| **AI 模型** | qwen-turbo (非流式) |
| **输出** | JSON: 每日景点数组，每个景点含 9 个字段 |
| **后处理** | 高德地图 API 批量获取真实景点照片 |
| **结果页** | `/jg` — 日卡片 + 图片 + 交通/门票/贴士 |
| **持久化** | `Itinerary` 表，每用户限 9 条 |
| **关键代码** | `app/api/getTourismGuide/route.ts` (463行) |

#### 模块二：路线规划（地图选点）

| 属性 | 内容 |
|------|------|
| **入口** | `/create` |
| **流程** | 两步骤向导 |
| **Step 1** | 全屏 Leaflet 地图 (40+ 中国城市标记点)，可点击选择或搜索 |
| **Step 2** | 偏好配置: 天数 + 8 种兴趣(多选): 艺术/历史/音乐/观光/美食/博物馆/自然/购物 |
| **API** | 与模块一共用 `GET /api/getTourismGuide` |
| **结果** | 跳转 `/jg` |

#### 模块三：AI 对话助手

| 属性 | 内容 |
|------|------|
| **入口** | `/reply` |
| **API** | `POST /api/chat` |
| **AI 模型** | qwen-max (流式 SSE) |
| **System Prompt** | 旅行规划师角色，含景点/行程/住宿/交通/美食五大维度 |
| **限制** | 仅回答旅行问题，非旅行问题礼貌拒绝 |
| **上下文** | 客户端 localStorage 存储对话历史，最多 100 条 |
| **超时** | 120 秒 |
| **关键代码** | `app/api/chat/route.ts` (142行) |

#### 模块四：小红书笔记解析

| 属性 | 内容 |
|------|------|
| **入口** | `/xhs` |
| **流程** | 三步: 爬取 → OCR → AI 解析 |
| **Step 1** | `POST /api/xhs/parse` — Puppeteer 无头浏览器提取标题/正文/图片 |
| **Step 2** | 百度 OCR 识别图片中的文字（智能触发：正文<30字或缺少行程标记） |
| **Step 3** | `POST /api/xhs/analyze` — qwen3.5-plus 将文本解析为结构化行程 JSON |
| **结果页** | `/dd` — 结构化行程 + 交互式地图 (标记点 + polylines 路线) |
| **持久化** | `XhsNote` 表，每用户限 6 条 |
| **反爬** | 自定义签名 (xhsvm_v2.js) + RC4 加密 + Vercel 兼容 (puppeteer-core + chromium-min) |

#### 模块五：我的收藏

| 属性 | 内容 |
|------|------|
| **入口** | `/cc` |
| **数据** | AI 生成的行程列表 + 小红书解析笔记列表 |
| **操作** | 查看详情、删除 |
| **API** | `GET /api/itinerary/list`, `DELETE /api/itinerary/delete`, `GET /api/xhs/list`, `DELETE /api/xhs/[id]` |

#### 模块六：旅行日记

| 属性 | 内容 |
|------|------|
| **入口** | `/diary` |
| **功能** | 完整 CRUD: 创建/编辑/删除旅行日记 |
| **字段** | 标题、内容、城市、日期、心情(mood)、图片 |
| **API** | `GET/POST/PUT/DELETE /api/diary` |
| **数据表** | `TravelDiary` |

---

## 六、AI/LLM 集成架构

### 6.1 模型分工

```
                    ┌─────────────────────────────────┐
                    │   dashscope.aliyuncs.com        │
                    │   /compatible-mode/v1/           │
                    │   chat/completions              │
                    │   (OpenAI 兼容协议)               │
                    └──────────┬──────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
    ┌─────▼─────┐      ┌──────▼──────┐      ┌─────▼─────┐
    │ qwen-turbo│      │  qwen-max   │      │qwen3.5-plus│
    │           │      │             │      │           │
    │ 行程生成   │      │  AI 对话     │      │ 笔记解析   │
    │ 非流式     │      │  流式 SSE    │      │ 非流式     │
    │ temp: 0.7 │      │  temp: 0.7  │      │ temp: 0.3 │
    │ max_tok:   │      │  max_tok:   │      │ max_tok:   │
    │ 1500      │      │  4096       │      │ 2048      │
    └───────────┘      └─────────────┘      └───────────┘
```

### 6.2 Prompt 架构

当前采用 **硬编码内联 Prompt** 策略（3 个 System Prompt，全在 API Route 中）：

| Prompt | 文件位置 | 行号 | 角色设定 |
|--------|---------|------|----------|
| 行程生成 Prompt | `app/api/getTourismGuide/route.ts` | L73-131 | 资深旅行规划师，输出严格 JSON |
| 对话助手 Prompt | `app/api/chat/route.ts` | L29-51 | 全球旅行专家，仅回答旅行问题 |
| 笔记解析 Prompt | `app/api/xhs/analyze/route.ts` | L17-60 | 行程解析助手，处理 OCR 乱码 |

### 6.3 鲁棒性设计

```
AI 返回原始文本
      │
      ├─→ 清理 markdown 代码块 (```json ... ```)
      ├─→ JSON.parse()
      │       │
      │       ├─ 成功 → 返回结构化数据
      │       └─ 失败 ↓
      │
      ├─→ cleanJsonString() 深度清理
      │   (去控制字符、修复尾随逗号、单引号转双引号、补键名引号)
      │       │
      │       ├─ 成功 → 返回
      │       └─ 失败 ↓
      │
      └─→ 正则暴力提取 (name + description)
          兜底构建最小可用 JSON
```

---

## 七、外部 API 集成

| API | 用途 | 调用位置 | 认证方式 |
|-----|------|---------|----------|
| **DashScope** (阿里云) | 千问大模型调用 | chat, getTourismGuide, xhs/analyze | Bearer Token (QWEN_API_KEY) |
| **高德地图** (Amap) | 景点真实图片搜索 | getTourismGuide | API Key (AMAP_API_KEY) |
| **apihz.cn** | 备用图片搜索 | getTourismGuide | ID + Key |
| **百度 OCR** | 小红书图片文字识别 | xhs/parse | OAuth 2.0 (API Key + Secret) |
| **Resend** | 邮件发送 (验证码/反馈/重置密码) | register, verify, contact, forgot/reset-password | API Key |
| **Puppeteer** | 无头浏览器爬取小红书 | xhs/parse (via xhsSign.ts) | Cookie (XHS_COOKIE) |

---

## 八、认证与安全

### 8.1 认证流程

```
用户注册
  │  POST /api/register → 生成 6 位 hex 验证码
  │  → 存入 VerificationToken 表
  │  → Resend 发送验证邮件
  │
用户验证
  │  POST /api/verify → 校验 token
  │  → bcrypt 哈希密码 → 创建 User
  │
用户登录
  │  POST /api/auth/[...nextauth]
  │  → CredentialsProvider → bcrypt.compare()
  │  → JWT 签发 (24h 有效期)
  │  → httpOnly Cookie (next-auth.session-token)
  │
后续请求
  │  middleware.ts → getToken() 验证 JWT
  │  → 受保护路由: /, /create, /cc, /reply, /jg, /xhs
  │  → 未登录重定向 /login
```

### 8.2 安全措施

- 密码: bcryptjs 哈希存储
- 会话: JWT + httpOnly Cookie (secure in production, sameSite: lax)
- 数据隔离: 所有数据操作通过 `userId` 做所有权校验
- 用量限制: 行程 9 条限制, 笔记 6 条限制

---

## 九、状态管理与数据流

### 9.1 Zustand Stores

```
useAuthStore             useTourStore            useXhsStore
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│ isLoggedIn   │        │ tourismGuide │        │ data: any    │
│ user: {      │        │ {            │        └──────────────┘
│   id,        │        │   city,      │
│   name,      │        │   schedule:  │        localStorage
│   email      │        │     DayPlan[]│        ┌──────────────┐
│ }            │        │ }            │        │ auth-token   │
│              │        │              │        │searchHistory │
│ localStorage │        │ city: string │        │travelMessages│
│ auth-token   │        └──────────────┘        └──────────────┘
└──────────────┘
```

### 9.2 核心数据流

```
用户输入 (城市+天数+关键词)
    │
    ▼
前端 Zustand Store → 调用 API
    │
    ▼
API Route → 校验 Auth → 校验配额 → 调用 Qwen
    │
    ├─→ Qwen 返回行程 JSON
    ├─→ 高德 API 获取图片 (并发批量, 内存缓存)
    ├─→ Prisma 存入 MySQL
    └─→ 返回 { id, city, schedule }
    │
    ▼
前端 Store 更新 → 路由跳转 → 页面渲染
    │
    ├─ /jg: 日卡片 + 图片 + 元数据
    └─ /dd: 结构化行程 + 交互地图
```

---

## 十、缓存策略

| 缓存项 | 类型 | 位置 | 生命周期 |
|--------|------|------|----------|
| 景点图片 URL | 内存 Map | `getTourismGuide/route.ts` | 进程生命周期 |
| 百度 OCR Token | 内存变量 + 过期时间 | `xhs/parse/route.ts` | Token 过期前 10 分钟 |
| 地理编码坐标 | 内存对象 | `dd/page.tsx` (客户端) | 页面生命周期 |
| 图片代理 | HTTP Cache | `image-proxy/route.ts` | 1 年 (max-age=31536000) |
| 搜索历史 | localStorage | `page.tsx` | 永久 (手动清除) |
| 对话历史 | localStorage | `reply/page.tsx` | 永久 (手动清除) |
| LLM 响应 | **无缓存** | - | - |
| Prompt 结果 | **无缓存** | - | - |

---

## 十一、当前缺失与优化方向

### 11.1 AI 工程化成熟度评估

```
能力维度            当前状态        成熟度
────────────────────────────────────────
LLM 调用            ✅ 3模型分工     ████████░ 80%
Prompt 管理         ❌ 硬编码内联    ██░░░░░░░ 20%
对话记忆            ❌ 仅 localStorage █░░░░░░░░ 10%
用户偏好            ❌ 无个性化      ░░░░░░░░░  0%
RAG 检索增强        ❌ 无向量检索    ░░░░░░░░░  0%
LLM 响应缓存        ❌ 无缓存        ░░░░░░░░░  0%
Token 预算管理      ❌ 仅硬截断      █░░░░░░░░ 10%
错误恢复            ✅ 多层兜底解析  ██████░░░ 65%
流式处理            ✅ SSE 实现      ████████░ 80%
```

### 11.2 建议优化路线图

| 优先级 | 优化项 | 价值 | 复杂度 |
|--------|--------|------|--------|
| **P0** | 对话历史入库 (Conversations/Messages 表) | 跨设备不丢上下文 | 中 |
| **P0** | 用户偏好建模 (旅行风格/预算/节奏) | 个性化推荐基础 | 中 |
| **P1** | LLM 响应缓存 (相同参数命中缓存) | 降延迟、省费用 | 低 |
| **P1** | Prompt 模板外置化 | 可维护、可迭代 | 低 |
| **P2** | 对话摘要压缩 (长对话防爆上下文) | 长会话质量 | 中 |
| **P2** | RAG 知识库 (攻略/游记向量检索) | 增强知识覆盖面 | 高 |
| **P3** | Token 计数 + 动态预算管理 | 精确上下文控制 | 中 |

---

## 十二、部署架构

```
┌─────────────────────────────────────────┐
│                  Vercel                 │
│  ┌───────────────────────────────────┐  │
│  │        Next.js 15 Server          │  │
│  │  (API Routes + SSR + Edge)        │  │
│  └───────────────┬───────────────────┘  │
│                  │                       │
│  ┌───────────────▼───────────────────┐  │
│  │    Serverless Functions           │  │
│  │    - Puppeteer (小红书爬取)        │  │
│  │    - 千问 API 调用                 │  │
│  │    - 高德/百度 API 调用             │  │
│  └───────────────┬───────────────────┘  │
└──────────────────┼──────────────────────┘
                   │
     ┌─────────────┼─────────────┐
     │             │             │
┌────▼────┐  ┌────▼────┐  ┌─────▼─────┐
│ TiDB    │  │ 千问    │  │ 高德/百度  │
│ Cloud   │  │DashScope│  │ OCR       │
│ (MySQL) │  │         │  │           │
└─────────┘  └─────────┘  └───────────┘
```

- **前端托管**: Vercel (Edge Network)
- **服务端**: Vercel Serverless Functions
- **数据库**: TiDB Cloud (MySQL 兼容)
- **Puppeteer**: Vercel 环境下使用 `@sparticuz/chromium`，本地使用完整 Chrome

---

## 十三、环境变量清单

| 变量 | 用途 |
|------|------|
| `DATABASE_URL` | MySQL 连接串 |
| `NEXTAUTH_SECRET` | JWT 签名密钥 |
| `QWEN_API_KEY` | 阿里千问 API Key |
| `AMAP_API_KEY` | 高德地图 API Key |
| `IMAGE_API_ID` / `IMAGE_API_KEY` | 备用图片搜索 API 凭证 |
| `RESEND_API_KEY` | 邮件发送 API Key |
| `XHS_COOKIE` | 小红书 Cookie (爬取用) |
| `BAIDU_OCR_API_KEY` / `BAIDU_OCR_SECRET_KEY` | 百度 OCR 凭证 |
| `TIDB_HOST/PORT/USER/PASSWORD/DATABASE` | TiDB 连接信息 |
| `IFLYTEK_API_KEY` / `IFLYTEK_API_SECRET` | 讯飞星火 (已引用但未实际调用) |
| `VERCEL` | 部署环境检测 (影响 Puppeteer 配置) |

---

> 本文档基于代码库实际分析生成，反映 `main` 分支 `04b8729` 提交时的项目状态。
