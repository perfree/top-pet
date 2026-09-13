# Top Pet · 卡皮顶栏小伙伴

[English](README.md) | **简体中文**

一只住在 Linux 顶栏里的软萌卡皮巴拉：慢悠悠地散步，偶尔小跑，遇到图标会钻下去，再从另一侧冒出来。你可以摸摸它、喂胡萝卜，或者陪它玩捉迷藏。

<p align="center">
  <img src="panel-pet@local/assets/capybara-atlas.png" width="800" alt="卡皮巴拉的站立、散步、奔跑、开心、吃胡萝卜、探头和休息动作">
</p>

**适用环境：GNOME Shell 46，主要在 Zorin OS 18 上开发和验证。** KDE、Xfce 和其他 GNOME 版本暂未适配。

[下载最新版](https://github.com/perfree/top-pet/releases/latest) · [更新记录](CHANGELOG.md) · [测试说明](docs/TESTING.md) · [反馈问题](https://github.com/perfree/top-pet/issues)

## 它会做什么

- **散步与奔跑**：在顶栏空位之间移动，到边缘自动转向，也会停下来发呆。
- **下沉闪现**：遇到图标，向下完全隐藏，跨过控件后从另一边冒出来；左右两个方向均支持。
- **挤出空位**：前方图标密集时，附近控件平滑让出位置；卡皮钻进去停留，离开后图标自动复位。没有足够余量时不会把图标挤出屏幕。
- **摸摸与喂食**：摸摸会开心地冒爱心，喂胡萝卜会播放进食动作，恢复饱食和心情。
- **捉迷藏**：藏起来约 1.8 秒，在随机空位探头，点击它就算找到。
- **自适应大小**：按真实顶栏高度调整身体尺寸，去掉固定 32px 上限和多余透明留白，适应高分屏的界面缩放。
- **可暂停、可关闭让位**：都在宠物菜单里。概览或主屏全屏应用期间隐藏。

## 音乐与悄悄话

- 支持 MPRIS 的播放器开始播放后，卡皮会戴上紫色耳机，摇晃身体、小跳步；暂停后恢复。约 2.5 秒检查一次播放状态，不读取曲名或播放内容。并非所有发声应用都支持 MPRIS。
- 鼓励气泡会根据音乐、近期按键活动或普通陪伴状态随机选句，显示 5 秒，间隔 40–80 秒；菜单“卡皮悄悄话”可以关闭。气泡不会拦截鼠标点击。
- X11 下可选的 Python 3 / libX11 小助手只判断是否有按键按下，不记录键值、文本或窗口内容，也不联网。它不能区分打字、快捷键和游戏操作。Wayland 下仅感知 GNOME Shell 内的按键，不读取其他应用的键盘输入。
- 捉迷藏会优先排除消失地点附近的位置；密集图标让位不再要求原本紧邻的图标额外留缝。

## 安装

先确认版本：

```bash
gnome-shell --version
```

1. 从 [Releases](https://github.com/perfree/top-pet/releases/latest) 下载 **`panel-pet@local.shell-extension.zip`**。不要把 GitHub 自动提供的源码 ZIP 当作扩展安装包。
2. 在下载目录打开终端，执行：

   ```bash
   gnome-extensions install --force panel-pet@local.shell-extension.zip
   ```

3. 保存工作，**注销并重新登录**。首次安装和更新代码后都建议执行此步骤，GNOME 会话会缓存扩展代码。
4. 启用：

   ```bash
   gnome-extensions enable panel-pet@local
   ```

也可以在 GNOME“扩展”应用中打开 **Panel Pet · 顶栏小伙伴**。安装到当前用户，不需要 `sudo`。

### 怎么玩

| 操作 | 效果 |
| --- | --- |
| 左键点击卡皮 | 摸摸，捉迷藏时找到它 |
| 右键点击卡皮 | 打开互动菜单 |
| 点击顶栏笑脸 | 打开互动菜单，卡皮藏起来时也能找到入口 |
| 喂一根胡萝卜 | 进食、恢复饱食与心情 |
| 一起追逐 | 小跑一会儿 |
| 捉迷藏 | 隐藏后随机探头 |
| 图标给卡皮让让路 | 开关图标让位动画 |
| 休息一下 | 暂停或继续活动 |

### 禁用与卸载

```bash
# 暂时关闭
gnome-extensions disable panel-pet@local

# 完全卸载
gnome-extensions uninstall panel-pet@local
```

## 不安装也能试玩

在 Release 中下载 **`top-pet-preview.html`**，用浏览器直接打开即可，无需服务器或联网。

试玩页与扩展共用行为代码和角色素材；页面顶栏是模拟环境。真实图标让位、音乐感知与状态气泡依赖桌面扩展。

## 从源码构建

需要 **Node.js 18+、Python 3**，不需要安装 npm 依赖。

```bash
git clone https://github.com/perfree/top-pet.git
cd top-pet
npm test
npm run build
```

构建结果：

```text
dist/
├── panel-pet@local.shell-extension.zip  # GNOME 扩展安装包
├── top-pet-preview.html                # 可独立打开的试玩页
└── SHA256SUMS                          # SHA-256 校验值
```

根目录同时生成 `preview.html`，方便本地预览。校验下载文件时，将三个文件放在同一目录，执行 `sha256sum -c SHA256SUMS`。

## 测试与兼容性

当前版本通过 **20 项单元测试和 41 项真实 GNOME 集成断言**。集成测试在独立的 GNOME Shell 46 / Wayland 会话中运行，使用虚拟鼠标实际点击，覆盖喂食、双向闪现、图标让位与自动复位、捉迷藏、概览隐藏和启停清理。

高分屏测试使用 2560×1600 虚拟显示和 2 倍内部界面缩放；开发桌面为 Zorin OS 18.1、2560×1600、X11 125% 分数缩放。独立测试并不等于覆盖所有 X11、显示缩放或第三方扩展组合。详细步骤和结果见 [测试说明](docs/TESTING.md)。

<details>
<summary>查看真实 GNOME 测试中的图标让位截图</summary>

![真实 GNOME 顶栏中的卡皮和临时空位](docs/images/runtime.png)

</details>

### 当前限制

- 只在主屏原生 GNOME 顶栏 `Main.panel` 上运行。用独立任务栏替换原生顶栏的布局需要单独适配。
- 图标按整个控件点击区域避让，有时会跨过整个控件组。
- 饱食和心情暂存在内存，重新启用扩展会重置。
- 使用第三方顶栏主题或扩展时，建议先关闭“图标给卡皮让让路”判断是否存在布局冲突。
- 当前公开版本为早期版本，界面以中文为主。

## 常见问题

**安装后找不到扩展或看不到卡皮？**

先注销重新登录，确认 GNOME 版本为 46，再检查：

```bash
gnome-extensions info panel-pet@local
```

扩展应为 `ACTIVE`。如果顶栏完全没有可容纳宠物的空位，卡皮会暂时隐藏，笑脸菜单仍可用。

**更新后还是旧效果？**

重新登录以清除 GNOME 的扩展模块缓存；单纯开关扩展不一定会重新读取代码。

**如何提供诊断信息？**

在 Issue 中说明发行版、GNOME 版本、分辨率、缩放比例和相关顶栏扩展，并附上相关错误：

```bash
journalctl --user -b -o cat | rg 'panel-pet|PanelPet|JS ERROR'
```

## 项目结构

```text
panel-pet@local/
├── extension.js          # GNOME 挂载、菜单、输入和纹理
├── engine.js             # 行为状态机与可用空间计算
├── push.js               # 图标让位规划与边界检查
├── sprite.js             # 动作选择与浏览器渲染
├── metadata.json         # GNOME 扩展信息
└── assets/               # 透明角色动作图集
tests/                    # 单元测试
tools/                    # 构建与独立 GNOME 集成测试
preview.template.html     # 离线试玩页模板
```

卡皮素材由 AI 生成，使用软萌 3D 风格，未使用小米原始素材。本项目与小米无关联。

## 发布新版本

维护者更新 `CHANGELOG.md`，添加 `docs/releases/vX.Y.Z.md`，提交后推送 `vX.Y.Z` 标签。GitHub Actions 会执行单元测试和构建，再创建包含安装包、试玩页与校验文件的 Release。GNOME `metadata.json` 的整数 `version` 与 GitHub 的语义版本分别维护；首次公开版本 `v0.1.0` 对应扩展版本 `3`。
