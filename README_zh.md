# BlackHornet

![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.11%2B-blue)
![Version](https://img.shields.io/badge/version-7.0.0-orange)
![Trading](https://img.shields.io/badge/trading-paper--only-red)

**选择语言：** [EN — English](README.md) · [ID — Bahasa Indonesia](README_id.md) · [CN — 中文](README_zh.md)

> **状态 — v7.0.0 全新重建。**
> BlackHornet v7 是一次彻底的重建，采用**全新的单提交 git 历史**（出于安全原因，所有 v7 之前的历史均已废弃 — 参见[安全](#安全)）。
> 交易模块**仅支持模拟盘（paper-trading）**。**不存在任何真实券商连接。** 本仓库中的任何内容均不构成投资建议。

---

## BlackHornet 是什么

BlackHornet 是一个用 Python 编写的**自主智能体群落平台**：由相互协作的智能体进程组成群落，具备共享内存、实时生态系统状态、免密钥 LLM 访问、沙箱化的工具注册表，以及仅限模拟盘的交易栈 — 通过零依赖的仪表盘提供服务。

它**不是** AGI，也尚未进行任何有实际意义的自我改进。其中部分组件（Omega"自我改进"循环与 Council 辩论）是**带有模拟辩论输出的治理脚手架**，并已如实标注。本 README 只描述真正可用的功能，均已对照代码与 v7 基线的 366 项测试套件进行验证。

## 可运行的子系统

| 子系统 | 功能说明 | 状态 |
|---|---|---|
| **Memory federation** | SQLite + FTS5 记忆系统（STM/LTM/语义/情景），含 `MemoryFederation`：内容哈希去重、置信度加权合并、按重要性排序检索、TTL 修剪 | 真实，已测试 |
| **Colony ecosystem** | `EcosystemOrchestrator` 同步循环；`ColonyRadar` UDP 节点发现；`MeshBus` 消息总线；`SelfNest` 健康/重启；`QueenAgent` 命令接口。多实例组网仅由单元测试覆盖 — 仓库不附带第二个群落 | 真实，单节点 |
| **Jeumpa Brain** | 免密钥 LLM 层：5 个公共社区端点，带任务配置、冷却与响应缓存。第三方免费端点 — 可用性与质量不作保证 | 真实，尽力而为 |
| **Tool registry** | 文件 / Shell / 代码工具，置于带熔断器、限速与路径沙箱的注册表之后 | 真实 |
| **Risk officer** | 对每笔交易硬性否决：单笔风险上限 0.5%、每日 1%、每周 3%；否决记录入日志，绝不可绕过 | 真实，仅模拟盘 |
| **Trading stack** | yfinance 行情 → 技术分析 → 风险否决 → **模拟盘**执行 → SQLite 日志。代码树中不存在任何券商代码 | 真实，仅模拟盘 |
| **Ecosystem state API** | `GET /api/v1/ecosystem` — 经审计的规范 `EcosystemState`（智能体、任务、辩论、审计日志） | 真实 |
| **Dashboard / UI** | 零依赖 stdlib HTTP 仪表盘（端口 8080），带 API 桥与 WebSocket 事件 | 真实 |
| **Swarm intelligence** | PSO（4 种拓扑）、ABC、stigmergy — 纯算法库 | 真实，仅数学 |
| **Knowledge graph** | SQLite 属性图 + 会话记录器，已接入仪表盘 | 真实 |
| **Self-healing** | Phi-accrual 故障检测器 | 真实 |
| **Omega Engine / Council** | "自我改进"循环 + 15 人格共识委员会。共识数学引擎是真实的；**辩论者是模拟的** — 投票与辩论文本均为模板字符串，循环不产生真实工作 | **实验性 / 模拟** |
| **SAMAN governance** | 共识引擎（分数 ≥ 0.85，3 轮，fail-closed）、辩论场、AST 消毒器。引擎可靠，等待真实（基于 LLM 的）辩论者 | 引擎真实，接线实验性 |

## 快速开始

要求：**Python ≥ 3.11** 和 pip。

```bash
# 安装（可编辑模式，本地包 "blackhornet-colony"）
pip install -e .

# 仪表盘 + 生态系统 API + 记忆 + 知识图谱（http://localhost:8080）
bh-colony

# Omega 治理循环（实验性 — 模拟辩论，见上表）
bh-omega

# 模拟盘交易循环（长期运行；行情数据来自 yfinance，仅当设置了
# TELEGRAM_* 环境变量时才发送提醒 — 不存在任何券商连接）
python -m src.hermes_quant

# 运行测试套件
pip install -e ".[dev]"
pytest tests/ -q
```

LLM 与提醒凭据仅从环境变量读取；运行仪表盘无需任何凭据。切勿提交 `.env` 文件 — v7 之前的历史中曾提交过一份，这正是历史被废弃的原因。

Docker：包含多阶段非 root 的 `Dockerfile` 与 `docker-compose.yml`（服务 `omega`、`omega-loop`）；`deploy/` 内含 systemd 单元与容器入口脚本。

## v7 移除了什么

重建中被舍弃（死亡、损坏或纯装饰性的部分 — 完整理由见 [PLAN.md](PLAN.md)）：依赖不明的 `src/harness` 端口、无人引用的 FastAPI 栈（`src/api`）、导入即崩溃的 `src/channels` 与 `src/mcp` 模块、Node.js 的 `.mjs` 孤岛、重复的类型系统、102 个模板智能体文件、提交进 git 的运行时数据，以及根目录的营销文档。旧版 `ui/` 的"Living World"游戏与 `skills/` 包正在从产品树中分离。

## 架构

参见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)：模块地图、mermaid 依赖图、运行时数据流（智能体回合、模拟盘交易回合）、持久层，以及每个子系统的诚实判定。

## 路线图

发布之后，Python 仍是默认运行时（`BH_RUNTIME=python`）；Rust 核心在稳定的接缝处（MCP、RAP、`ModelProvider`、store traits）旁逐步生长。姿态：*采纳协议，嵌入运行时，绝不移植群落*。

| 阶段 | 周数 | 目标 |
|---|---|---|
| 0 | 0–2 | 事实基准：适配器契约；BH 工具经 RAP 端点往返验证 |
| 1 | 2–6 | 先桥接后移植：Infinity MCP 桥 + 实现 `ModelProvider` 的 `JeumpaProvider` |
| 2 | 6–12 | 运行时楔子：Rust 守护进程 `bh-rtd`，在 `BH_RUNTIME=rust` 之下嵌入 `infinity-agent-core` |
| 3 | 10–16 | 记忆接缝：以 BH 的 SQLite/FTS5 记忆支撑 Infinity store traits |
| 4 | 14–22 | Rust 原生 RAP 工具服务器（先做 shell/file/search） |
| 5 | 20–30 | 加固与 UI：Rust 中的看门狗计时器、向仪表盘推送视图更新 |

交易资金路径**在阶段 5+ 之前排除在迁移之外**。完整细节：[PLAN.md](PLAN.md) §4。

## 文档

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 架构地图（v7）
- [docs/02-arch/MODULE_GRAPH.md](docs/02-arch/MODULE_GRAPH.md) — 生成的包依赖图（重新生成：`python3 scripts/gen_arch_graph.py`）
- [PLAN.md](PLAN.md) — 重建计划、路线图细节、验收标准
- [docs/13-changelog/](docs/13-changelog/CHANGELOG.md) — 历史变更日志与 SAMAN 集成审计
- [README_id.md](README_id.md) — 印尼语翻译

## 安全

- **全新历史：** 所有 v7 之前的 git 历史均已废弃，因为曾有一份凭据文件被提交并推送到公共远端。任何仍持有 v7 之前克隆的人，都应将这些凭据视为已泄露并立即轮换。
- **工作树：** 按策略保持无密钥状态；凭据一律来自环境变量。如果你在代码树中发现密钥，请不要开公开 issue — 直接联系维护者。
- **交易安全：** 执行路径在构造上就是仅模拟盘；代码库中不存在任何券商适配器。

## 许可证

[MIT](LICENSE) — 版权所有 (c) 2026 Mulky Malikul Dhaher / Dhaher Labs 贡献者。
