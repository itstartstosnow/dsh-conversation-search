# dsh-conversation-search

DeepSeek Harness 桌面端的会话全文搜索插件：左侧栏搜索所有会话，点结果直接跳到命中那句；对话内 `Cmd+F` 打开查找条上下翻命中。中文两个字也能搜，索引存在本地，不会修改会话文件。

![左侧栏搜索面板：结果按会话聚合，命中片段高亮，显示命中数与类型](https://raw.githubusercontent.com/itstartstosnow/dsh-conversation-search/main/screenshots/search-panel.png)

![对话内查找条：黄色高亮，显示 n/m 计数与大小写/全词开关](https://raw.githubusercontent.com/itstartstosnow/dsh-conversation-search/main/screenshots/find-bar.png)

## 功能

- **左侧栏「搜索会话」**：输入即搜（250ms 防抖，`Enter` 立即搜）；结果按会话聚合，显示标题、最后更新时间、命中片段（关键词高亮）、命中数和命中类型。点会话标题展开全部命中位置，点任意一条即可打开会话并定位到那一条消息。
- **搜索范围**：搜索框右侧的「范围」菜单可以选搜哪些内容——**用户提问**、**助手回复**（默认只勾这两个）、**工具输出**、**思考过程**；勾选后立即重新搜索。
- **历史消息定位**：目标消息不在当前页面时自动加载更早的历史，浮窗显示进度、可随时取消；取消后停在当前位置。
- **思考/工具命中**：思考命中会先自动展开对应折叠块再落位；工具输出命中定位到相关工具调用行（完整输出在官方「查看」详情里）。
- **对话内查找条**：`Cmd+F` 打开；`n/m` 计数、上下翻、`Esc` 关闭；`Enter` / `Shift+Enter` 循环；区分大小写与全词匹配两个开关；命中用荧光笔黄色高亮，避免和页面链接混淆。打开后会自动加载完整会话，所以整个会话里的命中都能直接搜到，不需要先滚到顶部。
- **中文检索**：中文两个字就能搜到，英文不区分大小写，数字与 emoji 同样支持。

## 安装

环境：DeepSeek Harness 桌面客户端 **0.2.1-rc.3 或更新版本**。

1. 克隆本仓库到本地任意目录：

   ```sh
   git clone https://github.com/itstartstosnow/dsh-conversation-search.git
   ```

2. 在 Harness 对话里让 Agent 安装（把路径换成你本机的绝对路径）：

   ```
   plugin_manager install_bundle  target: /absolute/path/to/dsh-conversation-search
   ```

   也可以在 Harness 的插件管理界面里从本地目录安装。

3. 安装后左侧栏出现「搜索会话」，无需重启。若没有出现，刷新页面或重新打开 Harness。

npm 包发布后也可以直接按包名安装：

```
plugin_manager install_bundle  target: @itstartstosnow/dsh-conversation-search
```



### 卸载

```
plugin_manager remove_bundle  target: @itstartstosnow/dsh-conversation-search
```

（按实际安装名卸载。）卸载后官方搜索、对话与快捷键恢复原样。

## 使用

### 左侧栏全局搜索

1. 点左侧栏「搜索会话」。
2. 输入关键词。中文两个字就能搜；英文匹配不区分大小写。
3. 结果按会话聚合，命中片段里的关键词会高亮。点会话标题展开该会话的全部命中位置，点任意一条落到对应消息；点会话行则跳到该会话的第一条命中。
4. 想搜工具输出或思考过程，点搜索框右侧「范围」勾选相应类型。默认只搜「用户提问 + 助手回复」。

### 对话内查找

| 操作 | 快捷键 |
| --- | --- |
| 打开查找条 | `Cmd+F`（Windows/Linux 用 `Ctrl+F`） |
| 下一个 / 上一个 | `Enter` / `Shift+Enter` |
| 关闭 | `Esc` |

- 输入后自动高亮所有命中并显示 `当前/总数`；再按 `Cmd+F` 会重新聚焦输入框。
- 「Aa」区分大小写；「全词」只匹配完整单词——命中词两侧不能是字母、数字或下划线，例如全词搜 `foo` 不会命中 `foobar`。中文没有词边界，全词对中文不产生额外限制。
- 打开后会在后台加载完整会话，查找条下方显示「正在加载完整历史…」；加载期间已加载部分的命中就能用，`n/m` 会随加载增长。

## 配置

### 高亮颜色

默认是荧光笔黄色（普通命中淡黄、当前命中亮黄、跳转落位琥珀色描边）。想换颜色，在开发者工具控制台写入以下内容并刷新页面：

```js
localStorage.setItem('dsh-conversation-search.highlight', JSON.stringify({
  matchBg: 'rgba(255, 212, 32, 0.45)', // 普通命中
  currentBg: '#ffd43b',                // 当前命中
  currentFg: '#241d00',                // 当前命中文字色
  flash: '#f5a623',                    // 跳转落位描边
}));
```

### 索引

- 索引缓存在 `~/.dsh/cache/dsh-conversation-search/`，不会修改会话文件。
- 后台定时增量刷新；面板顶部「重建索引」可一键全量重建。

## 已知限制

- **工具输出全文只在官方「查看」详情里**：对话流只显示紧凑的工具行，所以工具命中只能定位到相关工具调用行。
- **页内查找只匹配已经显示的文字**：折叠的思考过程、未展开的工具卡片不会被它命中；从全局搜索跳转时会自动展开目标块。
- 深历史跳转点「取消」会停止界面上的滚动与高亮；后台加载仍会继续，但位置不再变化。
- 子代理（subagent）会话默认不参与搜索。

## 开发

- 开发文档（实现细节、索引语义、验收记录）：[docs/development.md](docs/development.md)
- 接口与索引契约：[docs/api-contract.md](docs/api-contract.md)
- 测试：`node --test`（87 条）；构建浏览器端 bundle：`node build-client.mjs`

## 许可证

[MIT](LICENSE)
