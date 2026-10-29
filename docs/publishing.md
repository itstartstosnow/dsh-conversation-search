# 发布清单（内部）

面向 GitHub 仓库与 npm 包的发布步骤。仓库地址、包名、LICENSE 已确定：

| 项目 | 值 |
| --- | --- |
| GitHub | `https://github.com/itstartstosnow/dsh-conversation-search` |
| npm 包名 | `@itstartstosnow/dsh-conversation-search`（scoped，`publishConfig.access: public`） |
| LICENSE | MIT，版权行 `itstartstosnow` |

## 每次发布新版本

1. 改 `package.json` 的 `version`，更新 `CHANGELOG.md`。
2. `node build-client.mjs`（client.js 是产物，必须与 `client/src` 同步；CI 可用 `--check`）。
3. `node --test`（87 条）。
4. `npm_config_cache=/tmp/dcs-npm-cache npm pack --dry-run`，确认只含运行时文件 + README/LICENSE。
5. `npm_config_cache=/tmp/dcs-npm-cache npm publish`（scoped 包已配置 `access: public`；若 npm 账号启用了发布 2FA，命令行会要求 OTP）。
6. `git tag v<version> && git push --tags`。

## 隐私检查（每次发布前）

```sh
git ls-files -z | xargs -0 grep -nIE '/Users/|sylvia|ufoshen|@gmail|Bearer |sk-[A-Za-z0-9]{8,}|session-[0-9a-f]{8}-'
```

- 截图必须是公开示例会话，不点名其他项目/库（必要时模糊处理）。
- `.recon/`、`probe-host/` 不得被跟踪（`.gitignore` 已排除）。
- 会话内容、个人路径、token 不进入仓库。

## 安装验证（发布后）

- 本地目录：`plugin_manager install_bundle target: <绝对路径>`
- npm 包：先 `npm install` 到某个目录，或让 Harness 的安装器按包名安装；装完确认左侧「搜索会话」出现、`Cmd+F` 查找条可用。
