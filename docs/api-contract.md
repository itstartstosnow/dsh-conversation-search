# 内部契约（Host API / 索引语义 / Client 分片）

本文件是 `dsh-conversation-search` 实现期的事实契约。实现方按此对齐，不要在代码里各自发明形状。

## 1. 包与文件布局

```
dsh-conversation-search/
  package.json            # bundle manifest（Lead 已写）
  cordis.patch.yml        # 单行 insert（Lead 已写）
  index.js                # Host 入口：export inject / apply（impl-host）
  lib/search-core.js      # 纯 Node 检索核心（recon-host）
  lib/host/*.js           # Host 服务、路由、访问控制（impl-host）
  client.js               # 构建产物：node build-client.mjs 生成（Lead 负责）
  client/src/10-shared.js # 共享运行时：DCS 命名空间（Lead 已写）
  client/src/20-search-panel.js  # 左侧栏搜索面板（impl-sidebar）
  client/src/30-find-bar.js      # 对话内浮动查找条 + 跳转引擎（impl-findbar）
  client/src/90-apply.js  # 工厂 apply()（Lead 已写）
  build-client.mjs        # 把 client/src/*.js 按文件名字典序拼成 client.js（Lead 已写）
  locale/{zh,en}.json     # 插件展示元数据（Lead 已写）
  icon.svg                # 插件图标（Lead 已写）
  tests/                  # node:test（impl-host / recon-host）
```

构建产物 `client.js` 是**单文件**：Client module 系统只服务一个 `./client` 导出，factory 内 `require` 只能取平台模块表（`react`、`react/jsx-runtime` 等基线）；**禁止**相对 import、禁止 import 任何 `@deepseek-ai/*`。

## 2. Host HTTP API

Host 用 `ctx.webServer.register({ kind:'exact', path, handler })` 注册路由；client 用 **document-relative** URL 访问（GUI 使用 `<base href="./">`）：

```js
fetch('api/dsh-conversation-search/search?...')   // 注意没有前导斜杠
```

统一响应信封：成功 `{ ok: true, ... }`；失败 `{ ok: false, error: { code, message } }` + 合适的 HTTP 状态码。client 的 `DCS.api` 已按此实现（失败会抛 `DcsApiError{code,message,status}`）。

访问控制：只允许 loopback（`127.0.0.1` / `::1` / `::ffff:127.0.0.1`），其它来源 403。

### GET /api/dsh-conversation-search/status

```json
{
  "ok": true,
  "ready": true,
  "building": false,
  "sessions": 34,
  "entries": 5231,
  "chars": 60696630,
  "updatedAt": 1793250325264,
  "progress": null,
  "cacheDir": "/Users/example/.dsh/cache/dsh-conversation-search",
  "error": null
}
```

- `ready`：首次建索引已完成（即使个别文件失败）。
- `building`：正在构建/重建；此时 `progress = { done, total }`。
- `error`：`{ code, message } | null`，描述上次构建的部分失败（例如个别文件解码失败），供面板提示。

### POST /api/dsh-conversation-search/rebuild

开始全量重建（异步）。已在校验/构建中时幂等返回。

```json
{ "ok": true, "started": true }
```

### GET /api/dsh-conversation-search/search

query：`q`（必填，非空）、`caseSensitive`（`1`/`0`）、`wholeWord`（`1`/`0`）、`limit`（会话条数上限，默认 20）、`kinds`（搜索范围，逗号分隔的条目类型；缺省 `user,assistant`；候选 `user|assistant|tool|thinking`）、`includeSubagents`（`1`/`0`，默认 `0`）。

```json
{
  "ok": true,
  "query": { "text": "全家桶", "caseSensitive": false, "wholeWord": false, "kinds": ["user", "assistant"], "includeSubagents": false },
  "tookMs": 14,
  "totalSessions": 3,
  "truncated": false,
  "results": [
    {
      "sessionId": "session-00000000-0000-4000-8000-000000000001",
      "title": "示例会话标题",
      "cwd": "/Users/example/projects/demo",
      "createdAt": 1793250325262,
      "updatedAt": 1793250325264,
      "hitCount": 4,
      "hitsTruncated": false,
      "hits": [
        {
          "seq": 123,
          "anchorSeq": 123,
          "turn": 3,
          "kind": "assistant",
          "surface": "current",
          "time": 1793250325264,
          "snippet": "…上下文 全家桶 上下文…",
          "matchStart": 8,
          "matchLength": 3
        }
      ]
    }
  ]
}
```

- `results` 按「本会话内最新命中时间」倒序；每个 session 的 `hits` 按 `seq` 升序，最多 50 条，`hitCount` 是全部命中数，`hitsTruncated` 表示是否被截断。
- `truncated` = 命中的会话总数超过 `limit`（面板据此提示缩小关键词）。
- `kinds` 是条目类型过滤（用户 / 助手 / 工具 / 思考 复选框）：在计数、会话排序与截断**之前**生效；缺省为 `user,assistant`（面板默认只搜用户提问 + 助手回复）；显式空范围或未知类型 → HTTP 400 `{ code:'bad-kinds' }`（不静默返回空结果）。
- `includeSubagents` 默认 `0`：**subagent 子会话默认不参与搜索**（`header.parentSession` 非空或 `header.origin === 'subagent'`）。这类会话无法用 `uiWorkspace.openSession(id)` 打开为主视图，命中后跳转会显示旧会话/定位失败，因此默认从 `results/totalSessions/hits/truncated` 中完全排除；传 `1` 可显式包含（未来选项）。非法值按默认 `0` 处理。子会话的条目仍然在索引里，`/session`、`/message` 仍可按 id 命中（见下）。
- `kind` ∈ `user | assistant | tool | thinking`。`thinking` 是 assistant 消息的 `reasoning` 块（见 §3），与它所属 assistant 条目共享 `seq/turn/anchorSeq`。
- 索引未 ready：HTTP 503 + `{ ok:false, error:{ code:'indexing', message } }`。
- `q` 去空白后为空：HTTP 400 + `{ ok:false, error:{ code:'empty-query' } }`。

### GET /api/dsh-conversation-search/session

query：`sessionId`、`q`、`caseSensitive`、`wholeWord`、`kinds`（同上；缺省 `user,assistant`）、`includeSubagents`（`1`/`0`，**默认 `1`**）。返回单个会话的全部命中（上限 500 条），供跳转后预填查找条：

```json
{ "ok": true, "sessionId": "...", "title": "...", "hitCount": 27, "hitsTruncated": false, "hits": [ /* 同上 hit 形状 */ ] }
```

- `/session` 是**显式 id 查询**（查找条补 snippet），因此默认包含 subagent 子会话；传 `includeSubagents=0` 可与 `/search` 默认范围保持一致。
- 未知 session：HTTP 404 `{ ok:false, error:{ code:'unknown-session' } }`；非法 `kinds`：HTTP 400 `{ ok:false, error:{ code:'bad-kinds' } }`。

### GET /api/dsh-conversation-search/message

query：`sessionId`、`seq`。校验某条命中是否仍存在于索引/会话历史：

```json
{ "ok": true, "found": true, "sessionId": "...", "seq": 123, "turn": 3, "kind": "assistant", "time": 1793250325264, "text": "完整规范化文本" }
```

- 不存在：`200 { ok:true, found:false, sessionId, seq }`（这是正常结果，不是错误）。
- 未知 session：HTTP 404。
- 同一 `seq` 可能对应两条索引记录：`assistant`（消息正文）与 `thinking`（其 reasoning）。`/message` 返回**主记录**：assistant 条目（若该 assistant 消息只有 reasoning 没有正文，则返回 thinking 条目）。

## 3. 索引语义（Host）

数据源：`$DSH_HOME/sessions/<workspaceDir>/<sessionId>/session.v4.jsonl.zstd`（`$DSH_HOME` 默认 `~/.dsh`，环境变量可覆盖）。**只读**，绝不修改。

- 解码：**必须逐帧解码**。\n  - 文件是 zstd 帧串接；Node 26 的 `zlib.zstdDecompressSync(buffer)` 会继续解后续帧，但 **Node 24（Electron 44 的 Host 运行时）解完第一帧就返回成功**，一次性解码会静默丢掉后续所有事件（真机事故：索引只剩首批事件）。\n  - 正确做法（`lib/search-core.js` 已实现）：先 `scanZstdFrames(buffer)` 扫帧表；仅当「≤1 个完整帧且无撕裂尾」时走 one-shot 快路径，否则逐帧 `zstdDecompressSync(buffer.subarray(start,end))` 拼文本；撕裂尾用 `finishFlush: ZSTD_e_flush` 抢救完整行。\n  - 文件损坏/截断：跳过该文件并计入 `status.error`，不影响其它会话。
- 首行为 header：`{ type:'session', version:4, id, createdAt, cwd, isSeeded, delegationDepth, agentPreset }`。
- 索引版本：`INDEX_VERSION = 3`（v2：逐帧解码修复；v3：assistant 的 reasoning 改为独立 `thinking` 条目）。版本号同时是缓存文件名的一部分，旧版本缓存自动失效并由 Host 清理。
- 文本条目只取 **append-origin surface 事件**（`surfaceOp === 'append'`）与 **log-only 的 `tool/call`**；条目类型集合 `ENTRY_KINDS = ['user','assistant','tool','thinking']`：
  - `user/message` → `kind: 'user'`，文本 = `data.content` 中 `text` block 拼接；默认仅 `data.source.kind === 'user'`（排除 `compact-checkpoint` 等内部注入）。
  - `assistant/message` → 最多两条条目：
    - `kind: 'assistant'`，文本 = `data.message.content` 中 `text` block 拼接（**排除 reasoning / tool-call**，与官方 `extractSessionEventText` 一致）；
    - `kind: 'thinking'`，文本 = `data.message.content` 中 `reasoning` block 拼接（normalizeText 后）。reasoning 归属该 assistant 消息：两条条目共享 `seq / time / turn / surface / anchorSeq`，跳转落到同一条消息所在 turn；面板把「思考」作为独立搜索范围。
  - `tool/result` → `kind: 'tool'`，文本 = `data.message.content` 中 `text` block 拼接 + `data.error?.name/code`（若有）。
  - `tool/call`（log-only，无 surfaceOp）→ `kind: 'tool'`，文本 = `data.name + data.arguments`。
  - `system/message` / `developer/message` **不入索引**（不是人类 transcript）。
  - replacement 拷贝（`surfaceOp !== 'append'`）本身不入索引；被其 shadow 的原始 append 行仍保留入索引并标 `surface:'shadowed'`（见下"surface 三态"）。
- **surface 三态**（每条 index 记录都带）：
  - `current`：当前人类 transcript，可定位（`anchorSeq = seq`）。
  - `log-only`：仅日志事件（`tool/call`），渲染锚点取其后最近的 current surface seq（`anchorSeq`）。
  - `shadowed`：被压缩/裁剪替换掉的原始行，仍在日志里但 GUI 不再渲染该文本；**可被搜到**，点击时应提示"该条已不在当前会话历史中"（requirements §4.2），不回溯。
- `turn`：事件之前最近一次 `turn/start` 的 `data.turn`；事件自带 `data.turn` 时以自带为准（1 起）。
- `time`：事件 `time`。
- 文本规范化 `normalizeText`：统一换行（`\r\n?`→`\n`）、折叠空白、trim。与 `client/src/10-shared.js` 中 `dcsNormalizeText` **必须逐字一致**（注意：recon-host 的 `search-core.js` 是权威实现，client 侧共享函数以它为准，必要时以 search-core 为准调整 10-shared）。
- 标题：`session/title` 事件（取 seq 最大者）的 `data.title`；没有则用首条 `user/message` 文本截前 40 字；再没有用「未命名会话」。
- `updatedAt`：该会话所有事件 `time` 的最大值（无则文件 mtime）。`createdAt` 取 header。
- `sessionId`：header `id`，缺失时用目录名去掉 `session-` 前缀。
- **subagent 子会话**：header 带 `parentSession`（父会话 id）或 `origin:'subagent'`，目录名是裸 uuid。它们**仍完整入索引**（体积/条目不变，`status.sessions` 也计入），但默认不参与 `/search`：这些会话无法用 `uiWorkspace.openSession(id)` 打开为主视图，命中后跳转会显示旧会话/定位失败。过滤发生在搜索层（`searchIndex({includeSubagents:false})` 默认），不影响 `/session`、`/message` 按 id 取数据。
- 搜索：对规范化文本做**子串扫描**（requirements §7），不建倒排索引、不依赖 sqlite。大小写不敏感 = 两侧 `toLocaleLowerCase()`；全词 = 命中两侧不是 `[\p{L}\p{N}_]`（或字符串边界）。查询可用 `kinds` 收窄条目类型（默认 `user,assistant`）；过滤先于命中计数/排序/截断；`includeSubagents` 默认关闭（见上）。
- 命中位置 `matchStart/matchLength` 是相对 `snippet` 的坐标（snippet 两侧各 60 字符，超出加 `…`）。
- 内存索引：全部条目的规范化文本驻留内存（当前语料 ~60M 字符，可接受）；缓存目录 `$DSH_HOME/cache/dsh-conversation-search/`：
  - 单文件 `index.v<INDEX_VERSION>.json`（当前 `INDEX_VERSION = 3`；原子写：同目录 `wx` 临时文件 → write → fsync → rename，0600）：`{ version, builtAt, sessions:{ [sessionId]: { file, size, mtimeMs, meta:{sessionId,title,cwd,createdAt,updatedAt,…}, entries:[{sessionId,seq,turn,kind,time,text,surface,anchorSeq,…}], chars, issues } } }`。
  - 增量：按每会话 `mtimeMs + size` 判定，未变化复用缓存记录，变化才解码；已删除会话剔除。
  - 损坏 / 版本或形状不符 → 视为缓存未命中并全量重建；启动时清理插件目录下旧版本的 `index.v*.json`（只动插件自有目录）。
  - 索引绝不写入 `sessions/`，也不依赖官方 `session-query-sqlite`。
- 后台刷新：Host 侧定时（默认 15s，可用 Config 调整）扫描 sessions 根目录，发现变化后增量更新；`/search` 时若距上次扫描超过 5s 也先触发一次扫描（避免"刚发的消息搜不到"）。
- 性能目标：首建 ≤ 5s（当前语料）、单次两字中文查询 ≤ 100ms。

## 4. Client 分片契约

`client/src/10-shared.js` 定义全局 `DCS`（同 factory 作用域内的 `const`，后续分片直接引用）：

| 成员 | 说明 |
| --- | --- |
| `DCS.NS` | locale namespace `'conversation-search'` |
| `DCS.LIMIT` / `DCS.SNIPPET_RADIUS` | 20 / 60 |
| `DCS.t(key, params)` | 已绑定 locale 的翻译函数（apply 中绑定） |
| `DCS.zh` / `DCS.en` | 字典；分片可 `Object.assign` 追加自己的 key（key 前缀区分） |
| `DCS.api` | `status/search/sessionHits/message/rebuild`，参数见上；失败抛 `DcsApiError` |
| `DCS.dom` | `flowCandidates() flowRoot() scrollRoot() rows() rowsForTurn(turn) isRendered() textNodes(root) rowOf(node) findAnchorByNeedle(needle) landRow(row) rowInPort(row) scrollRowIntoView(row) flashRow(row) conversationBox() isEditable(target) focus(el)`。`flowRoot()` 按**绘制面积**选可见会话的 transcript：GUI 会保留多个已加载会话的 view（隐藏、0 尺寸），DOM 顺序里第一个不一定是当前会话；`conversationBox()` 优先用 `[data-conversation-scroll]`（`conversation.view` slot wrapper 和 chat flow 都可能是 0 尺寸）。 |
| `DCS.sessions` | `currentSessionId(ctx) binding(ctx,id) waitForMainView(ctx,id,{timeoutMs,signal}) loadedWindow(ctx,id) loadThrough(ctx,id,seq) open(ctx,id)` |
| `DCS.createStore/useStore` | 极小 store + React hook |
| `DCS.normalizeText/collapseText/findMatches/foldCase/snippet` | 文本工具（`findMatches` 返回 `{start,length}[]`，支持 caseSensitive/wholeWord） |
| `DCS.injectStyles()` | 注入本插件样式表（apply 已调用） |
| `DCS.handlers` | 分片间回调：`jumpToHit(hit)`、`openFindBar(query,options)`、`toast({text,tone})`（由 find-bar 分片发布） |
| `DCS.log` | 带插件前缀的 console 包装 |
| `DCS.ctx` | apply 时注入的 client context |

跨分片约定：

- 面板分片点击结果 → `DCS.handlers.jumpToHit?.({ sessionId, seq, turn, kind, title, query, caseSensitive, wholeWord })`。
- 查找条分片负责实现 `jumpToHit`、`openFindBar`、`toast`，并在挂载时写入 `DCS.handlers`。
- 分片各自在 `DCS.startSearchPanel(ctx)` / `DCS.startFindBar(ctx)` 里注册 slot（`ctx.slots.inject` + `ctx.slots.register`），用 `ctx.effect` 清理监听器/观察器。
- 样式只允许 `--dsw-*` 主题 token；禁止写死颜色（`color-mix(... , transparent)` 与 token 结合可以）。样式字符串放各自分片的 `<style>` 注入或 `DCS_STYLES` 之外的局部 `<style>` React 元素。
- 所有用户可见文案走 `t()`；需要新 key 时在分片内 `Object.assign(DCS.zh, {...})` / `Object.assign(DCS.en, {...})`（key 加前缀，如 `panel.x` / `find.x`）。
- 禁止 import 任何 `@deepseek-ai/*`，禁止替换 app root，禁止向 `document.body` 追加节点。

## 5. 跳转语义（requirements §4）

1. 命中若 `surface === 'shadowed'`：直接提示 `t('find.notFound')`（该条已被压缩/裁剪，GUI 不再渲染其文本），不打开、不回溯。
2. 若目标会话不是当前主视图：`DCS.sessions.open(ctx, sessionId)`，再 `await DCS.sessions.waitForMainView(ctx, sessionId)`，再等一帧让 chat flow 挂载。
3. 若当前主面板不是会话（例如正在看侧栏搜索面板），先 `ctx.layout.selectPanel(null)` 回到会话；否则即使是同一会话的跳转也不会挂载 transcript，巡逻会超时。\n4. 打开查找条：`DCS.handlers.openFindBar(query, { caseSensitive, wholeWord })`，状态显示"正在定位"。
4. 读 `DCS.sessions.loadedWindow(ctx, id)`：回溯目标用 `hit.anchorSeq ?? hit.seq`（log-only 的 `tool/call` 渲染在 `anchorSeq` 那条 surface 消息上）；若 `baseSeq > 目标 seq` 且 `hasMore`，调用 `DCS.sessions.loadThrough(ctx, id, 目标 seq)`；期间每 ~150ms 读一次 `baseSeq` 更新进度文案（已回溯到第 N 条）；允许用户取消（取消后不滚动、不高亮、保留原位置；后台加载继续但不再影响 UI）。
5. 定位（巡逻-驻留模型，见下）：
   - 先用 `hit.snippet`（去掉匹配标记）做 needle，`DCS.dom.normalizeForMatch` 归一化后两侧比对；优先 `hit.turn` 的行，其次 `DCS.dom.findAnchorByNeedle(needle)`；
   - 每 tick（~350ms）重找 + 用 `DCS.dom.landRow` 补滚（**绝不 scrollIntoView**：宿主打开会话后会贴底/滚动恢复，一次性滚动会被覆盖）；
   - 行在其滚动窗口内稳定驻留 ~900ms 后 `DCS.dom.flashRow(row)` 并结束；
   - 用户手动滚动（wheel/touchstart/keydown/pointerdown）或点击取消时立即收手。
6. 设置查找条当前命中：重新扫描文本，选中落在该行内的第一个匹配；若 DOM 中没有（渲染文本与索引文本不同），保留行高亮并在计数上显示已加载范围内的匹配。
7. 找不到行：`DCS.toast(t('find.notFound'), 'error')`（要求 §4.2：不报错、不空白）。加载失败：`t('find.failed', {message})`。
8. 定位总超时 8–15s；超时按"找不到"处理并收手，绝不无限循环。
