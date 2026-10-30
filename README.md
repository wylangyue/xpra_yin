# xpra_yin

基于 Xpra 的远程 Chrome 使用方案及移动端、Mac 输入交互适配。

- `mobile/`：HTML5 客户端适配、中文输入、滚动处理和验证脚本。
- `远程Chrome方案.md`：部署方案与网络验证原则。
- `PasskeyBridge-review/`：用于研究的 [PasskeyBridge](https://github.com/GN998/PasskeyBridge) 上游子模块，其许可证见该目录。

## 获取项目

```sh
git clone --recurse-submodules https://github.com/wylangyue/xpra_yin.git
cd xpra_yin/mobile
npm ci
```

本仓库为现有项目的源码归档，部署路径和测试脚本包含特定环境配置，使用前需按实际环境调整。部分页面资源依赖服务器上的 Xpra HTML5 安装。

验证脚本需要运行中的远程会话和本地登录配置。`validation/` 中的凭据、截图、日志及安装包不公开提交；依赖和运行缓存也已忽略。

## 本地验证配置

验证脚本从环境变量 `XPRA_HTTP_USERNAME` 和 `XPRA_HTTP_PASSWORD` 获取凭据，不再读取本地密码文件。请在本机安全设置这些变量，勿将实际值写入仓库或命令历史。

可用 `XPRA_CHROMIUM_EXECUTABLE` 指定 Chromium 路径；未指定时使用 Playwright 默认路径。验证前需安装兼容浏览器。生成的截图仍保存在被忽略的 `validation/` 目录。

部署文档中的地址为文档示例地址。Mac 脚本根据当前用户目录和脚本所在目录定位文件。性能测试用到的 `ssh_config` 需在本机配置，并已加入忽略规则。
