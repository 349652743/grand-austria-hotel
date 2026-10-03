# 设计资源来源与分辨率

检索日期：2026-10-02。设计目标为本机私人局域网桌游，素材落地后不再热链外站。

| 资源 | 来源 | 本次处理 |
|---|---|---|
| 出版社原版说明书 | [Lookout 2022 PDF](https://www.lookout-spiele.de/upload/de_grandaustriahotel.html_GAH_Retail21_Rules_152_EN_WEB.pdf) | 原件保留于维护者本地资料库，不随仓库分发；首页渲染成 1489 × 2105 WebP 作封面。PDF 内对应位图约 830–892 × 1173–1263，渲染尺寸不等于新增原始细节。 |
| 出版社独立封面 | [官方 CoverImage.jpg](https://www.lookout-spiele.de/upload/en_grandaustriahotel.html_CoverImage.jpg) | 核实只有 428 × 600，留作来源参考，未作为高清封面使用。 |
| 56 客人牌、48 员工牌 | [Yucata 公开规则和卡牌资源](https://www.yucata.de/en/Rules/GrandAustria) | 客人图 188 × 288、员工图约 153 × 144；保持原图，不将放大称为高清。中文效果重绘在图片之外，卡图可点开。 |
| 12 皇家委托、12 皇帝青睐 | 上述官方 PDF 第 19／20 页 | 提取 PDF 内嵌原始位图，分别为 117 × 180、135 × 166，转 PNG、不放大。逐卡核对编号／效果；保留中文说明。 |
| 酒店、骰子、标志、轨道与界面 | 本项目原创 HTML/CSS/SVG | 可缩放，避免将低清棋盘图片拉伸后当作交互界面。 |
| 高清酒店板照片线索 | [BGG 图片 #2703992](https://boardgamegeek.com/image/2703992/grand-austria-hotel) | 搜索索引标示原图 4272 × 2848；实际访问返回 403，未下载、未用于应用，也未绕过限制。 |

没有找到可确认开放授权、包含全套卡牌和组件的高清印刷素材包。视觉实现采用原版插画参考和可缩放界面，不假称已取得这样的资源。

每个实际使用的图片的直接 URL、原始尺寸、SHA-256 和权利说明保存在 [sources.json](../public/assets/sources.json)。原版插画版权及署名保留，公开再分发许可仍未确认。
