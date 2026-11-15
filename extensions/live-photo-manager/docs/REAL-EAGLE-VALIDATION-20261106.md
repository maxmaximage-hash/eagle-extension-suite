# Live Photo v0.2.0-dev.2 真实 Eagle 验收

- 日期：2026-11-06（Asia/Shanghai）
- 安装目标：`/Users/max/Library/Application Support/Eagle/Plugins/com.max.eagle-live-photo-manager`
- 安装包：`MAX Live Photo 管家-v0.2.0-dev.2.eagleplugin`
- manifest 版本：`0.2.0-dev.2`
- 安装版 `plugin.js` SHA-256：`ba599ddb93255aed2055c30a275323e167eb640bd1276371616a6f13451a1556`
- 旧版备份：`/Users/max/Library/Application Support/Eagle/Backups/live-photo-manager-before-dev2-20261106/plugin`

## 启动门禁

- `app.asar` SHA-256：`df1b7219afb226d284ad9fd1b098b3e9724c0ba6b3d8f0b46cdc25496c18967e`，与基线匹配。
- `/etc/hosts` SHA-256：`c8c56f1286c60ef5d645d906fbe0b2c1afb49563d8e1117e871906d9bb40aada`，与基线匹配。
- 插件目录越界 symlink：无。
- FlClash Fake-IP 排除：`eagle.cool`、`*.eagle.cool`；DNS 返回 `104.26.14.242`、`104.26.15.242`、`172.67.69.237`，无 `198.18.0.0/16`。
- FlClash `systemProxy=true`、`vpnEnabled=true`；预检未修改代理、hosts、Library 或宿主。

## 真实 UI

- 正常退出后重启：从启动时间戳 `1793896340986` 到 Live Photo 插件真实窗口 AX/UI 可见耗时约 `1.776 s`；随后约 `1.8 s` 切至 Eagle 主窗口并进入可操作 Library 网格，低于 60 秒门禁。
- Eagle 主窗口显示 `引力环球` Library；进入原生 `livephoto 测试` 文件夹显示 1 个 `IMG_4154.livp`。
- 原生单击选择成功，右侧 inspector 显示 LIVP、4284 × 5712、6.69 MB。
- 原生空格预览成功打开并可退出；Eagle 原生提示该 LIVP 格式暂不支持预览，未出现白屏或插件拦截。
- 未执行任何 Library/NAS 素材删除、覆盖或迁移；未修改 Eagle `app.asar`。

## 自动测试

- `node --test tests/eagle-preflight.test.js`：5/5 通过。
- `python3 -m unittest extensions/live-photo-manager/test/test_eagle_network_preflight.py`：3/3 通过。
- `npm test`（`extensions/live-photo-manager`）：25 通过，1 个用户 fixture 因本机不存在而跳过。
