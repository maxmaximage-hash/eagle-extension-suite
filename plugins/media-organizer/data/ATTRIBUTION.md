# 离线地域数据说明

本插件运行时不会调用在线地图、逆地理编码服务或 AI 服务。行政区划数据在构建时
下载并压缩，Eagle 使用期间只读取插件目录内的本地文件。

## 中国地级市边界

- 数据包：GeoToolCN 2.0.1
- 项目：https://github.com/13Cohen/GeoToolCN
- 原始来源：阿里云 DataV.GeoAtlas
- 数据日期：2026-03-07
- 坐标：由数据包从 GCJ-02 转换为 WGS-84
- 许可：MIT License，Copyright (c) 2025 Cohen

## 国家边界

- 数据集：Natural Earth Admin 0 Countries，1:50m
- 项目：https://www.naturalearthdata.com/
- 源码仓库：https://github.com/nvkelso/natural-earth-vector
- 许可：Public Domain

边界数据用于自动建议简洁地域标签。行政边界、争议地区或边界附近坐标可能存在
误差，用户可以在 Eagle 中直接修改标签；插件的处理档案会保留该人工修改，不会
自动把旧标签加回来。
