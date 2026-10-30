# 远程 Chrome 部署与访问方案

## 2026-10-28 官方文档复核

- Xpra确有macOS原生ARM64客户端，不需要依赖x86/Rosetta。官方stable目录列有Xpra-arm64-6.5.5-r0.pkg和DMG；PKG链接已用HTTP HEAD验证200，大小87,883,729字节：https://xpra.org/stable/osx/arm64/Xpra-arm64-6.5.5-r0.pkg 。这只验证包存在，尚未在Mac安装或检查包内二进制。
- 当前官方Platforms页将macOS 15及以上的x86_64、arm64列为Tier 1；安装前应以 sw_vers 核对系统版本。页面称从7.0开始应用获得公证，6.5.5不能据此视为已公证：https://github.com/Xpra-org/xpra/wiki/Platforms 。
- 同一页面将Ubuntu服务器以及专有应用列为Tier 3（不提供支持保证），因此Ubuntu ARM64上的Chrome完整组合仍需试部署验收，不能仅凭Mac客户端支持就称已验证最优。
- 官方建议macOS用PKG以注册链接与会话文件：https://xpra-org.github.io/xpra/Usage/Client.html 。
- 结论修订：架构上可行，Mac ARM并非阻碍；将本方案定位为优先试部署候选，中文输入、剪贴板、编码器、代理SSH路径和断线重连均需在用户机器真实验证。

> 隐私说明：本文中的 IP 地址使用文档示例地址，端口、账户和主机别名为示例；实际部署信息已脱敏。

## 网络验证原则

不同网络、代理路径与时段的表现可能不同。部署前应在实际环境中比较直连与代理访问，分别记录连接时间、持续吞吐和实际交互延迟。

HTTP 首字节时间和 SSH banner 时间包含服务端处理时间，不能直接视为网络 RTT；ICMP 丢包也不能直接等同于应用数据丢包。应通过持续使用验证中文输入、剪贴板、滚动和断线重连。

## 推荐架构

Mac Xpra原生客户端 → 本地7897代理 → SSH 22 → 远程Xpra独立会话 → Google Chrome ARM64。

根据实际测量选择直连或代理路径；固定目标IP的路由规则和当前良好节点，防止客户端绕过系统代理。SSH必须显式配置ProxyCommand，不能认为设置系统代理后SSH就自动走代理。暂不采购中转线路；只有现有线路在持续传输或晚高峰不达标时，再测香港/日本优化线路。

选择Xpra seamless模式，只传输Chrome窗口，可断开重连并保留浏览器状态。服务器使用独立普通账户、独立Chrome配置目录、独立显示号:100，保留Chrome沙箱。无需完整GNOME桌面。Google官方ARM64 deb下载地址已实测返回HTTP200：
https://dl.google.com/linux/direct/google-chrome-stable_current_arm64.deb

Xpra官方说明：https://xpra-org.github.io/xpra/Usage/Seamless.html
连接与参数：https://xpra.org/manual

## 部署步骤

1. 安装Google Chrome ARM64、Xpra及其X11依赖、中文字体和必要的中文输入组件；建立专用普通账户browser，配置仅用于该账户的SSH密钥。
2. 以browser运行Xpra :100并启动Chrome，使用持久配置目录，设置用户服务开机启动和断线保留。按实际安装版本核对命令参数，避免使用root或--no-sandbox。
3. Mac安装与服务器兼容的ARM64 Xpra客户端，为下列示例配置填入新生成密钥路径（仅示例，尚未写入Mac）：

```sshconfig
Host remote-browser
    HostName 203.0.113.10
    Port 22
    User browser
    IdentityFile ~/.ssh/remote_browser_ed25519
    IdentitiesOnly yes
    ProxyCommand /usr/bin/nc -X connect -x 127.0.0.1:7897 %h %p
    ServerAliveInterval 20
    ServerAliveCountMax 3
    Compression no
```

4. 使用系统OpenSSH连接，让Xpra明确采用上述SSH配置；在当前版本中验证ssh后端选项，然后连接remote-browser的:100。远程Xpra不额外开放公网端口，沿用现有密钥SSH入口。
5. 制作Mac一键启动入口，启动时检查本地代理可用；代理失效时明确提示，不静默改用慢速直连。

## 初始画面参数

- 初始窗口1600×900、100%或125%缩放；暂不使用Retina原生全分辨率。
- 自适应编码，静止文字优先无损/最终无损，滚动区域自适应视频编码；先确认ARM64两端实际可用编码器，再启用H.264等选项。
- 初始带宽上限5Mbps、交互刷新目标20–30fps；这些是调优起点，非测得带宽或保证帧率。
- 关闭音频、麦克风、打印机与摄像头转发；只保留必要剪贴板功能。
- 如Mac原生客户端兼容性不佳，保留同一服务器会话，改用Xpra HTML5客户端经本地SSH转发访问，仍显式走本地代理。

## 验收

部署后先测远程→Mac方向持续吞吐及双向交互，在相同窗口下对比直连和代理各10分钟：输入中文、滚动复杂网页、切换标签、复制粘贴、断开重连。记录服务器CPU、实际码率、画面更新和长停顿。以稳定可用吞吐至少为配置码率的2倍作为调参参考；目标操作可见反馈约150–250ms、无反复超过1秒停顿，最终以实测验收。若代理SSH链路表现不佳，可在相同代理路径下比较WSS传输，再决定是否更换协议。
