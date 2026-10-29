# Host 半边实现说明（索引服务 + HTTP 路由）

对应任务：`task-3`（Host 索引/路由）、`task-6`（thinking 索引 + `kinds` 范围过滤）、`task-8`（默认排除 subagent 子会话命中）。契约以 `docs/api-contract.md` §2/§3 为准；本文件只记录实现结构、取舍与实测数据。

## 模块

| 文件 | 职责 |
| --- | --- |
| `index.js` | Host 入口：`export const inject = ['webServer']`、`export function apply(ctx)`。创建服务、注册路由、后台首建、`ctx.effect` 内定时增量扫描；`apply` 不等索引。 |
| `lib/host/paths.js` | `$DSH_HOME` / sessions 根 / cache 根解析，索引文件路径，目录创建，原子写工具，旧版本缓存清理（`pruneStaleCacheFiles`）。 |
| `lib/host/access.js` | loopback 围栏：`127/8`、`::1`、`::ffff:127/8`，其余 403。 |
| `lib/host/service.js` | `SearchService`：加载/首建/增量/重建、status、search/sessionHits/message、`kinds` 范围、subagent 默认排除、缓存落盘。纯 Node，可脱离 Cordis 测试。 |
| `lib/host/routes.js` | 5 条 `kind:'exact'` 路由 + 统一信封 + `kinds`/`includeSubagents` 参数解析 + 错误码映射；不依赖 Cordis，可单测。 |
| `tests/host-service.test.mjs` | 39 条 `node:test`；临时 `DSH_HOME` + 现场构造的多帧 zstd 日志，不写真实 `~/.dsh`。 |

所有解码、事件投影（含 thinking）、规范化、匹配、snippet、缓存文档序列化均来自 `lib/search-core.js`；Host 层没有第二份实现。

## 常量（不导出 `Config`：纯 JS 无法 import schemastery）

`service.js` 导出并使用的默认值：

| 常量 | 值 |
| --- | --- |
| `DEFAULT_REFRESH_INTERVAL_MS` | 15000 |
| `DEFAULT_STALE_MS` | 5000 |
| `DEFAULT_SESSION_LIMIT` | 20 |
| `DEFAULT_HITS_PER_SESSION` | 50 |
| `DEFAULT_SESSION_HITS_CAP` | 500 |
| `DEFAULT_KINDS` | `['user', 'assistant']`（面板默认只搜用户提问 + 助手回复） |
| `CACHE_VERSION`（`paths.js`） | 3（= search-core `INDEX_VERSION`，缓存文件名 `index.v3.json`） |

## 生命周期

- `start()`：后台执行首次加载，返回“首建完成”的 promise；`apply` 只 `void start()`。顺序：先 `pruneStaleCacheFiles` 清理旧版本缓存，再读 `index.v3.json` → 命中则 `updateIndex`（mtime+size 增量）走 warm 路径；否则逐文件全量解码（cold）。完成后 `ready=true`。
- 首建/重建使用 `discoverSessionFiles` + `indexOneSession` 逐文件执行，每文件后 `setImmediate` 让出事件循环。这样 `/status` 真的能观察到 `building/progress`，宿主也不会被一次性同步构建卡住；逐步复用 search-core 的单文件入口，没有复制解码/投影逻辑。
- `refresh()`：增量扫描（`updateIndex`），只有 `mtimeMs+size` 变化的文件重解析；并发调用合并为一次，`_chain` 串行化所有构建/扫描。
- 重建 `rebuild()`：忽略缓存全量重扫，构建完成后整体替换内存索引（失败保留旧索引）；构建中幂等。
- `/search`（和触发它的 `_ensureFresh`）：距上次扫描超过 `staleMs`（5 s）先扫描再回答，保证“刚发的消息”能搜到。
- `stop()`：中止在途构建、等待链收敛、清空状态；`apply` 的 disposer 里调用。

## HTTP

`ctx.webServer.register({kind:'exact', path, handler})`，路径前缀 `/api/dsh-conversation-search`：

| 路由 | 说明 |
| --- | --- |
| `GET /status` | `{ok:true, ready, building, sessions, entries, chars, updatedAt, progress, cacheDir, error}`。`progress={done,total}` 仅构建中；`error` 只在有**不可恢复**的逐文件失败时非 null（撕裂尾/坏行属可恢复，只进 `lastScan`，不打扰面板）。 |
| `POST /rebuild` | `{ok:true, started:true}`，异步重建。 |
| `GET /search` | `q/caseSensitive/wholeWord/limit/kinds/includeSubagents`；`{ok:true, query, tookMs, totalSessions, truncated, results}`；未 ready → 503 `indexing`；空 q → 400 `empty-query`；非法/空 `kinds` → 400 `bad-kinds`。`includeSubagents` 默认 `0`。 |
| `GET /session` | `sessionId/q/.../kinds/includeSubagents`；单会话全部命中（≤500）；未知会话 404 `unknown-session`；非法 `kinds` 400 `bad-kinds`。`includeSubagents` 默认 `1`（显式 id 查询）。 |
| `GET /message` | `sessionId/seq`；命中返回 `{found:true,...,text}`，未命中 200 `{found:false,...}`；未知会话 404。同一 seq 的 assistant/thinking 记录返回主记录（assistant）。 |

hit 形状是契约字段：`{seq, anchorSeq, turn, kind, surface, time, snippet, matchStart, matchLength}`，`kind ∈ user|assistant|tool|thinking`。`anchorSeq` 按 surface 三态：`current` 取自身 `seq`；`log-only`（`tool/call`）取其后最近的 current surface `seq`；`shadowed` 一律 `null`（client 据此提示“该条已不在当前会话历史中”，不回溯）。

`kinds` 范围：Host 层把 `kinds=user,assistant,...` 解析成数组交给 `search-core.searchIndex`，过滤发生在命中计数/排序/截断之前；缺省用 `DEFAULT_KINDS`（`user,assistant`）；未知类型、非数组、显式空范围都抛 `HostSearchError{code:'bad-kinds'}` → HTTP 400。`thinking` 条目与其 assistant 消息共享 `seq/turn/anchorSeq`，默认不在面板范围里。

subagent 子会话：`search-core.isSubagentSession(meta)` 判 `parentSession` 非空或 `origin==='subagent'`；`/search` 默认排除（`includeSubagents:false`，过滤先于计数/排序/截断），`/session` 作为显式 id 查询默认包含。索引本身保留这些会话（`status.sessions` 计入），逐文件增量/缓存不受影响；`/message` 同样可按 id 命中。

所有响应 `cache-control: no-store`；非 loopback 请求 403。桌面 Electron 的渲染层 fetch 由主进程转发到本机 Host HTTP 端口（源码 `desktop-main.js` 的 `forwardWebRequest`），socket 地址也是 loopback，围栏成立。

## 缓存（有意偏离契约 §3 的布局）

按 Lead 决定（2026-10-29）改用**单文件**版本化缓存 `$DSH_HOME/cache/dsh-conversation-search/index.v<INDEX_VERSION>.json`（当前 `index.v3.json`）：

- `writeIndexFile`：同目录 `wx` 临时文件 → write → fsync → rename（0600/0700），损坏可重建；
- 内容就是 search-core 的索引文档（`{version,builtAt,sessions:{id:{file,size,mtimeMs,meta,entries,chars,issues}}}`）；
- 增量判据仍是每会话 `size+mtimeMs`，未变化直接复用内存/缓存记录；变更文件重解析；删除会话删除记录；
- 契约整改前的 `manifest.json + sessions/<id>.json` 方案在 `search-core` 里也有实现，本服务**不混用**。理由：单文件代码路径少、原子性一眼可证，实测 14.4 MB / 写 ≈50 ms / 读 ≈25–60 ms。
- **启动清理**（`paths.pruneStaleCacheFiles`）：删除同目录下**旧版本**的 `index.v*.json` 与开发期遗留的 `selftest.log`；不属于本插件的文件一律不动，失败只记 debug。

标题回退（契约 §3）在 Host 层补齐：`session/title`（取 seq 最大）→ 首条 current 用户消息文本折叠空白后前 40 个码点 → `未命名会话`。该回退值随索引落盘；真实标题事件出现后（文件变化）自然覆盖。

## 与契约/Lead 决策的偏差

1. **缓存单文件**：见上，Lead 已批准。
2. **首建/重建不直接调 `buildIndex`**：改为 `discoverSessionFiles + indexOneSession` 的逐文件异步循环（每文件让出事件循环），否则同步 0.5 s 构建期间 `/status` 无法返回 `progress`，也不满足“不阻塞宿主”。单文件解码/投影仍然 100% 复用 search-core。
3. **`status.error` 只报不可恢复失败**：`torn-tail`、`bad-jsonl` 是活跃会话的正常现象（写批窗口/崩溃尾），不抬成面板错误，避免常驻警告；它们记录在 `lastScan.issueCodes`。
4. **排序沿用 `search-core.searchIndex`**：按“会话内最新命中时间”倒序（契约 §2 原文），同时满足 Lead “用 searchIndex 结果” 的要求。
5. **`tool/call` 入索引**（`kind:'tool'`、`surface:'log-only'`、`anchorSeq` 指向其后 surface 节点），`assistant` 正文只取 `text` 块、`user/message` 只取 `source.kind==='user'`：均按更新后的契约 §3 / Lead 纠正执行，search-core 默认值即为该语义。
6. **`search.totalSessions` 是本次返回的会话数**（`searchIndex` 语义，`truncated` 表示还有更多）；面板按该值显示计数。
7. **多帧 zstd 一律逐帧解码**（2026-10-29 真机验证发现）：Node 26 的 `zstdDecompressSync` 会继续解串接帧，但 **Node 24（Electron 44 的 Host 运行时）解完第一帧就返回成功**，导致索引只剩首批事件、`entries=0` 类故障。`search-core.decodeSessionArtifact` 现在先扫帧表，仅单帧文件走 one-shot 快路径，多帧文件逐帧解码；索引版本因此升到 `v2`，旧缓存自动失效重建。
8. **`kinds` 默认值由 Host 决定**（task-6）：`search-core.searchIndex` 不传 `kinds` 时保持“不过滤”的通用语义；`SearchService.search/sessionHits` 才把缺省值补成 `DEFAULT_KINDS = ['user','assistant']`。这样核心函数对其它调用方无行为突变，面板默认范围在服务层统一。
9. **显式空 `kinds` 视为 `bad-kinds`**：`kinds=`（客户端漏传值）返回 400 而不是“0 结果”，避免把客户端 bug 伪装成“无命中”。

## task-6 变更记录（thinking 索引 + kinds 范围，2026-10-29）

- `lib/search-core.js`
  - `ENTRY_KINDS = ['user','assistant','tool','thinking']`；`INDEX_VERSION = 3`。
  - `extractEventTexts(event)` 新增：`assistant/message` 最多产出两条 entry——`assistant`（仅 `text` 块，与官方 `extractSessionEventText` 一致）+ `thinking`（仅 `reasoning` 块），两者共享 `seq/time/turn/surface/anchorSeq`；`extractEventText` 保留为“主条目”投影（assistant 优先，纯 reasoning 消息返回 thinking）。`includeReasoning: false` 恢复旧行为（不产 thinking）。
  - `reasoningText(content)` 导出，负责 reasoning 块的 `\n` 拼接。
  - `searchIndex(..., { kinds })`：在计数/排序/截断前按 `entry.kind` 过滤；未传不过滤。
  - 缓存：`kindToEventType('thinking') → 'assistant/message'`，thinking 条目可无损往返。
- `lib/host/service.js`：`DEFAULT_KINDS`、`normalizeKinds`（校验→`bad-kinds`）、search/sessionHits 传 `kinds` 并在 `/search` 的 `query` 回显生效范围。
- `lib/host/routes.js`：`/search`、`/session` 解析 `kinds=a,b` 参数；`bad-kinds` → HTTP 400。
- 旧 `index.v2.json` 缓存因版本号不符自动失效并全量重建；`paths.pruneStaleCacheFiles` 在启动时删除旧版本文件（新增测试覆盖）。
- 测试：search-core 41 条、host-service 37 条；新增 thinking 抽取/纯 reasoning 消息/kinds 过滤/默认范围/非法范围 400/旧缓存失效用例。

## task-8 变更记录（默认排除 subagent 子会话，2026-10-29）

真机验收：thinking 范围搜索「Let me」时前 20 个会话全是 subagent 子会话（`header.parentSession` / `origin:'subagent'`，目录名裸 uuid）。这些会话无法 `uiWorkspace.openSession(id)` 打开为主视图，点击跳转会显示旧会话并导致定位失败。此前已确认通用 `[aria-expanded=false]` 展开方案本身可行，跳转失败主因是落到了不可打开的会话。

- `lib/search-core.js`：新增导出 `isSubagentSession(meta)`（`parentSession` 非空或 `origin==='subagent'`）；`searchIndex(..., { includeSubagents = false })` 在会话循环最前面跳过 subagent 子会话，过滤先于计数/排序/截断（不影响 `entries`、`getEntry`、缓存与增量，索引体积不缩）。
- `lib/host/service.js`：`search()` 透传 `includeSubagents`（默认 false，`/search` 的 `query` 回显该开关）；`sessionHits()` 透传但**默认 true**——它只按显式 sessionId 查询（查找条补 snippet），"不能作为主视图打开"不影响按 id 取命中；需要与 /search 范围一致时可显式传 false。
- `lib/host/routes.js`：`/search` 解析 `includeSubagents=1/0`（缺省/非法 → false）；`/session` 缺省/非法 → true，`=0` 可排除。
- 测试：新增 search-core 子会话过滤（parentSession / origin 两种标记、includeSubagents 开关、条目仍可按 id 取）与 host-service 子会话用例（默认排除 / 显式包含 / 路由参数 / /session 默认包含 / /message 可用）；`apply` 路由断言改为"五条契约路由都在"以兼容开发期 selftest 路由。
- 实测（真实语料 41 会话）：默认搜索不再返回 subagent 子会话（本机约 8+ 个），点击命中均可作为主视图打开；索引与 `status.sessions` 仍含全部会话。

## 实测（真实语料，只读）

环境：macOS，Node v26.10.0，`~/.dsh/sessions` 全量 **41 个会话**（task-6 复测时点；会话在持续增长，故与 task-3 的 37 会话数字不可直接横比）。由于本会话的文件沙箱只允许写工作区/临时目录，实测缓存目录用 `/tmp/dcs-perf-cache`（只影响缓存位置，不影响索引/查询）。

索引构成（41 会话）：`user` 350 条 / 0.10 M 字符，`assistant` 449 条 / 0.55 M，`thinking` 2,720 条 / 7.08 M，`tool` 7,105 条 / 11.57 M，合计 10,624 entry / 19.3 M 字符。

| 指标 | 实测 |
| --- | --- |
| 冷启动（首建，含缓存落盘） | **1.39 s**（解码+抽取 1.14 s；仍远低于 ≤5 s） |
| 索引文件 | 25.4 MB；常驻 heap 增量 ≈68 MB（19.3 M 字符正文 + 匹配用折叠文本缓存），rss ≈244 MB |
| 默认范围查询「全家桶」（user+assistant） | **2.3 ms** 中位（4 会话 / 33 命中） |
| 默认范围查询「卸载」（两字） | **2.1 ms** 中位（6 会话 / 25 命中） |
| 默认范围查询「插件」 | 1.9 ms 中位（13 会话 / 168 命中） |
| 全范围查询（4 种 kind） | 30–36 ms 中位（最坏一档，仍 ≤100 ms） |
| 仅 thinking 查询 | 13–17 ms 中位 |
| 仅 tool 查询 | 15–17 ms 中位 |
| 无变化增量扫描 | **1.6 ms**（41/41 复用） |
| 单文件变化的增量（含重写 25.4 MB 缓存） | **≈186 ms**（重解析 1 个文件 ≈34 ms，其余为同步落盘） |
| 热启动（读 25.4 MB 缓存 + 增量） | **334 ms** |
| `/session` / `/message` | 0.1 ms 量级 |

冷启动 ≤5 s、单次两字中文查询 ≤100 ms 两项目标均满足。默认范围查询之所以比全范围快一个数量级：`searchIndex` 在算匹配文本之前先按 `kinds` 过滤，tool/thinking 这类大文本条目在默认面板范围里根本不参与扫描。

## 已知限制/风险

- **id-less header**：契约要求 `sessionId` 缺失时用目录名去 `session-` 前缀。冷建/重建已支持（`_indexArtifact` 兜底）；但增量刷新走 `updateIndex`，这类文件一旦**变化**会记 `no-session-id` 失败并保留旧记录（真实语料 header 必有 id，属防御性分支）。
- **活会话 ≤200 ms 批窗口**：索引滞后于内存事件最多一个写批窗口；`/search` 的 5 s 扫描兜底覆盖“刚发的消息”，未做 `ctx.sessions` live 叠加。
- **缓存陈旧判据**只认 `mtimeMs+size`；同大小且 mtime 未变的原地改写不会被发现（官方日志只追加，不会发生）。
- **索引体积/落盘成本随 thinking 增长**：thinking 文本占本机索引字符的 37%（7.08 M）。单文件缓存 25 MB，任何会话变化都会在 refresh 链里同步重写一次（≈150 ms，每 15 s 至多一次；无变化仅 1.6 ms）。如需进一步降抖动，可在服务层加“持久化节流/异步写”，本任务未做（属性能优化，非需求）。
- **跨进程并发**无写锁：两个 Host 进程共用同一 `$DSH_HOME` 时缓存可能互相覆盖；单用户桌面场景可接受（索引可重建）。
- **Electron 桌面路由可达性**依赖主进程把 `dsh-app://` 请求转发到 loopback HTTP（源码已确认）；若将来改成直接内部 dispatch，本插件路由需改用 `ctx.connection.fetch.register`。
- **Host 运行时是 Electron 的 Node**：本机 Desktop 0.2.1-rc.3 实为 Node 24.21（不是 CLI 的 Node 26）。任何只写 Node 26 才有的 API 的行为都必须在 Electron 运行时复核；本次多帧解码问题即由此暴露。
