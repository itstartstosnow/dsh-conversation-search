# dsh-conversation-search

DeepSeek Harness 桌面端的会话全文搜索插件：在左侧栏搜索所有会话，点结果直接跳到命中那句；对话内按 `Cmd+F` 打开查找条上下翻命中。

**左侧栏搜索**

搜全部会话的内容，结果按会话分组，点一下就能打开会话并落到那句话上。

![左侧栏搜索面板：结果按会话聚合，命中片段高亮，显示命中数与类型](https://raw.githubusercontent.com/itstartstosnow/dsh-conversation-search/main/screenshots/search-panel.png)

**对话内查找**

在当前会话里上下翻命中，黄色高亮标出位置。

![对话内查找条：黄色高亮，显示 n/m 计数与大小写/全词开关](https://raw.githubusercontent.com/itstartstosnow/dsh-conversation-search/main/screenshots/find-bar.png)

## 功能

- **搜索所有会话**：输入关键词就搜全部对话，不需要先打开某个会话；结果列出命中的片段，点会话标题可以展开全部命中位置。
- **搜索范围**：默认搜你和助手的文字；点搜索框右侧的「范围」，可以加上工具输出或思考过程。
- **直接跳到那句话**：命中在很早的历史里也能跳过去，加载时有进度提示，也可以取消。
- **对话内查找条**：`Cmd+F` 打开，显示 `当前/总数`，回车上下翻，`Esc` 关闭；支持区分大小写和全词匹配；命中用黄色荧光笔标出。
- **中英文都能搜**：中文、英文、数字和 emoji 都支持，英文不区分大小写。

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

也可以按 npm 包名安装：

```
plugin_manager install_bundle  target: @itstartstosnow/dsh-conversation-search
```

### 卸载

```
plugin_manager remove_bundle  target: @itstartstosnow/dsh-conversation-search
```

卸载后官方搜索、对话与快捷键恢复原样。

## 使用

### 搜索全部会话

1. 点左侧栏「搜索会话」，输入关键词。
2. 点会话标题展开全部命中位置，点任意一条就打开会话并落到对应消息；直接点会话行则跳到第一条命中。
3. 想搜工具输出或思考过程，点搜索框右侧「范围」勾选相应类型。默认只搜「用户提问 + 助手回复」。

### 对话内查找

| 操作 | 快捷键 |
| --- | --- |
| 打开查找条 | `Cmd+F`（Windows/Linux 用 `Ctrl+F`） |
| 下一个 / 上一个 | `Enter` / `Shift+Enter` |
| 关闭 | `Esc` |

- 打开后会自动加载完整会话，所以很早的消息也能搜到；加载时查找条下方会显示提示，不影响继续输入。
- 「Aa」区分大小写；「全词」只匹配完整单词——命中词两侧不能是字母、数字或下划线，例如全词搜 `foo` 不会命中 `foobar`。中文没有词边界，全词对中文不产生额外限制。

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

索引缓存在 `~/.dsh/cache/dsh-conversation-search/`，自动保持更新；面板顶部「重建索引」可手动重建。索引不会修改你的会话文件。

## 注意

- **工具输出的全文在官方「查看」详情里**：对话里只显示紧凑的工具行，所以搜索到工具内容时，会定位到对应的工具调用行。
- **页内查找只匹配已经显示的文字**：折叠的思考过程、未展开的工具卡片不会被查找条命中；从全局搜索跳转时会自动展开目标块。

## 开发

- 开发文档（实现细节、索引语义、验收记录）：[docs/development.md](docs/development.md)
- 接口与索引契约：[docs/api-contract.md](docs/api-contract.md)
- 测试：`node --test`（87 条）；构建浏览器端 bundle：`node build-client.mjs`

## 许可证

[MIT](LICENSE)
