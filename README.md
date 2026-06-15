# 地形地貌 3D 展示

基于 Three.js 和 React 的交互式 3D 地形可视化应用。

## 功能

- **3D 地形模型**：山峰、山谷、河流、湖泊，地表纹理模拟草地、岩石和雪线
- **交互操作**：鼠标左键旋转、右键平移、滚轮缩放
- **坐标显示**：鼠标悬浮显示经纬度和海拔高度
- **数据图层**：等高线、植被覆盖、降雨分布，半透明叠加显示
- **剖面工具**：沿两点画线查看地形剖面图
- **多区域切换**：青藏高原、四川盆地、雅鲁藏布大峡谷，各有文字介绍

## 技术栈

- Vite + React 18 + TypeScript
- @react-three/fiber + @react-three/drei + Three.js
- 所有样式内联在 index.html 中，无 CSS 文件

## 运行

```bash
npm install
npm run dev
```

开发服务器将在 http://localhost:3000 启动。
