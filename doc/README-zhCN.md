# Zotero2Eagle 集成插件

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)

一个 Zotero 插件，可与 [Eagle](https://eagle.cool/) 无缝集成，让您可以将 PDF 图片标注直接保存到您的 Eagle 库中，以实现更好的视觉内容管理。

[English](../README.md) | [简体中文](README-zhCN.md)

## 功能

- **一键保存**：从 PDF 中提取图片标注并直接保存到 Eagle
- **智能元数据**：自动包含文档标题、作者、出版年份和页码
- **灵活存储**：同时保存到 Eagle 和本地目录
- **批量操作**：高效处理多个图片标注
- **连接测试**：内置 Eagle API 连接测试功能
- **全面日志**：详细的日志记录，便于故障排查和监控

## 安装

1. 从 [发布页面](../../releases) 下载最新的 XPI 文件
2. 在 Zotero 中，转到 `工具 → 附加组件`
3. 点击齿轮图标 → `从文件安装附加组件...`
4. 选择下载的 XPI 文件

## 配置

### Eagle 集成设置

1. 打开 Zotero 首选项 → Zotero2Eagle
2. 配置您的 Eagle API 设置：
   - **API 地址**：默认为 `http://localhost:41595` (Eagle 的默认端口)
   - **API 令牌**：您的 Eagle API 令牌（用于身份验证）
3. 点击“测试连接”以验证设置

### 输出目录（可选）

为图片文件配置本地备份目录：

- 设置用于本地文件存储的 **输出目录** 路径
- 图片将以包含文档元数据的描述性文件名保存

## 使用方法

1. 在 Zotero 的 PDF 阅读器中打开一个 PDF
2. 创建图片标注（高亮并提取图片区域）
3. 图片会自动处理并保存到 Eagle
4. 可选：如果配置了输出目录，也会在本地保存

## 文档

- [日志文档](LOGGING.md) - 文件日志和故障排查
- [开发指南](DEVELOPMENT.md) - 开发指南和项目结构

## 开发

### 环境要求

- [Node.js](https://nodejs.org/) (LTS 版本)
- [Git](https://git-scm.com/)
- [Zotero Beta](https://www.zotero.org/support/beta_builds)

### 安装与设置

```bash
# 克隆仓库
git clone https://github.com/your-username/zotero2eagle.git
cd zotero2eagle

# 安装依赖
npm install

# 复制环境配置
cp .env.example .env
# 编辑 .env 文件，填入您的 Zotero 路径

# 启动开发服务器
npm start
```

### 构建

```bash
# 构建生产版本
npm run build

# 运行测试
npm test

# 代码检查
npm run lint:check
```

### 发布

```bash
# 创建新版本
npm run release
```

## API 架构

该插件采用模块化架构构建：

- **Eagle API 客户端** (`src/utils/eagleApi.ts`): 用于 Eagle API 集成的 HTTP 客户端
- **图片保存器** (`src/utils/imageSaver.ts`): 图片提取和存储逻辑
- **文件日志记录器** (`src/utils/fileLogger.ts`): 全面的日志系统
- **PDF 按钮** (`src/modules/pdfButton.ts`): PDF 阅读器 UI 集成
- **首选项** (`src/modules/preferenceScript.ts`): 设置管理

## 贡献

1. Fork 本仓库
2. 创建一个功能分支
3. 遵循 [DEVELOPMENT.md](DEVELOPMENT.md) 中的编码指南进行更改
4. 为新功能添加测试
5. 提交一个 Pull Request

## 许可证

本项目基于 AGPL 许可证授权 - 详情请参阅 [LICENSE](../LICENSE) 文件。

## 致谢

基于 [@windingwind](https://github.com/windingwind) 的 [Zotero 插件模板](https://github.com/windingwind/zotero-plugin-template) 构建。

[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)