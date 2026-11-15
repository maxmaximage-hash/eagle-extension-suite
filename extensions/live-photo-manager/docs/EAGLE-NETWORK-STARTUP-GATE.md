# Eagle 网络启动门禁

Live Photo 扩展不能通过修改 Eagle 宿主或关闭用户代理来规避启动校验。FlClash 使用 TUN/Fake-IP 时，`eagle.cool`、`core.eagle.cool` 及其子域必须绕过 Fake-IP，否则 Eagle 可能把 `198.18.0.0/16` 合成地址误判为 hosts 被篡改并退出。

运行只读预检：

```sh
./scripts/eagle-network-preflight
# 或
npm run preflight:network
```

预检会读取 FlClash 当前 profile 和生成配置，确认：

- 当前 profile 与生成配置包含 `eagle.cool` 以及 `*.eagle.cool` 或 `+.eagle.cool` 的 Fake-IP 排除；
- `eagle.cool` DNS 返回真实地址，且不在 `198.18.0.0/16`；
- 当前代理/VPN 状态只被报告，不被脚本修改。

预检是 fail-closed 的：任何一项不满足都会返回非零退出码，安装或真实 Eagle 重启必须停止。脚本不会改写 profile、`config.json`、系统代理、`/etc/hosts` 或 Eagle Library；持久配置必须通过 FlClash 的官方覆盖/配置界面维护，避免订阅更新覆盖临时修改。

## 验收顺序

1. 运行 `npm test` 和 `npm run preflight:network`。
2. 保持系统代理与虚拟网卡原状态，正常重启 Eagle。
3. 在 60 秒内确认真实 Library 网格和日志 `Library loaded`。
4. 确认插件初始化后，原生选择、预览、右键、拖拽、导入导出仍可用。
5. 代理订阅更新后重新运行预检；失败时禁止安装插件或继续重启 Eagle。
