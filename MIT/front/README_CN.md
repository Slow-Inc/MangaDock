[ENGLISH](README.md)

# MIT 前端测试工具

这个目录是当前自定义 `manga-image-translator` 微服务的独立浏览器测试界面。

它用于手动上传图片、测试流式翻译、排查模型或渲染问题，不是 MetaBooks 主站前端，也可以给其他接入该微服务的项目使用。

## 使用前提

请先启动 MIT 服务，默认地址为：

```text
http://localhost:5003
```

推荐顺序：

1. 先运行 `backend/manga-image-translator/run-server.bat`
2. 等待服务和模型加载完成
3. 再启动本目录前端工具

## 安装与启动

```bash
npm install
npm run dev
```

如果 API 不是运行在默认本地地址，可以通过环境变量覆盖前端开发代理目标：

```bash
MIT_API_TARGET=http://localhost:5003 npm run dev
```

默认开发地址通常是：

```text
http://localhost:5173
```

## 重要说明

- 不要再沿用旧版上游文档中的默认端口或绑定地址说明，这个仓库当前的自定义服务默认运行在 `5003`。
- 当前开发代理默认指向 `http://localhost:5003`，也可以用 `MIT_API_TARGET` 覆盖。
- 当前浏览器工具主要面向 `/translate/with-form/image/stream/web` 这个自定义流式端点。
- 若需查看完整说明，请以 `backend/manga-image-translator/README.md` 为准。