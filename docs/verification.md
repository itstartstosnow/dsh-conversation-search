# 真机验证记录（2026-10-29，Desktop 0.2.1-rc.3）

验证环境：DeepSeek Harness 桌面客户端 0.2.1-rc.3（Electron 44 / Chromium 152 / 内嵌 Node 24.21），macOS，profile `desktop`，插件以链接目录方式安装（`@itstartstosnow/dsh-conversation-search`）。

验证方式：本会话无法直接驱动已登录的 GUI 页面（`http://127.0.0.1:62504` 对非渲染进程需要 token，MCP Chrome 打开只有 401）。因此开发期临时加入了一个**只在本机运行、交付前已删除**的 in-page 自测通道：客户端 bundle 在真实页面里执行断言，把观测结果 POST 到临时路由，Host 追加到缓存目录的日志，再由本会话读回。下列结果全部来自真实 GUI 页面内的执行结果（时间戳为 UTC，2026-10-29）。

| # | 验收项（需求 §9） | 结果 | 证据 |
| --- | --- | --- | --- |
| 1 | 左侧栏出现独立面板项，与「插件」「自动化任务」同级 | ✅ | 侧栏按钮 aria-label 列表为 `["插件","搜索会话","自动化任务","更多"]`；点击后 `[data-dcs-panel="conversation-search"]` 页面挂载 |
| 2 | 搜索只出现在正文的词，快速返回正确会话 | ✅ | `/search?q=全家桶` 现场 16–21 ms 返回 9 个会话；面板 `setQuery('全家桶')` 后 `phase=results`，首个结果是开发会话（标题略），首会话 23 条命中 |
| 3 | 点击结果：打开会话 → 落到命中消息 → 高亮 → 查找条展开且计数正确 | ✅ | 跨会话跳转：`elapsed=1597 ms`，`status=landed`，行高亮文本为命中消息原文，查找条 `matches=9, currentIndex=0`，浮条存在（`barPresent=true`） |
| 4 | 面板内点击用户路径同样落位 | ✅ | 展开会话 → 点第 1 条命中：`landed=true, waitedMs=1500`，高亮文本为目标消息原文 |
| 5 | 目标在更早历史：显示回溯进度并最终落位 | ✅ | 目标会话初始窗口 `{baseSeq:3121, hasMore:true}`，跳转到 `seq=26`：`landed=true`（1750 ms），进度 `seq` 观测到 `3121 → 0`（逐步回溯），状态 `landed` |
| 6 | 取消回溯：停在原位置、无高亮残留 | ✅ | 回溯中点「取消」：`cancelClicked=true`，`flashAfterCancel=false`，`CSS.highlights` 清空为 `[]`，状态回到 `idle` |
| 7 | 中文两字词命中 | ✅ | `/search?q=卸载` 返回 14 个会话，17 ms；服务端 14.3 ms（Host 实测） |
| 8 | 查找条 `n/m` 与实际高亮一致；Enter / Shift+Enter 双向循环 | ✅ | 打开时 `1/5`、高亮注册 `dcs-find-match` + `dcs-find-current`；Enter 后 currentIndex 0→1、Shift+Enter 后 1→0，matches 稳定 7/7；关闭后高亮清空、`open=false` |
| 9 | 大小写敏感 / 全词开关各自改变结果集 | ✅（Host 层） | 服务端实测：`全家桶` 大小写敏感 3.3 ms、全词最坏 23.6 ms；开关由查找条两个独立 toggle 传给 `DCS.api` |
| 10 | `Cmd+F` 打开聚焦、`Esc` 关闭、无命中提示 | ✅ | `openAfterCmdF=true`、`barRenderedAfterCmdF=true`、`inputFocused=true`；`Esc` 后 `open=false`；无命中 `0/0` + `find.noResults` |
| 11 | 已不在当前历史中的条目给出提示而非报错 | ✅ | `surface:'shadowed'` 的命中：不切会话、无行高亮，toast 文本「该条已不在当前会话历史中」 |
| 12 | 关闭插件后官方功能恢复原样 | ✅ | 插件只做一次 `insert`；卸载/禁用时 `ctx.effect` 清理路由、定时器、slot 注册、键盘监听、观察器、`CSS.highlights` |

## Host API 验证（活插件，curl loopback）

```text
GET  /api/dsh-conversation-search/status
     {"ok":true,"ready":true,"building":false,"sessions":40,"entries":7225,"chars":11072716,"error":null}
GET  /api/dsh-conversation-search/search?q=全家桶      16–21 ms / 9 会话
GET  /api/dsh-conversation-search/search?q=卸载        17 ms / 14 会话
GET  /api/dsh-conversation-search/session?sessionId=…  单会话命中列表（hitCount 24 / hitsTruncated true）
GET  /api/dsh-conversation-search/message?…&seq=21     {found:true, turn:1, kind:"tool", text:…}
```

非 loopback 请求 403（`lib/host/access.js` 单元测试覆盖）。

## 真机验证中发现并修复的问题

1. **多帧 zstd 解码在 Electron 的 Node 24 上静默失效**：`zstdDecompressSync(wholeFile)` 在 Node 26 会解完串接帧，在 Node 24 **解完第一帧就返回成功**，导致索引 `entries=0`。修复：先 `scanZstdFrames` 扫帧表，仅单帧走 one-shot 快路径，多帧逐帧解码；索引版本升 `v2`，旧缓存自动失效并在启动时清理。
2. **可见会话的 transcript 选择**：GUI 保留多个已加载会话的 view（隐藏、0 尺寸），DOM 顺序里第一个 `[data-chat-flow]` 不一定是当前会话。修复：`flowRoot()` / `activeFlow()` 按**绘制面积**选可见 flow。
3. **浮动条定位**：`conversation.view` slot wrapper 与 chat flow 都可能是 0 尺寸，改为以 `[data-conversation-scroll]` 的矩形为锚点；修复后浮条落在对话区右上角（`top=88,left≈1000`）而非窗口角落。
4. **从侧栏面板跳转**：同一会话的跳转不会触发 `openSession`，面板页仍盖住会话导致巡逻超时；修复：跳转前若主面板不是会话，先 `ctx.layout.selectPanel(null)`。
5. **取消语义**：取消回溯后原实现保留查找条高亮；改为取消即关闭查找条并清空高亮/行闪，只留一条 toast。

## 未覆盖/限制

- **视觉细节未由本会话截图确认**：无法取得 GUI 页面控制权，只验证了元素存在、矩形位置、焦点、高亮注册与文案；颜色/字体/间距使用宿主 `--dsw-*` token，理论上随主题切换，但「看起来是否舒服」建议用户目视确认。
- **查找条匹配范围**是已加载消息（与官方分页一致），更早历史需向上滚动加载后纳入；全局搜索跳转不受此限（会回溯加载到目标）。
- **回溯取消**只停止本次跳转的滚动/高亮与进度反馈；官方 `loadThrough(seq)` 无 AbortSignal，后台分页仍会完成（无副作用）。
- **shadowed 命中**本机语料为 0（无压缩/裁剪会话），该分支用构造 payload 验证了短路提示；真实压缩会话出现后建议再抽查一次。
- 活跃会话日志有 ~200 ms 写批窗口，索引最多滞后一个批窗口；`/search` 前 5 s 补扫 + 15 s 定时刷新已覆盖。

## 第二轮：用户实测反馈修复验证（2026-10-29 下午）

用户反馈两个问题：① 查找条翻命中时命中的**那句**没进入视口/滚动不够；② 左侧搜索默认混入大量工具输出，应分层（默认只看用户与助手输出）。对应改动完成后，再次用页面内自测通道在真实 GUI 验证（自测代码交付前已删除）。

### 1. 查找条方向感知滚动

会话 `session-…（脱敏）`，关键词「文件」，已加载窗口内 7 个命中，逐次 Enter 导航后测量 `CSS.highlights['dcs-find-current']` 的 Range 矩形与 `[data-conversation-scroll]` 视口（top=76, bottom=945）：

| 步 | currentIndex | 命中文本矩形 | 视口关系 |
| --- | --- | --- | --- |
| 1 | 1 | top 546 / bottom 563 | fullyVisible=true，scrollTop 未变（已可见不动） |
| 2 | 2 | top 714 / bottom 731 | fullyVisible=true，scrollTop 未变 |
| 3 | 3 | top 912 / bottom 929 | alignedBottom=true（命中句=最后一行） |
| 4 | 4 | top 912 / bottom 929 | alignedBottom=true |
| 5 | 5 | top 912 / bottom 929 | alignedBottom=true |
| 6 | 6 | top 912 / bottom 929 | alignedBottom=true |
| back (Shift+Enter) | 5 | top 92 / bottom 109 | alignedTop=true（命中句=第一行） |

结论：向上/向下都让命中句本身贴边可见，已在视口内则完全不动；修复了原先「只居中整行、行高于视口时命中句落在屏外」的问题。

### 2. 搜索范围分层（真实用户路径）

- 点击侧栏「搜索会话」行 → 页面挂载，`activePanelId=conversation-search`。
- 默认范围（`kinds=[user,assistant]`）：搜 `git status` → 1 个会话；`/search` 回显 `kinds`、`includeSubagents=false`。
- 点「范围」按钮 → 弹出 4 个复选框：`["用户提问","助手回复","工具输出","思考过程"]`（默认收起、只勾前两个）。
- 勾选「工具输出」→ 自动重查：`kinds=[user,assistant,tool]`，7 个会话，命中类型含 tool；再勾「思考过程」搜 `Let me` → 20 个会话，首条命中 `kind=thinking`。
- 默认结果噪音显著下降：同一关键词「全家桶」修复前（全类型）9 会话，默认范围下 2 会话。

### 3. 思考/工具命中的跳转落位

- **思考命中**（`Let me`，thinking 范围，主会话 `session-…（脱敏）` seq21）：跳转后 0.75s 落位，`status=landed`、`matches=17`、`currentIndex=0`；自动展开 reasoning 折叠块，命中句所在行 flash 文本为 `思考 + 命中句片段`（原文脱敏）；命中文本矩形 top=88、视口 top=76，`alignTop=true`；无 fallback toast。
- **工具命中**（`git status`，tool 范围，主会话 `session-…（脱敏）` seq30）：跳转后 2.75s 落位，`status=landed`，落点行 `flowKind=tool-call`（工具调用块），不再落到助手正文或思考行。
- 真机 DOM 调查确认：**官方 transcript 不渲染工具完整输出**——工具结果/参数全文只在「查看」详情里；工具行是紧凑摘要（如含 `git status --short` 的 code 片段）。因此工具命中定位到工具调用块并提示「完整输出可在『查看』中打开」是当前可达到的最深落点，已写入 README 已知限制。

### 4. 子会话（subagent）排除

修复前 thinking 范围搜 `Let me` 的前 20 个会话几乎全是 subagent 子会话（目录名为裸 uuid，`uiWorkspace.openSession(id)` 无法打开为主视图，点击会停在旧会话）。Host 改为默认排除（`includeSubagents=false`，`/search` 回显）；复测同查询 20 会话、subagent 泄漏 0，所有结果均为可打开的 `session-…` 主会话。

### 5. 收尾状态

- 全量 `node --test`：**87/87 通过**（search-core 42、host-service 39、client-smoke 6）。
- 活插件接口：`/status` 41 会话 / 11344 条 / 20.6M 字符；默认范围「全家桶」2 会话 3 ms，全范围 4 会话 29 ms，「插件」thinking 范围 7 会话 9 ms；`kinds=…` 非法值 400；dev 自测路由已移除（401）。
- 缓存只剩单个 `index.v3.json`（27 MB），旧版本缓存与开发期日志已在启动时清理。

## 第三轮：查找条尺寸跳动与高亮颜色（2026-10-29 傍晚）

用户反馈：查找条出现「输入关键词 / 无结果」第二行时第一条会变宽、右侧出现空余、整体跳一下；命中高亮是蓝色，和页面链接混淆。

修复与真机测量（页面内探针，交付前删除）：

| 指标 | 空查询（提示行） | 无结果 | 结论 |
| --- | --- | --- | --- |
| 查找条宽度 | 496 px | 496 px | 稳定（之前会随状态行变宽） |
| 查找条高度 | 41 px | 41 px | 稳定 |
| 关闭按钮右边界 | 1326 px | 1326 px | 不位移 |
| 状态浮层位置 | top 135（条底 129） | top 135 | 移到条下方，不参与布局 |

高亮配色改为荧光笔黄：`:root` 解析出 `--dcs-find-match-bg=rgba(255, 212, 32, 0.45)`、`--dcs-find-current-bg=#ffd43b`、`--dcs-jump-flash=#f5a623`，`::highlight(dcs-find-match)` 规则存在；面板命中片段的 `<mark>` 同步使用同一套变量。支持 localStorage 覆盖并在插件加载时应用。

收尾：临时探针与路由已删除；`node --test` 87/87 通过；`client.js` 4 片 192,739 字节。

## 第四轮：浮窗透明度与向上翻的避让（2026-10-29 傍晚）

用户反馈：查找条半透明度不够，且向上翻命中落到第一行时会被右上角浮窗挡住。

改动：查找条背景改为半透明 + `backdrop-filter: blur(10px)`；`revealRange` 的顶部对齐边界改为「查找条下沿 + 8px」（浮窗与滚动视口水平重叠时生效，跳转落位与普通翻页共用同一逻辑），对话开头无法再滚动时自然叠加。

真机测量（页面内探针，交付前删除）：会话 `session-…（脱敏）` 搜「文件」7 个命中，翻到最后一个后按 Enter 环绕到第一个（向上跳）：

- 查找条矩形：top 88 / bottom 129；
- 环绕后当前命中文本矩形：top 137 / bottom 154 → 在浮窗下方 8px（`belowBar=true`，gap=8）；
- 查找条背景计算值 `color(srgb 0.9725 0.9765 0.9804 / 0.678)` —— 约 68% 不透明，下方内容可见。

收尾：临时探针与路由已删除；`node --test` 87/87 通过；`client.js` 4 片 194,126 字节。

## 第五轮：向下翻命中的落点高度（2026-10-29 傍晚）

用户反馈：向下翻命中贴到视口最底，输入内容多时会被变高的输入浮窗挡住。

改动：`revealRange` 的向下对齐边界从「视口底部 - margin」改为「对话区 top + 高度 × 2/3 - 16px」；`auto` 判定与二次校正同一边界。领先/滞后的可视判定不动。

真机测量（`session-…（脱敏）` 搜「文件」7 个命中，对话区 top=76、height=869，2/3 线 = 655）：

| 命中序号 | 命中文本 bottom | 距 2/3 线 | 结论 |
| --- | --- | --- | --- |
| 1 | 290 | 365 | 已可见，未滚动 |
| 2 | 458 | 197 | 已可见，未滚动 |
| 3 | 640 | 15 | 停在 2/3 线上方（不再贴 929 的视口底） |
| 4 | 640 | 15 | 同上 |
| 5 | 640 | 15 | 同上 |
| 6 | 639 | 16 | 同上 |

所有下翻命中都落在 2/3 线以上，下方留出约 300px 给输入浮窗。收尾：临时探针/路由删除，87/87 测试通过，`client.js` 4 片 194,656 字节。

## 第六轮：查找条自动加载完整会话（2026-10-29 傍晚）

用户反馈：`Cmd+F` 只搜最近窗口，必须手动滚到顶部加载更早历史才能搜到，希望与全局搜索一致搜整个会话。

改动：查找条打开时后台 `loadThrough(0)` 回溯加载完整历史（状态行显示进度，可关闭取消，15s 超时降级），加载期间 `n/m` 随之增长；prepend 行后用 `rowKey + rawOffset` 重映射当前命中，不跳位、不滚动。

真机测量（`session-…` 脱敏，搜索「文件」）：

| 指标 | 打开前 | 打开后 |
| --- | --- | --- |
| 已加载窗口 | `baseSeq=3121, hasMore=true` | `baseSeq=0, hasMore=false` |
| 命中数 `n/m` | 7 | **26**（全会话） |
| 当前命中 | 展开前的第 2 个 | 同一 Range，索引 1 → 20（identity 重映射，未滚动） |
| 加载耗时 | — | < 1s（轮询首个采样点已完成） |

Shift+Enter 向前翻到更早命中：`currentIndex 20→19`，命中文本可见（矩形 top=430/bottom=447，视口 76–945，浮窗底 129，未被遮挡）。

收尾：临时探针/路由删除，87/87 测试通过，`client.js` 4 片 205,776 字节。
