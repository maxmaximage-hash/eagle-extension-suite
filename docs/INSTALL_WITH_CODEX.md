# 使用 Codex 安装

## 1. 适用范围

当前稳定基线针对 macOS 和 Eagle 4.0.0。媒体智能整理的原生排序入口需要与宿主兼容性检查完全一致；未知 Eagle 版本、未知宿主指纹或缺少受支持通信能力时，安装器必须停止，不能强行覆盖。

### 排序宿主兼容性是硬前提

普通文件夹与智能文件夹的 1:1 主网格排序依赖当前团队电脑中已经审计通过的宿主通信能力。官方 Eagle 4 插件 API 本身没有提供“向主窗口加入自定义排序模式、改写当前主网格任意顺序并复用原生拖动视觉”的完整公开接口。

因此，本仓库的安装器只会**读取并核对** Eagle 宿主指纹：

- 已具备受支持通信能力：允许继续安装插件；
- 全新或未知 Eagle、缺少通信能力：明确拒绝，不会偷偷修改 `app.asar`；
- 仓库不包含 Eagle 二进制、`app.asar`、桥接载荷或绕过脚本。

这意味着“仅复制 GitHub 链接就在任意全新电脑上获得 1:1 排序”目前不是可诚实承诺的能力。团队电脑必须先处于与发行清单一致、已经审计过的 Eagle 宿主基线，再安装本仓库插件。NAS sidecar 负责同步已经排好的顺序，但不能代替宿主通信能力。

安装过程只允许操作 Eagle 插件目录和明确创建的插件备份目录。禁止：

- 修改或分发 Eagle `app.asar`；
- 手工编辑任何 `.library` 内部文件；
- 扫描、移动、重命名或删除 NAS/Library 素材；
- 把团队状态、运行缓存、配置或密钥提交到 Git；
- 在 Eagle 运行时覆盖插件。

## 2. 交给 Codex 的完整指令

复制仓库链接后发送：

```text
请安装这个 Eagle 扩展仓库。先读取 README.md、docs/INSTALL_WITH_CODEX.md、
docs/CONFIGURATION.md、docs/TEAM_SORT_SYNC.md 和 release-manifest.json。

第一步只能运行 ./scripts/check.sh，不做写入。向我汇报：
1. macOS 与 Eagle 精确版本；
2. Eagle 是否已完全退出；
3. 两个插件 ID 与发行 SHA-256 是否匹配；
4. 当前已有安装与拟创建的回滚目录；
5. 媒体智能整理宿主兼容状态；
6. 当前 Library 仅报告路径是否可用，不读取或修改其内部文件。

只有检查全部通过并得到我明确批准后，才运行 ./scripts/install.sh --install。
安装后只确认插件 ID、版本和唯一来源，不自动打开 Library，不排序、不拖动、不改名、
不打标签、不发布，也不修改 Eagle app.asar。任何失败立即停止并保留回滚点。
```

## 3. 人工命令

```bash
git clone <REPOSITORY_URL>
cd eagle-extension-suite
./scripts/check.sh
```

检查通过并取得用户明确批准后：

```bash
./scripts/install.sh --install
```

安装器会：

1. 校验发行清单和安装包 SHA-256；
2. 确认两个插件的 manifest ID；
3. 拒绝在 Eagle 运行时覆盖；
4. 把已有插件完整移入带时间戳的回滚目录；
5. 从已校验安装包解压到临时目录，再原子替换；
6. 安装后重新核对 ID、版本和文件哈希。

安装器不会启动或退出 Eagle。由用户正常启动 Eagle 后，在插件菜单分别打开：

- `媒体智能整理`
- `MAX Publisher`

## 4. 团队成员首次使用

团队成员安装后只需挂载同一 NAS，并在 Eagle 中正常打开同一个 Library。媒体智能整理会自动读取 Library 旁的团队状态 sidecar。不要复制主电脑的 Chromium Local Storage、插件缓存或 `.library` 内部数据。

自动编号/改名是高风险功能。团队状态可以携带其配置，但新电脑不会因为安装或打开 Library 就自动改名；真实改名必须由用户在当前文件夹明确确认。
