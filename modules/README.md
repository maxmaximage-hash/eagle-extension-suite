# Eagle 内部模块

存放 Eagle 扩展体系内的共享真源。`modules/packages/` 中的宿主无关模块不得依赖 Eagle API；各扩展通过版本化副本和自己的 `adapters/` 接入，测试会逐字节校验副本，保证单一仓库可以跨电脑复现。
