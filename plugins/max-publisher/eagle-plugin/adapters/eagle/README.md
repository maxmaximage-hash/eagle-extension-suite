# Eagle Adapter

这一层只负责把 Eagle 的选择项、文件选择、通知、窗口生命周期、配置路径和线上发布能力接到两个共享模块。

- `defaults.js`：Eagle 发行版唯一内置预设“引力环球版权文字”。
- `plugin.js`：Eagle 宿主适配与应用外壳；不拥有水印 UI、字体管理 UI 或水印渲染算法。

共享模块不得反向引用 Eagle Library 或本目录。
