# dsh-conversation-search 开发文档

> 面向使用者的说明、截图、安装与配置见 [README.md](../README.md)。本文保留实现细节、索引语义、验收数据与维护方式。

DeepSeek Harness Web GUI 的会话全文搜索插件：**左侧栏全局搜索 + 点击直达命中消息 + 对话内浮动查找条**。

与官方左侧标题搜索并存，不接管、不修改官方搜索框，也不依赖官方 `session-query-sqlite`（该后端默认关闭，热改其配置会导致宿主会话控制器不可用）。

## 功能

### 左侧栏「搜索会话」面板

- 入口：左侧栏全局面板项，与「插件」「自动化任务」同级（在「插件」之后）。
- 输入即搜（250ms 防抖，Enter 立即搜索），新输入立即中止上一次未完成查询。
- **搜索范围**（搜索框右侧「范围」按钮，默认收起）：四个复选框——用户提问、助手回复、工具输出、思考过程；默认只勾「用户提问 + 助手回复」，也就是对话里一眼能看到的正文。勾选工具/思考后立即重查（索引不重建）。
- 结果按会话聚合：会话标题、最后更新时间、命中片段（关键词上下文各约 60 字符，关键词高亮）、命中数、命中类型（用户提问 / 助手回复 / 工具输出 / 思考过程）。
- 单条会话可展开，列出全部命中位置，每条带序号；点击会话或序号都会打开会话并定位到该条消息。
- 默认最多 20 个会话，超出时提示缩小关键词。
- 空状态、加载中、建索引中（含进度）、搜索失败可重试，五种状态严格区分；失败不会显示成「无结果」。
- 面板顶部提供「重建索引」。

### 命中定位与回溯加载

- 目标消息在当前已加载范围内：直接滚动到视口、命中文本落在视口第一行并高亮。
- 命中来自**思考过程**时自动点开对应的折叠块（reasoning 默认折叠），再滚动到命中句。
- 命中来自**工具输出**时优先展开工具卡片；官方 transcript 不渲染完整工具输出时，落到相关工具调用行并提示「完整输出可在『查看』中打开」。
- 目标在更早的未加载历史：自动回溯加载（复用官方 `ISession.loadThrough(seq)` 跳转加载器），浮窗显示已加载到的位置，可中途取消。
- 取消后停在当前位置，不高亮、不改变会话内容（后台加载仍会完成，但不再影响界面）。
- 目标消息已不在会话历史中：提示「该条已不在当前会话历史中」，不报错、不空白。

### 对话内浮动查找条

- 对话区右上角的浮动查找条，浮在内容之上，不占布局宽度。
- 元素：输入框、`n/m` 计数、上一个、下一个、关闭、区分大小写、全词匹配。
- 所有命中淡色高亮，当前命中强色；切换命中时滚动到居中。
- 键盘：`Cmd+F` 打开并聚焦，`Esc` 关闭，`Enter` 下一个，`Shift+Enter` 上一个。
- 空查询提示「输入关键词」，无命中提示「无结果」，单命中时上下按钮禁用。
- 关闭后清除高亮，不改变会话阅读位置。
- 「输入关键词」「无结果」「正在定位」等状态显示在查找条下方的小浮层里，不改变查找条宽度/高度（不会因为状态文字出现而跳动）；查找条本身半透明并带背景模糊，下方内容能透出一点。
- 向上翻命中时，对齐边界不是视口最顶，而是查找条下沿 + 8px，保证命中的那一行不会藏在浮窗底下；对话开头无法再往下滚时仍会叠在一起。
- 向下翻命中时，对齐边界不是视口最底，而是**对话区高度约 2/3 处**：官方输入框浮在对话下方、输入内容多时会变高，贴底对齐的文字会被输入框挡住；固定在 2/3 处就不依赖输入框实际高度。
- 命中高亮用荧光笔黄：普通命中淡黄、当前命中亮黄、全局跳转落位用琥珀色描边，避免和主题里的蓝色链接混淆。
- 全局搜索点击结果时会自动展开查找条、预填同一关键词，并把当前命中设为刚跳转的那一条。

## 中文检索

不使用分词、不建倒排索引，直接对规范化文本做子串扫描：中文两字词（「卸载」「全家」）、三字词（「全家桶」）、英文、数字、emoji 走同一条路径。大小写不敏感通过两侧 `toLocaleLowerCase()` 实现；全词匹配按「命中两侧不是字母/数字/下划线」判定（对中文不产生额外限制）。

## 索引

- 数据源：`$DSH_HOME/sessions/**/session.v4.jsonl.zstd`（默认 `~/.dsh/sessions`），**只读**，绝不修改原始文件。
- 索引四类条目：`user`（用户提问）、`assistant`（助手正文，只取 text 块）、`tool`（工具调用参数 + 工具结果）、`thinking`（assistant 的 reasoning 块）。`system/message`、`developer/message` 与被压缩替换（replacement）的副本不入索引。
- 每条索引记录：`sessionId`、`seq`、`turn`、`kind`、`surface`、`time`、规范化文本；`seq`/`turn`/`anchorSeq` 是定位依据。
- 缓存：单文件 `$DSH_HOME/cache/dsh-conversation-search/index.v<version>.json`（当前 v3），原子写入（临时文件 + fsync + rename）；按每会话 `mtimeMs + size` 增量，仅重解析变化的文件；索引版本升级时旧缓存自动失效并在启动时清理。面板「重建索引」可一键全量重建。
- **子会话默认不参与搜索**：subagent 子会话无法作为主视图打开，点进去会跳错；它们仍入索引（可用 `includeSubagents=1` 显式查询），但默认结果只含能在侧栏打开的主会话。
- 后台每 15 秒增量扫描一次会话目录；`/search` 前如距上次扫描超过 5 秒会先补扫，保证刚产生的消息可被搜到。
- 当前语料规模（41 会话 / 11344 条 / 20.6M 字符）：全量首建约 1.4 秒，默认范围中文两字查询约 2–5 ms，全范围（含工具/思考）约 30–50 ms。

## 开发安装

本插件是本地 bundle 目录，安装到当前 profile（如 `desktop`）：

```
plugin_manager install_bundle  target: <绝对路径>/dsh-conversation-search
```

安装后左侧栏出现「搜索会话」面板。插件行 id 为 `conversation-search`，包名 `@itstartstosnow/dsh-conversation-search`。

卸载：

```
plugin_manager remove_bundle  target: @itstartstosnow/dsh-conversation-search
```

卸载后官方搜索、对话与快捷键完全恢复原样：本插件不修改任何官方配置（`cordis.patch.yml` 只做一次 `insert`），不占用 `Cmd+F` 的宿主绑定（监听器随插件卸载移除）。

## 开发与内部文档

- [`api-contract.md`](api-contract.md)：Host API、索引语义、client 分片契约（实现期对齐用）。
- [`publishing.md`](publishing.md)：GitHub / npm 发布清单。
- [`host-service.md`](host-service.md)：Host 半边模块、常量、生命周期、偏差与实测。
- [`verification.md`](verification.md)：真机验收证据与发现的问题。
- `.recon/`、`probe-host/`：侦察期的事实报告与一次性脚本（本地开发资料，已在 `.gitignore` 中排除，不参与运行）。

## 目录结构

```
README.md                面向用户：截图、安装、使用、配置
LICENSE                  MIT
CHANGELOG.md             版本记录
package.json             bundle manifest（dsh.bundle.patch + dsh.client）
cordis.patch.yml         单行 insert
index.js                 Host 入口
lib/search-core.js       纯 Node 检索核心（解码 / 抽取 / 规范化 / 子串匹配 / 索引）
lib/host/service.js      索引生命周期与查询服务
lib/host/routes.js       /api/dsh-conversation-search/* 路由
lib/host/paths.js        $DSH_HOME 解析、缓存路径、原子写
lib/host/access.js       loopback 访问控制
client.js                构建产物（由 build-client.mjs 生成，勿手改）
client/src/10-shared.js  浏览器端共享运行时 DCS
client/src/20-search-panel.js  左侧栏面板
client/src/30-find-bar.js      浮动查找条 + 跳转引擎
client/src/90-apply.js   工厂 apply
build-client.mjs         把 client/src 拼成单文件 client.js
locale/{zh,en}.json      插件展示元数据
icon.svg                 插件图标
screenshots/             用户文档截图（占位图待替换）
docs/development.md      本文件（开发文档）
docs/api-contract.md     Host API / 索引语义 / client 分片契约
docs/host-service.md     Host 半边模块、生命周期、偏差与实测
docs/verification.md     真机验收记录（已脱敏）
docs/requirements.md     功能需求文档
docs/publishing.md       发布清单（GitHub / npm）
tests/                   node:test 用例（87 条）
```

修改 `client/src/` 后执行 `node build-client.mjs`；Host 侧改动后重启 Harness 生效。

## 高亮颜色

默认配色（CSS 变量，挂在 `:root` 上）：

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `--dcs-find-match-bg` | `rgba(255, 212, 32, 0.45)` | 普通命中（淡黄荧光笔） |
| `--dcs-find-current-bg` | `#ffd43b` | 当前命中（亮黄） |
| `--dcs-find-current-fg` | `#241d00` | 当前命中文字色 |
| `--dcs-jump-flash` | `#f5a623` | 全局跳转落位的行描边 |

想换颜色：在开发者工具控制台写入并刷新页面即可（插件加载时读取一次）：

```js
localStorage.setItem('dsh-conversation-search.highlight', JSON.stringify({
  matchBg: 'rgba(255, 212, 32, 0.45)',
  currentBg: '#ffd43b',
  currentFg: '#241d00',
  flash: '#f5a623',
}));
```

## 已知限制

- 对话内查找条在打开时会自动 `loadThrough(0)` 把会话窗口扩到最早事件，因此匹配范围是**整个会话**；超长会话 15 秒超时降级为只搜已加载部分。加载期间 `n/m` 随预处理行增长，当前命中用 `rowKey+offset` 重映射保持不跳位。
- 回溯加载使用官方 `loadThrough(seq)`，它没有 AbortSignal：取消会立即关闭查找条并清空高亮/行闪、停在你当前的位置，后台分页仍会完成（无副作用）。
- 消息高亮通过 CSS Custom Highlight API 实现（不修改聊天 DOM）。极老版本的 Chromium 若不支持该 API，会退化为只滚动、不染色。
- 检索为子串扫描，语料涨到千万字符以上且实测不可接受时，才需要考虑 trigram 索引 + 两字回退（见需求文档附录）。
- 索引缓存用**当前版本号文件名**（`index.v3.json`）：升级导致索引版本变化时旧缓存自动失效并重建，旧版本缓存文件在启动时清理，不会堆积。
- **工具完整输出/参数不一定在 transcript DOM 里**：官方对话只渲染紧凑工具行，全文要点「查看」在详情面板打开。因此工具命中的跳转最多定位到对应工具调用行并提示，无法把全文展开在对话流内。
- 对话内查找条只扫描**已渲染**的文本：默认折叠的思考过程、未展开的工具卡片不会被查找条命中；全局搜索勾选「思考过程/工具输出」后跳转时会自动展开目标块。

## 验证状态

已在真机（Desktop 0.2.1-rc.3，实时增长的本地语料，最大规模 41 会话 / 11344 条索引 / 20.6M 字符）验证：

- 需求 §9 全部验收项（跳转落位、深历史回溯与取消、查找条计数/循环/快捷键、中文两字词、失败态区分、卸载恢复）；
- 第二轮实测反馈修复：查找条翻命中时「命中文本本身」进入视口（向上对齐第一行、向下对齐最后一行、已可见不动）；搜索范围复选框默认只搜用户+助手；思考命中自动展开 reasoning 并落位；工具命中落到工具调用行并提示「查看」；
- 全量 87 条 `node:test` 通过，`client.js` 可复现构建。

完整证据、真机数据与各轮修复见 [`verification.md`](verification.md)。

## 验收对照

需求文档 `dsh-plugin-a-search-requirements.md` §9 的验收项：

| 验收项 | 实现 |
| --- | --- |
| 只出现在正文的词 1 秒内返回 | Host 内存子串扫描 + 增量索引；面板防抖 250ms |
| 点击后打开会话、定位、高亮、查找条展开且计数正确 | 跳转引擎：openSession → loadThrough(seq) → DOM 行定位 → 查找条预填 |
| 目标在很靠前位置时能看到回溯进度并最终落位 | 进度浮窗显示已加载到的 seq，可取消 |
| 取消后停在当前位置、无高亮残留 | 取消分支不滚动/不染色/清进度 |
| 中文两字词命中 | 子串扫描，无最小长度 |
| `n/m` 与实际高亮一致；Enter/Shift+Enter 双向循环 | 计数即高亮 Range 数，循环导航 |
| 大小写敏感与全词开关各自改变结果集 | 两个独立开关，可组合 |
| 关闭插件后官方功能恢复原样 | 仅 `insert` 一行；监听器/样式/高亮随卸载清理 |
