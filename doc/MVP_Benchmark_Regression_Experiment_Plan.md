# LLM Eval Hub MVP、Benchmark 与回归能力实验计划

> 文档版本：v0.1  
> 编写日期：2026-08-11  
> 适用范围：Phase 1 MVP 收口、Phase 2 标准 Benchmark 与回归能力  
> 执行目录：`/home/zihaomu/bigssd_workspace/model_benchmark`  
> 状态：执行中（Phase 1 / P1-01 至 P1-13 全部通过，进入退出门审计）

## 0. 实时执行状态

> 最后更新：2026-08-13 16:22 CST

| 项目 | 状态 | 当前证据/结果 |
|---|---|---|
| P1-00 Git 实验基线 | DONE | commit `6996352`；tag `mvp-experiment-baseline`；敏感和运行时文件未纳入提交 |
| P1-01 Clean deploy/migration | DONE | `0001` 已改为显式 op；3 个独立临时库连续通过 upgrade/re-upgrade/check/downgrade，单次 `1 passed` |
| W1 确定性实验 fixtures | DONE | seed `20260811` 生成 100/1,000/120/100 条；manifest/expected/lock 已冻结；专项测试 `10 passed` |
| W1 PostgreSQL/Redis/Celery 生命周期 | DONE | 随机库 + Redis DB 15 + in-process Celery worker 完成 100 样本 run 和重复投递幂等验证 |
| P1-02 Dataset/API | DONE | 两版本 + 8 类错误边界通过；版本与 data path 防 traversal；稳定 409/422 code |
| P1-03 Scoring oracle | DONE | 独立标准库 oracle 复算 F1/numeric/percentile/denominator，专项 `5 passed`，误差 `<=1e-12` |
| P1-04 Fingerprint | DONE | 冻结 digest；map 顺序稳定；prompt/scorer/checksum/seed 变更矩阵 `8 passed` |
| W2 Redis 共享调度原语 | DONE | Redis TIME + Lua 全局 QPS slot/lease semaphore；共享与过期恢复 integration 通过 |
| W2 shard/claim/聚合 | DONE | migration `0002`；50 样本 shard；过期 claim；chord finalize 行锁；重复 dispatch 幂等 |
| P1-05 Capacity | DONE | 4 档 concurrency × 3 次共 12 个 1,000 样本 run 全通过；API P95 最大 21.19ms |
| P1-06 Shared QPS | DONE | QPS 10/50 合并滑窗峰值 11/49；两组各 200 请求且两个 run 均完成 |
| P1-07/P1-08 Fault + retry | DONE | 初始 210 attempts；35 transient 仅重试一次；最终 245 attempts，指标完全匹配 |
| P1-09 Cancel | DONE | completed=52 时取消；67 succeeded/933 cancelled；取消后新增请求 0；导出 1,000 行 |
| P1-09 实现检查点 | DONE | commit `fefe516`（代码、冻结 fixtures、migration、实验运行器与回归测试） |
| P1-10 Worker crash | DONE | completed=50/active claims=150 时 SIGKILL，exit 137；最终 1,000 execution/score/attempt，revision 仅 1，claims=0，进度单调 |
| P1-10 实现检查点 | DONE | commit `579b02e`（真实容器故障编排、独立实验控制器、证据和恢复清理） |
| GPU 资源边界 | DONE | 本机 4× AMD Radeon AI PRO R9700；后续仅允许物理卡 `2,3`，P1-11 不挂载 GPU 设备、实际 GPU 使用为 0 |
| P1-11 Restart/restore | DONE | 6 服务完成 restart；17 张 public 表两次 clean restore checksum 一致；backup 57,645 bytes、权限 0600 |
| P1-11 实现检查点 | DONE | commit `0d10454`（GPU 边界、全服务重启、双次 clean restore 和逐表 checksum） |
| 当前回归/部署 | DONE | 69 unit/contract + 6 integration；P1-12 Chromium `2 passed`；Ruff/ESLint/build 通过；主 API/worker 已部署 P1-13 防护，Web `10.170.38.103:18080` 返回 200 |
| P1-12 Browser E2E | DONE | 100 样本完整 UI 闭环；SSE 刷新 `6/100 -> 16/100`；桌面/移动无 overflow/overlap；JSONL/CSV 各 100 条可解析；证据 `artifacts/experiments/P1-12-browser-e2e-20260812T094443Z/` |
| P1-12 实现检查点 | DONE | commit `7175e3c`（隔离 Browser E2E、证据链、HTTP UUID fallback 与 Chromium pattern 修复） |
| 真实 Endpoint 接入易用性 | DONE | 登记时 Model ID、手工补充模型、自动探测、无 `/models` 回退和结构化错误展示均已落地；精确放行 `developer.amd.com.cn`，Browser E2E `2 passed` |
| Native Benchmark 基础数据 | DONE | GSM8K test `1,319`；MMLU Lite `570`（57 subject x 10）；MMLU Full `14,042`；固定 revision/checksum，API 幂等注册和浏览器可见性通过 |
| P1-13 Secret/SSRF | DONE | 13 项结构化断言全部 PASS；API/DB/Celery/Redis/log/evidence 完整 secret 命中均为 0；7 类恶意 URL 和 3 类敏感 header 均稳定返回 `422 ENDPOINT_POLICY`；证据 `artifacts/experiments/P1-13-secret-ssrf-20260813T082003Z/` |
| P1-13 实现检查点 | DONE | commit `e6d8d52`（DNS/IP 复验、敏感 header 边界、隔离安全实验、回归与文档） |
| B2/R2 Phase 2 | NOT STARTED | 本次数据包使用 Native 0-shot generated-text 协议；Harness adapter、官方 few-shot/loglikelihood 和回归比较能力仍待 P1 退出门后实现 |

状态枚举：`NOT STARTED`、`IN PROGRESS`、`BLOCKED`、`DONE`。只有实验断言和证据落盘后才能标记 `DONE`。

### 0.1 执行日志

| 时间 | 变更 | 验证 |
|---|---|---|
| 2026-08-11 | 建立实验基线 | commit `6996352`，tag `mvp-experiment-baseline`；敏感/运行时文件未提交 |
| 2026-08-11 | 初始 migration 不再导入当前 ORM 执行 `create_all/drop_all`；增加隔离 test image 和 migration integration test | 连续 3 个随机临时数据库通过 upgrade、重复 upgrade、autogenerate drift check 和 downgrade |
| 2026-08-11 | 新增 seed `20260811` 数据生成器、四套冻结 fixture、mock 确定性故障控制与 reset/state 端点 | 字节级重生成、四套 manifest、预期样本数和 mock adapter 契约共 `10 passed`；data SHA-256 见 `datasets/experiments/fixture-lock.json` |
| 2026-08-11 | 新增随机 PostgreSQL + Redis broker + Celery worker 的 100 样本 run lifecycle integration test | `2 passed` integration；重复任务后仍为 100 execution/attempt/score，主指标 `accuracy=1.0`；其余 unit/contract `38 passed`，Ruff 通过 |
| 2026-08-11 | 完成 P1-02 Dataset/API；修复 duplicate dataset 事务边界和上传失败 artifact 清理，收紧 version/data path | 两个合法版本和 duplicate/missing/invalid JSON/checksum/name/path/version 错误通过；integration `3 passed`，unit/contract `40 passed` |
| 2026-08-11 | 新增不导入生产评分代码的 scoring oracle | 500 条混合状态在 4 套分母策略下复算一致；numeric `90/100`、5 parse error 一致；专项 `5 passed` |
| 2026-08-11 | 冻结完整 run spec fingerprint 和敏感输入矩阵 | digest `cb0da948...5534f07b`；重复/重排稳定，prompt/scorer/checksum/seed 逐项变化；fingerprint 专项 `8 passed` |
| 2026-08-11 | worker HTTP 调用接入 endpoint revision 级 Redis QPS 和 concurrency gate | 两实例 20 QPS 间隔、并发峰值 2、80ms lease 恢复均通过；含 run lifecycle 共 integration `6 passed` |
| 2026-08-11 | 新增 execution claim migration `0002`，run 拆为 20–100 样本 Celery chord shard | 100 样本按 2×50 执行；终态 100 execution/attempt/score；重复 dispatch 0 shard；migration drift 与 integration `6 passed` |
| 2026-08-11 | 执行 P1-05 容量矩阵；首次采样发现 semaphore 等待长租约和进度全表 count 热点，修复后从零重跑 | 12/12 正式 run 守恒且 accuracy `1.0`；DB 连接峰值 5–6；API P95 最大 21.19ms；证据 `artifacts/experiments/P1-05-capacity-20260811T100652Z/` |
| 2026-08-11 | 执行 P1-06；首轮发现未来 slot 预留导致唤醒压缩，改为到点原子竞争并重跑 | QPS 10：峰值 11/允许 11；QPS 50：峰值 49/允许 51；两个 run 均成功；PASS 证据 `artifacts/experiments/P1-06-shared-qps-20260811T101907Z/`，失败证据保留在前一目录 |
| 2026-08-11 | 执行 P1-07/P1-08；首轮 50ms timeout 混入 mock 调度抖动，调整为 150ms/并发 4 后重跑 | P1-07：120 样本、210 attempts、95 API/15 parse、accuracy 0.4；P1-08：仅 35 transient 重跑，245 attempts、accuracy 0.75；证据 `artifacts/experiments/P1-07-08-fault-retry-20260811T102324Z/` |
| 2026-08-11 | 执行 P1-09 取消实验，mock 统一延迟 100ms | completed=52 时取消；最终 67 succeeded + 933 cancelled = 1,000；取消后新增请求 0；导出 1,000 行；证据 `artifacts/experiments/P1-09-cancel-20260811T102548Z/` |
| 2026-08-11 | 本轮全量回归并重建运行栈 | unit/contract `50 passed`；integration `6 passed`；Ruff、ESLint、Vite build 通过；所有 `zihao` 服务在线，API healthy，主数据库 migration head `20260811_0002` |
| 2026-08-11 | 固化 P1-09 实现检查点 | commit `fefe516`；未提交 `artifacts/`、`hf_cache/`、环境文件、构建目录或密钥 |
| 2026-08-12 | 启动 P1-10 Worker crash 实验实现 | 使用独立数据库 `evalhub_p1_10_worker_crash` 和 Redis DB 14；真实替换并 SIGKILL `zihao-evalhub-worker`；静态检查与 Compose config 通过，待执行 |
| 2026-08-12 | P1-10 首轮 setup 未进入故障注入 | test 镜像不含 `docker-compose.yml`，配置 hash 读取失败；自动恢复主 worker、删除临时库与状态，改由宿主传入 hash 后从零重跑 |
| 2026-08-12 | 完成 P1-10 Worker crash 正式实验 | completed=50、active claims=150 时 SIGKILL，exit 137；杀死后仍有 120 claims；恢复后 1,000 样本/score/attempt、revision `[1]`、claims=0、进度单调、accuracy `1.0`；at-least-once 产生 16 个重复 HTTP 请求但无重复计分；证据 `artifacts/experiments/P1-10-worker-crash-20260812T020425Z/` |
| 2026-08-12 | P1-10 后全量回归和主栈重建 | unit/contract `50 passed`；integration `6 passed`；Ruff、ESLint、Vite build 通过；API/mock/Web healthy，主库 head `20260811_0002`；临时库与 Redis DB 14 已清理 |
| 2026-08-12 | 固化 P1-10 实现检查点 | commit `579b02e`；证据、HF 缓存、环境文件和密钥未纳入提交 |
| 2026-08-12 | 插入后两卡资源约束并启动 P1-11 | 识别 4× AMD Radeon AI PRO R9700；仅允许物理卡 `2,3`（Unique ID `0x70f6f122856c649c`、`0x1ee7dc67425b7684`）；P1-11 为 CPU/存储实验且不映射 GPU 设备 |
| 2026-08-12 | 完成 P1-11 实验编排 | 新增 6 服务 restart 生命周期证据、17 张 public 表 schema/data 规范化 SHA-256、custom-format pg_dump、隔离库双次 drop/create/restore 和失败自动清理；Ruff、shell syntax、Compose config 通过 |
| 2026-08-12 | 完成 P1-11 正式实验 | 6 服务均原容器重启且健康，主库重启前后 checksum 不变；backup 57,645 bytes、mode `0600`、SHA-256 `5001ac...3b9c`；两次 clean restore 均匹配源库 `399a4d...ccc3`，head `0002`；恢复库已删除；证据 `artifacts/experiments/P1-11-restart-restore-20260812T024953Z/` |
| 2026-08-12 | P1-11 后全量回归和主栈重建 | unit/contract `50 passed`；integration `6 passed`；Ruff、ESLint、Vite build 通过；API/mock/Web healthy；主库 head `0002`；恢复库不存在，HF 仍仅 `.gitkeep` |
| 2026-08-12 | 固化 P1-11 实现检查点 | commit `0d10454`；备份/证据、HF 缓存、环境文件和密钥未纳入提交 |
| 2026-08-12 | 启动 P1-12 Browser E2E | 完成 Endpoint、Dataset、评测向导、Run SSE/刷新、筛选、详情和导出交互审计；采用独立数据库和 Redis DB，浏览器/API/Web/worker 容器均使用 `zihao` 命名且不挂载 GPU 设备 |
| 2026-08-12 | 完成 P1-12 隔离 Browser E2E 编排 | 新增 Playwright `1.62.1` Chromium 镜像、独立库 `evalhub_p1_12_e2e`、Redis DB 13、独立 mock/API/worker/Web 和自动清理；修复 Nginx IPv4 healthcheck 与 Docker context 宿主依赖污染；npm audit 0 漏洞 |
| 2026-08-12 | Browser E2E 发现并修复前端兼容性缺陷 | HTTP 内网 hostname 下 `crypto.randomUUID` 不可用，改为原生优先并用 `crypto.getRandomValues` 生成 UUID v4；修复 Chromium `v` 正则模式下 dataset name HTML pattern 非法问题；ESLint/build 通过 |
| 2026-08-12 | 完成 P1-12 正式实验和全量回归 | Run `195d2439...01bc`；Chromium 桌面 `1440x1000`、移动 `390x844` 共 `2 passed`；100 样本 accuracy `1.0`；SSE 刷新进度单调；样本筛选/详情、JSONL/CSV 导出通过；13 条结构化断言和 trace/截图/HTML report 已归档于 `artifacts/experiments/P1-12-browser-e2e-20260812T094443Z/`；50 unit/contract + 6 integration、Ruff/ESLint/build 通过；E2E 容器无 device mapping，隔离库/Redis/`zihao` artifact 卷均已清理，HF 仍仅 `.gitkeep` |
| 2026-08-12 | 固化 P1-12 实现检查点 | commit `7175e3c`；Playwright 报告、trace、截图、导出文件、HF 缓存、环境文件和密钥未纳入提交 |
| 2026-08-12 | 启动真实 OpenAI-compatible endpoint 接入易用性修复 | 识别公网 endpoint 被 SSRF allowlist 拒绝、登记表单缺少 Model ID、供应商无 `/models` 时前端无法继续三个阻塞点；仅加入精确供应商主机 allowlist，不记录用户 API Key |
| 2026-08-12 | 完成真实 OpenAI-compatible endpoint 接入易用性修复 | 精确域名策略和主栈健康检查通过；`51` unit/contract + `6` integration；Browser E2E 首轮因旧脚本重复点击收起详情失败，修正交互假设并切换真实 API 友好的默认表单后从零重跑 `2 passed`，最终证据 `artifacts/experiments/P1-12-browser-e2e-20260812T103916Z/` |
| 2026-08-12 | 审核并冻结 GSM8K/MMLU 基础数据源 | 仅下载 `openai/gsm8k@740312add88f781978c0658806c59bc2815b9866` 和 `cais/mmlu@c30699e8356da336a370243923dbaf21066bb9fe` 的 README/test parquet；许可证均为 MIT；下载只写入项目 `hf_cache/`，明细见 `hf_cache/download-manifest.json` |
| 2026-08-12 | 生成三套 Native benchmark 数据包 | GSM8K `1,319`、MMLU Lite `570`、MMLU Full `14,042`；Lite 按固定 seed 每 subject 取 10 条且是 Full 严格子集；数据 SHA-256 分别为 `e713b086...d4a53`、`b601ca6d...1e0c`、`d025717f...fea6`，source lock SHA-256 为 `c454b4f7...9f29` |
| 2026-08-12 | 注册并部署 Native benchmark 数据包 | 三版本 API 重复注册均返回 `unchanged`；三数据集预检 `valid=true`、总计 `15,931` 条，并对 Lite+Full 重复选择发出警告；数据页和新建评测向导浏览器 smoke 通过；`58` unit/contract + `6` integration、Ruff、Compose config 和主栈健康检查通过；未创建正式 run，未产生外部模型调用 |
| 2026-08-13 | 审计并修复 P1-13 Secret/SSRF 边界 | 精确域名白名单不再跳过 DNS/IP 禁止网段检查；loopback/link-local/metadata/未授权地址拒绝；worker 每个 shard 出站前重新解析校验；禁止通过 `extra_headers` 注入 Authorization/API-Key/Cookie；create/update/probe 统一返回稳定 `ENDPOINT_POLICY` |
| 2026-08-13 | 完成 P1-13 隔离安全实验 | 独立库 `evalhub_p1_13_security`、Redis DB 12 和 `zihao` 安全容器完成 100 样本凭据流；mock 仅记录 Authorization SHA-256，101 次请求均匹配；API、17 表数据库、Celery payload、Redis、服务日志和证据目录完整 canary 命中均为 0；7 类 SSRF 和 3 类敏感 header 全部拒绝；13 项断言 PASS，证据 `artifacts/experiments/P1-13-secret-ssrf-20260813T082003Z/` |
| 2026-08-13 | P1-13 后全量回归与主栈部署 | unit/contract `69 passed`；integration `6 passed`；Ruff、ESLint、Vite build、Chromium 桌面/移动 `2 passed`；安全实验数据库/Redis DB 12/容器已清理；主 API/worker 以非 root、无 GPU device mapping 运行，现有 Endpoint DNS 策略校验和 Web `10.170.38.103:18080` 均通过 |
| 2026-08-13 | 固化 P1-13 实现检查点 | commit `e6d8d52`；未提交实验证据、HF 缓存、环境文件或实际凭据 |

## 1. 实验目标

本计划把总项目计划中的 Phase 1 和 Phase 2 转换为可执行、可复查的实验。目标不是“页面和接口存在”，而是形成以下证据链：

1. 平台能在全新环境中迁移、启动、运行、取消、恢复和导出。
2. Native Eval Engine 的逐样本结果和聚合指标可由独立实现复算。
3. 1,000 样本和故障注入条件下不丢样本、不重复计分、不泄露密钥。
4. `lm-evaluation-harness` 作为隔离 runner 接入，任务、版本、prompt 和原始结果可追溯。
5. 基线与候选运行只有在协议兼容时才可比较，并给出 paired delta、置信区间和回退样本。
6. 回归规则可被人工、定时任务和 CI 使用，输出稳定的 `PASS/WARN/FAIL/INCOMPARABLE` 结论。

本轮不实现 LLM-as-judge、RAG/Agent 评测、Kubernetes、多租户计费和公共排行榜。

## 2. 实验启动基线与差距（历史快照）

### 2.1 已有基线

- FastAPI、PostgreSQL、Redis、Celery、React/Vite 和 Docker Compose 已运行。
- Endpoint、Dataset、Run API 和 16 张核心表已实现。
- Native `render -> infer -> parse -> score -> aggregate` 已跑通。
- 12 条固定数据集 E2E 已通过，accuracy/macro/micro F1 均为 `1.0`。
- 实验启动时自动化回归为 `31 passed`，Ruff、ESLint 和前端 production build 通过。
- 容器、Compose project 和 volume 均使用 `zihao` 前缀。
- HF 相关目录已映射到仓库内 `hf_cache/`，当前没有下载 HF 内容。

### 2.2 必须在 Phase 1 收口的差距

| 编号 | 启动时状态 | Phase 1 要求 |
|---|---|---|
| G1 | Alembic `0001` 调用当前 ORM 的 `metadata.create_all/drop_all` | 改为历史稳定的显式 migration op；全新库可升级，生产 migration 不依赖未来 ORM |
| G2 | `tests/integration/` 为空，E2E 主要为人工验证 | 建立 PostgreSQL + Redis + Celery 自动化生命周期测试和 Playwright 浏览器 E2E |
| G3 | 并发和 QPS limiter 仅在单个 run/worker 内存中 | Redis endpoint 级共享 semaphore/token bucket，多 run/worker 不突破上限 |
| G4 | 一个 Celery task 承担整个 run | 20–100 样本 shard、幂等 claim、ack-late、失败恢复和公平调度 |
| G5 | 有取消标志和二次检查，但没有自动故障实验 | 验证取消后最多只保留已经 in-flight 的请求；worker kill/restart 后结果一致 |
| G6 | 只验证了 12 样本 | 完成 1,000 样本、并发 32、重复 3 次的容量实验 |
| G7 | 本地管理员 API Key | Phase 1 完成密钥泄露扫描和最小权限边界；OIDC/RBAC 在 Phase 2 完成 |
| G8 | PostgreSQL volume 可持久化，但无恢复演练 | 完成一次备份、清空、恢复和 checksum 核对 |
| G9 | Git 仓库尚无首个受控基线 | 实验前提交代码并打 `mvp-experiment-baseline` tag；所有报告记录 commit SHA |

## 3. 统一实验约束

### 3.1 固定环境

每次实验报告必须记录：

- Git commit SHA、Compose 配置 hash、镜像 digest、migration head。
- Python/Node/PostgreSQL/Redis/Celery 版本。
- endpoint revision、model ID、dataset checksum、protocol ID 和 comparison fingerprint。
- concurrency、QPS、timeout、retry、temperature、top_p、max_tokens、seed。
- 开始/结束 UTC 时间、执行机器 CPU/内存和容器资源限制。

### 3.2 GPU 资源边界

本机共 4 张 AMD Radeon AI PRO R9700。自 2026-08-12 起，所有本项目进程只能使用物理卡 `2,3`；物理卡 `0,1` 禁止使用。统一环境为：

```bash
export EVALHUB_GPU_DEVICES=2,3
export ROCR_VISIBLE_DEVICES=2,3
export HIP_VISIBLE_DEVICES=2,3
export CUDA_VISIBLE_DEVICES=2,3
export GPU_DEVICE_ORDINAL=2,3
```

ROCm Unique ID 分别为 `0x70f6f122856c649c` 和 `0x1ee7dc67425b7684`。CPU-only 服务不挂载 `/dev/kfd` 或 `/dev/dri`；未来新增 GPU runner 时必须显式限制设备并在实验报告记录可见设备，不能仅依赖人员约定。

### 3.3 Hugging Face 下载边界

所有 Harness、tokenizer 和 dataset 下载必须落在项目目录内：

```bash
export PROJECT_ROOT=/home/zihaomu/bigssd_workspace/model_benchmark
export HF_HOME="$PROJECT_ROOT/hf_cache"
export HF_HUB_CACHE="$PROJECT_ROOT/hf_cache/hub"
export HUGGINGFACE_HUB_CACHE="$PROJECT_ROOT/hf_cache/hub"
export HF_DATASETS_CACHE="$PROJECT_ROOT/hf_cache/datasets"
export LM_HARNESS_CACHE_PATH="$PROJECT_ROOT/hf_cache/lm_eval/requests"
```

执行前必须完成数据集许可证和内部使用范围审核。禁止使用默认的 `~/.cache/huggingface`，禁止开启未审核的 `trust_remote_code`。实验结束后输出 `hf_cache/download-manifest.json`，记录 repo、revision、文件 hash、大小和下载时间。

### 3.4 实验证据目录

```text
artifacts/experiments/<experiment-id>/
├─ environment.json
├─ commands-redacted.txt
├─ compose-config.yaml
├─ run-ids.json
├─ metrics.json
├─ samples.jsonl
├─ assertions.json
├─ service-logs-redacted/
└─ report.md
```

`assertions.json` 至少包含 `name`、`expected`、`actual`、`passed` 和证据路径。任何包含 API Key、Authorization header 或数据集敏感原文的日志不得进入报告。

## 4. Phase 1：MVP 收口实验

按当前代码基线估算，Phase 1 剩余工作为 2–3 周。实验编号固定为 `P1-*`，失败项修复后必须使用相同输入重跑。

### 4.1 工作包

| 工作包 | 实现内容 | 主要产物 |
|---|---|---|
| P1-W1 数据与迁移 | 显式 Alembic、约束/索引、migration smoke、备份恢复脚本 | migration、schema snapshot、恢复报告 |
| P1-W2 调度可靠性 | Redis 限流、shard、claim、取消、恢复、重复消息处理 | scheduler tests、故障报告 |
| P1-W3 正确性 | scorer 交叉验证、denominator/error policy、fingerprint | golden fixtures、复算报告 |
| P1-W4 容量 | 1,000 样本、多并发、多 QPS、API 查询 P95 | load report、DB/Redis 指标 |
| P1-W5 UI/E2E | 浏览器主流程、刷新/SSE 恢复、筛选/导出 | Playwright trace、截图、导出文件 |
| P1-W6 安全运维 | secret scan、SSRF、非 root、备份恢复 | security checklist、restore report |

### 4.2 测试数据和 Mock 行为

新增确定性生成器 `tests/fixtures/generate_mvp_dataset.py`，由 seed `20260811` 生成以下数据，不手工复制 1,000 行：

| 数据集 | 样本数 | 用途 |
|---|---:|---|
| `mvp-golden-v1` | 100 | 手工可核对 classification，标签均衡，包含 Unicode/空白边界 |
| `mvp-scale-v1` | 1,000 | 容量、取消、worker restart、SSE 恢复 |
| `mvp-faults-v1` | 120 | 401/429/500/timeout/invalid JSON/schema mismatch/empty/parse error |
| `mvp-numeric-v1` | 100 | numeric tolerance、边界值、非法数字和 denominator policy |

生成器输出 JSONL、manifest、checksum 和预期指标 JSON。Mock OpenAI 增加按 sample ID 确定的 `delay_ms`、`fail_first_n`、HTTP 状态、无效 JSON、空回答和响应 schema 故障，不依赖进程内随机数。

### 4.3 实验矩阵

| 实验 | 操作 | 关键断言 | 通过标准 |
|---|---|---|---|
| P1-01 Clean deploy | 删除测试专用 volumes，从空库 `alembic upgrade head` 后启动 | 表、索引、约束、head 一致 | 连续执行 3 次，无隐式 `create_all`，第二次 upgrade 无变更 |
| P1-02 Dataset/API | UI/API 上传两个版本及错误 fixture | checksum、重复 ID、字段和 immutable version | 正确文件可入库；每种错误返回稳定 code；已引用版本不可修改 |
| P1-03 Scoring oracle | Native 输出与独立 Python/sklearn 复算 | accuracy、macro/micro/weighted F1、numeric、percentile | 所有指标误差 `<= 1e-12`；空类/零除行为固定 |
| P1-04 Fingerprint | 重复运行并逐项改变配置 | 同配置稳定；协议变化可检测 | 重复运行一致；prompt/scorer/dataset checksum/seed 改变均产生新 fingerprint |
| P1-05 Capacity | 1,000 样本，concurrency `1/8/16/32`，每档 3 次 | 样本唯一、进度、连接池、吞吐、API P95 | 3 次均 1,000 terminal；无重复 score；摘要 API P95 `<500ms`；无连接耗尽 |
| P1-06 QPS | 两个 run 同时访问同一 endpoint，QPS `10/50` | 合并流量受 endpoint 限制 | 任意 1 秒滑窗不超过配置值加 1 个调度误差；两个 run 均获得执行机会 |
| P1-07 Fault matrix | 运行 120 条故障集 | 错误分类、attempt、分母和脱敏 | 401 不重试；429/5xx/timeout 按策略重试；每类计数与 fixture 完全一致 |
| P1-08 Retry failures | 首轮注入 transient failure，再解除故障 | 仅 transient 样本重跑，attempt 追加 | 成功样本 attempt 不变；永久错误不重跑；聚合不重复计数 |
| P1-09 Cancel | 1,000 慢样本，完成 50–100 条时取消 | 停止新 shard，保留已完成结果 | 取消后新增请求不超过当时 in-flight 数；最终计数守恒；结果可查询/导出 |
| P1-10 Worker crash | 运行中 `docker kill -s KILL zihao-evalhub-worker` 后重启 | ack-late、claim timeout、幂等恢复 | run 最终 terminal；每个 sample 只有一个有效 score revision；无进度倒退 |
| P1-11 Restart/restore | 重启全部服务；另做 pg_dump/restore | 权威状态在 PostgreSQL | run、sample、metric、audit 行数和 checksum 恢复前后一致 |
| P1-12 Browser E2E | Playwright 完整主流程及刷新 | UI、SSE、筛选、详情、导出 | Chromium 桌面和移动宽度通过；无重叠；刷新后进度恢复；CSV/JSONL 可解析 |
| P1-13 Secret/SSRF | 日志、响应、Celery/Redis payload 扫描；恶意 URL | 密钥不外泄、地址被拒绝 | 0 个 secret 命中；loopback/metadata/越权域名均返回稳定拒绝 code |

### 4.4 P1-05 容量实验细节

每个 concurrency 档位先 warm-up 100 条，再正式运行 1,000 条，重复 3 次。QPS 设置为足够高以测平台开销，同时单独执行 P1-06 验证限流。

记录以下指标：

- run 总耗时、samples/s、worker CPU/RSS、API CPU/RSS。
- PostgreSQL active/idle connections、transaction count、deadlock、lock wait。
- Redis command rate、queue depth、Celery active/reserved task 数。
- sample latency P50/P95/P99、数据库持久化延迟和聚合耗时。
- `/runs`、`/runs/{id}`、`/metrics`、`/samples` 响应时间 P50/P95/P99。

除第 18 节标准外，增加硬性守恒式：

```text
total_samples = pending + running + succeeded + api_error
              + parse_error + score_error + cancelled
completed_samples = succeeded + api_error + parse_error + score_error + cancelled
count(distinct sample_id) = total_samples
```

### 4.5 Phase 1 退出门

Phase 1 只有在以下条件全部满足时关闭：

- [x] P1-01 至 P1-13 全部通过，并保存证据目录。
- [ ] 第 18 节所有功能、正确性和非功能验收逐条映射到实验 ID。
- [ ] `pytest` 包含 unit/contract/integration/E2E，主分支无跳过的关键测试。
- [ ] 干净机器只需 `.env`、secret 和 `docker compose up -d --build` 即可启动。
- [x] 备份恢复和 worker crash 演练至少各成功一次（P1-10、P1-11）。
- [ ] 已知限制、默认资源上限和操作手册完成评审。
- [ ] 创建 `mvp-v1.0.0` tag，并冻结 migration head、镜像 digest 和 golden checksum。

## 5. Phase 2：Benchmark Adapter

### 5.1 版本和隔离策略

首个实现固定 `lm-evaluation-harness==0.4.12`，同时保存 tag/commit SHA。Harness 放入独立镜像和 Celery 队列：

- 镜像：`zihao-evalhub-harness`
- 队列：`harness`
- worker：`zihao-evalhub-harness-worker`
- 容器内 HF 根目录：`/workspace/hf_cache`
- 结果目录：`/var/lib/eval-hub/artifacts/harness/<run-id>/`

API/Native worker 不直接导入 Harness 的完整依赖。Harness runner 使用参数数组启动子进程，不拼接 shell 字符串；task 只能来自版本锁定的 allowlist。API Key 通过进程环境注入，命令和 artifact 中只保存 secret hint。

官方文档说明 OpenAI-compatible API 可使用 `local-completions` 和 `local-chat-completions`；ChatCompletions 仅支持 `generate_until`，MMLU 等 loglikelihood/multiple-choice 任务必须使用可返回 logprobs 的 completions endpoint。平台必须据此做运行前能力拒绝，不能在运行后把生成式选字母结果伪装成 MMLU loglikelihood 分数。

### 5.2 Endpoint 能力矩阵

| Endpoint 能力 | Harness model | 允许 request type | 允许任务示例 | 禁止项 |
|---|---|---|---|---|
| `/v1/chat/completions` | `local-chat-completions` | `generate_until` | `gsm8k`、`ifeval` | MMLU/C-Eval/CMMLU loglikelihood |
| `/v1/completions`，无 logprobs | `local-completions` | `generate_until` | 生成式自定义任务 | `multiple_choice`、`loglikelihood` |
| `/v1/completions`，返回 token logprobs | `local-completions` | `generate_until`、`loglikelihood`、`multiple_choice` | MMLU、C-Eval、CMMLU | 未验证 tokenizer/chat template 的运行 |
| 本地模型 runner（后续） | `hf`/`vllm` | Harness 声明的能力 | 全量 allowlist | 不进入本轮 API adapter 退出门 |

能力探测新增：completions、prompt logprobs、echo、tokenizer identity、最大上下文和 batch。能力为 `unknown` 时，loglikelihood 任务必须拒绝而不是猜测。

### 5.3 Benchmark 套件

先跑 smoke，再跑 qualification，最后建立 full baseline。每个任务保存 resolved YAML 和 SHA256。

| 套件 | 任务 | 协议 | Smoke | Full/Qualification 目标 |
|---|---|---|---:|---|
| `chat-generation-v1` | `gsm8k` | `generate_until`，官方任务默认为 5-shot、temperature 0 | 20 | full test split |
| `chat-instruction-v1` | `ifeval` | `generate_until`，0-shot、strict/loose 指标 | 20 | full split |
| `ll-en-knowledge-v1` | `mmlu_abstract_algebra` -> `mmlu` | loglikelihood multiple choice | 20 | 先选 5 个 subject qualification，再跑完整 `mmlu` |
| `ll-zh-knowledge-v1` | `ceval-valid_computer_network` -> `ceval-valid` | loglikelihood multiple choice | 20 | 完整 validation group |
| `ll-zh-culture-v1` | `cmmlu` 中审核后的 subject -> `cmmlu` | loglikelihood multiple choice | 20 | qualification 后决定是否进入每周 full suite |
| `internal-regression-v1` | 内部冻结数据集 | Native chat generation | 100 | 全量内部 regression set |

注意：`--limit` 只用于 smoke，不用于正式可对比结果。正式 baseline 必须使用完整 split 或固定 sample ID 清单，且不得把两种方式混在同一个比较组。

#### 5.3.1 Native 基础数据包（已提前完成）

为使仅提供标准 `chat/completions` 的 API 可以先完成端到端精度测试，Phase 1 主库已注册以下冻结数据。它们复用 Native Engine，不代表 B2 Harness adapter 已完成。

| 数据集 | 固定上游 revision | 样本数 | 协议与边界 |
|---|---|---:|---|
| `gsm8k-native` | `openai/gsm8k@740312add88f781978c0658806c59bc2815b9866` | 1,319 | test split；0-shot 生成最终数字；取最后一个合法数值评分；不是 Harness 默认 5-shot |
| `mmlu-lite-native` | `cais/mmlu@c30699e8356da336a370243923dbaf21066bb9fe` | 570 | all/test；固定 seed `mmlu-lite-v1-20260812`，57 subject 各 10 条；0-shot 生成 A/B/C/D |
| `mmlu-full-native` | `cais/mmlu@c30699e8356da336a370243923dbaf21066bb9fe` | 14,042 | all/test 完整 57 subject；0-shot 生成 A/B/C/D；不是官方 loglikelihood multiple-choice |

冻结产物位于 `datasets/benchmarks/`，下载源位于项目 `hf_cache/`，来源和产物 hash 记录在 `datasets/benchmarks/source-lock.json`。Lite 的 sample ID 是 Full 的严格子集；创建运行时应二选一，同时选中会在预检阶段提示重复请求。官方 Harness GSM8K 5-shot 和 MMLU loglikelihood 结果必须继续通过 B2-01 至 B2-07 建立，不能与这些 Native 0-shot 指标直接横向比较。

### 5.4 Harness 冻结配置

每个 Harness run 必须保存：

```yaml
runner: lm-evaluation-harness
runner_version: 0.4.12
runner_commit: <git-sha>
model_type: local-chat-completions  # 或 local-completions
model_name: <endpoint-model-id>
endpoint_revision_id: <uuid>
task_names: [gsm8k]
task_config_sha256: {gsm8k: <sha256>}
dataset_revisions: {openai/gsm8k: <resolved-revision>}
dataset_fingerprints: {gsm8k/test: <fingerprint>}
tokenizer: {name: <id>, revision: <revision-or-null>}
apply_chat_template: false
fewshot_as_multiturn: false
num_fewshot: 5
seeds: [0, 1234, 1234, 1234]
generation_kwargs: {temperature: 0.0}
limit: null
log_samples: true
```

平台导入 Harness 输出时，为每个样本建立稳定键：

```text
sample_key = sha256(runner_commit + task_name + task_version
                    + split + source_doc_id + task_config_sha256)
```

Harness 原始 JSON 不覆盖；标准化结果另写 `sample_execution/sample_score`，并保留指向原 artifact 的 URI 和 checksum。

### 5.5 Benchmark 实验

| 实验 | 内容 | 通过标准 |
|---|---|---|
| B2-01 Image/version | 构建独立 harness 镜像并列出 allowlist tasks | 镜像名含 `zihao`；版本/tag/SHA 固定；HF 写入仅发生在项目 `hf_cache/` |
| B2-02 Capability reject | chat endpoint 请求 MMLU；无 logprobs completions 请求 C-Eval | 预检阶段返回 `BENCHMARK_CAPABILITY_MISMATCH`，不创建可误读结果 |
| B2-03 Chat smoke | `gsm8k`、`ifeval` 各 20 条 | Harness CLI 与平台导入后的 sample/metric 完全一致 |
| B2-04 LL smoke | MMLU、C-Eval、CMMLU 代表 subject 各 20 条 | loglikelihood、选择项和 acc 与 Harness 原始输出一致 |
| B2-05 Full baseline | 完整 `gsm8k`、`ifeval`、`mmlu`、`ceval-valid` | 所有 run 冻结配置完整；失败可恢复；结果可导出 |
| B2-06 Repeatability | 相同模型/配置重复 full 或固定 qualification 3 次 | deterministic 任务 sample prediction 和 score 一致；fingerprint 一致 |
| B2-07 Version guard | 改 runner commit 或 task YAML | comparison fingerprint 改变；默认比较被拒绝 |

## 6. Phase 2：运行对比与统计

### 6.1 双指纹模型

当前完整 run hash 会受 endpoint/model 变化影响，无法直接承担“协议兼容性”判断。Phase 2 拆成两个字段：

- `run_fingerprint`：包含 endpoint revision、model、runner、dataset、protocol 和全部参数，用于完整复现。
- `comparison_fingerprint`：排除被比较对象的 endpoint/model identity，保留 runner/version、request type、dataset/sample set、prompt/task YAML、few-shot、parser/scorer、generation 参数和 error/denominator policy。

只有 `comparison_fingerprint` 一致且 sample key 集合一致的 runs 默认可做 paired comparison。管理员强制比较只能得到 `INCOMPARABLE_OVERRIDE`，不得进入 CI quality gate。

### 6.2 Paired regression

对共同样本计算：

```text
d_i = candidate_score_i - baseline_score_i
delta = mean(d_i)
wins   = count(d_i > 0)
losses = count(d_i < 0)
ties   = count(d_i = 0)
```

使用 sample ID 配对 bootstrap：固定 seed `42`，有放回采样 `10,000` 次，报告 delta 的 95% percentile CI。分组指标在组内独立 bootstrap；样本少于 30 的组只显示 point estimate 和 `INSUFFICIENT_SAMPLE`，不用于阻断 gate。

对于 accuracy/exact match，额外输出四格表：`both_pass`、`baseline_only_pass`、`candidate_only_pass`、`both_fail`。API/parse error 按被冻结的 protocol policy 进入或排除，比较时不允许临时改变。

### 6.3 数据集版本 diff

通过稳定 sample ID 输出：

- `added`、`removed`、`unchanged`、`modified`。
- `modified` 细分为 input、reference、metadata 和 protocol-affecting change。
- 旧/新 checksum、行数、标签分布和 group 分布变化。
- reference 变化必须由 maintainer 审核，不允许自动继承旧 baseline。

不同 sample set 的 runs 默认只能展示 unpaired aggregate delta；不能输出 paired wins/losses，也不能通过严格回归 gate。

### 6.4 Regression set

用户可从 comparison 创建不可变 regression set，选择：

- baseline pass / candidate fail。
- candidate API/parse error。
- 指定 group 或 score reason。
- 人工勾选 sample。

Regression set 保存 source run IDs、source dataset versions、sample IDs、创建者和原因。数据内容通过新的 `DatasetVersion` 冻结，不能只保存会随原数据变化的查询条件。

### 6.5 Quality gate

首版 policy 示例：

```yaml
name: default-release-gate-v1
require_comparable: true
minimum_common_samples: 100
rules:
  - metric: accuracy
    min_delta: -0.005
    require_ci_lower_bound_gte: -0.01
    severity: fail
  - metric: macro_f1
    min_delta: -0.01
    severity: fail
  - metric: api_error_rate
    max_absolute: 0.005
    severity: fail
  - metric: latency_success_p95_ms
    max_relative_increase: 0.20
    severity: warn
groups:
  minimum_samples: 30
  rules:
    - metric: accuracy
      min_delta: -0.03
      severity: warn
```

判定顺序：协议兼容性 -> 样本覆盖率 -> 数据完整性 -> 硬错误率 -> 主指标 -> 分组指标 -> 性能指标。任何必需数据缺失都返回 `INCOMPARABLE`，不能默认为通过。

## 7. Phase 2：API、表和页面

### 7.1 最小数据模型扩展

| 对象 | 关键字段 |
|---|---|
| `benchmark_specs` | runner/version、task allowlist、resolved config、capability requirement、spec hash |
| `run_comparisons` | baseline/candidate、comparison fingerprint、common sample count、status、summary JSON |
| `comparison_metrics` | metric/group、baseline/candidate/delta、CI、wins/losses/ties |
| `regression_sets` | name、source comparison、dataset version、selection rule、owner |
| `quality_gate_policies` | versioned policy JSON/YAML、owner、active |
| `quality_gate_results` | policy version、comparison、outcome、rule results |
| `schedules` | cron、run template、baseline policy、enabled、last/next run |
| `service_tokens` | hashed token、scopes、owner、expiry、last_used_at |

所有新增表通过显式 Alembic migration 引入；不修改既有历史 migration。

### 7.2 API

```text
POST /api/v1/benchmark-specs/validate
POST /api/v1/runs                         # 增加 runner=native|harness
POST /api/v1/runs/compare
GET  /api/v1/comparisons/{id}
POST /api/v1/datasets/diff
POST /api/v1/regression-sets/from-comparison
GET  /api/v1/regression-sets
POST /api/v1/quality-gates/evaluate
POST /api/v1/schedules
POST /api/v1/ci/runs
```

CI 创建接口必须支持 `Idempotency-Key` 和 scoped service token。最终返回值包含 run URL、comparison URL、gate outcome 和稳定 machine-readable reason code。

### 7.3 页面

- Compare：baseline/candidate 选择、兼容性、metric delta、CI、wins/losses/ties、分组回退。
- Dataset Diff：样本和标签分布变化、reference 变更审核。
- Regression Sets：来源、版本、样本预览和一键创建运行。
- Schedules/Gates：cron、基线选择、阈值、最近执行和失败原因。
- Admin：worker/queue、endpoint limiter、OIDC/RBAC、retention 和备份状态。

## 8. Phase 2 实验矩阵

| 实验 | 操作 | 通过标准 |
|---|---|---|
| R2-01 Compatible compare | 同一协议下基线/候选各运行一次 | paired 样本数正确；delta/wins/losses/ties 与独立脚本一致 |
| R2-02 Bootstrap oracle | 固定 100 条人工 score pair | 10,000 次、seed 42 的 CI 与离线参考实现一致 |
| R2-03 Incompatible reject | 改 task YAML、few-shot、dataset 或 runner version | 默认比较和 gate 均返回 `INCOMPARABLE` 及具体原因 |
| R2-04 Dataset diff | 构造 add/remove/input/reference/metadata 变化 | 每个 sample 分类唯一且完整；reference 变化触发审核标志 |
| R2-05 Regression set | 从 baseline-only-pass 创建集合 | 新 DatasetVersion checksum 固定；来源 lineage 可追踪 |
| R2-06 Gate outcomes | 构造 pass/warn/fail/缺数据四组 comparison | outcome 和逐规则 reason code 完全符合 policy |
| R2-07 Multi-worker fairness | native/harness 各两个 run，至少两个 worker | endpoint 上限不突破；小任务不会被大任务无限阻塞 |
| R2-08 CI idempotency | 同一 commit/idempotency key 重复触发 | 只创建一个 run；返回同一资源；token scope 正确 |
| R2-09 Schedule | 运行最小周期 schedule 并错过一次窗口 | 不重复补跑；next_run 可预测；禁用后不再入队 |
| R2-10 Retention/backup | 到期 artifact 清理并恢复长期元数据 | 受保留策略约束；audit/metrics 不丢；删除有审计记录 |
| R2-11 RBAC/OIDC | admin/maintainer/viewer/service token 矩阵 | 所有拒绝为 401/403；viewer 不能读取 secret 或修改资源 |

## 9. 实施顺序和时间盒

按当前代码基础估算总计 7–9 周；真实模型 endpoint 和 SSO 依赖若未就绪，不阻塞 mock 和 adapter 开发，但会阻塞对应退出门。

| 周 | 重点 | 退出产物 |
|---|---|---|
| W1 | Git 基线、显式 migration、integration fixture、100/1,000 数据生成器 | P1-01 至 P1-04 |
| W2 | Redis limiter、shard、取消/crash、故障注入 | P1-05 至 P1-10 |
| W3 | Playwright、安全、备份恢复、Phase 1 全验收 | `mvp-v1.0.0` |
| W4 | Harness 镜像、adapter、allowlist、能力探测 | B2-01 至 B2-04 |
| W5 | full benchmark、结果导入、双 fingerprint | B2-05 至 B2-07 |
| W6 | Compare、paired bootstrap、Dataset Diff | R2-01 至 R2-04 |
| W7 | Regression Set、quality gate、Compare UI | R2-05 至 R2-06 |
| W8 | 多 worker/队列、公平性、schedule/CI | R2-07 至 R2-09 |
| W9 | OIDC/RBAC、retention、监控、备份和 Phase 2 验收 | R2-10、R2-11、`benchmark-regression-v1.0.0` |

## 10. Phase 2 退出门

- [ ] Harness v0.4.12 镜像、task allowlist、HF 本地缓存和原始结果留存通过。
- [ ] 至少一个 chat endpoint 完成完整 `gsm8k` 与 `ifeval` baseline。
- [ ] 至少一个 completions + logprobs endpoint 完成完整 `mmlu` 与 `ceval-valid` baseline。
- [ ] Harness 原始指标与平台导入指标逐 task 完全一致。
- [ ] Compare、paired bootstrap、dataset diff、regression set 和 quality gate 实验通过。
- [ ] native/harness 独立队列和两个 worker 公平性实验通过。
- [ ] CI/定时触发具备幂等、scope 和机器可读 gate 结果。
- [ ] OIDC/RBAC、监控、备份恢复和 retention 自动化完成。
- [ ] 创建 `benchmark-regression-v1.0.0` tag，冻结 runner/task/policy 版本。

## 11. 开工前需确认但不阻塞编码的输入

| 输入 | 默认处理 | 阻塞点 |
|---|---|---|
| 内部实际 endpoint/model | 先使用 mock；预留 baseline/candidate 占位 | 阻塞真实模型 benchmark 和 gate 签字 |
| completions + prompt logprobs 能力 | 探测为 unknown 时拒绝 LL task | 阻塞 MMLU/C-Eval/CMMLU |
| 数据集许可与网络下载窗口 | 不自动下载；先完成 allowlist | 阻塞 full benchmark |
| 质量阈值 owner | 先使用第 6.5 节默认 policy | 阻塞生产发布门禁启用 |
| 企业 OIDC issuer/client | 保留配置接口和本地测试 IdP | 阻塞真实 SSO 验收 |
| 数据保留周期 | 默认元数据长期、成功 raw 30 天、失败 raw 180 天 | 阻塞 retention 正式启用 |

## 12. 官方能力依据

- [lm-evaluation-harness v0.4.12 release](https://github.com/EleutherAI/lm-evaluation-harness/releases/tag/v0.4.12)
- [API Guide：local completions/chat 与 loglikelihood 边界](https://github.com/EleutherAI/lm-evaluation-harness/blob/v0.4.12/docs/API_guide.md)
- [CLI Interface：run/validate、cache、output、log_samples 和 seed](https://github.com/EleutherAI/lm-evaluation-harness/blob/v0.4.12/docs/interface.md)
- [Task Guide：YAML、output_type、metric 和版本](https://github.com/EleutherAI/lm-evaluation-harness/blob/v0.4.12/docs/task_guide.md)
- [MMLU multiple-choice task template](https://github.com/EleutherAI/lm-evaluation-harness/blob/v0.4.12/lm_eval/tasks/mmlu/default/_default_template_yaml)
- [C-Eval task说明](https://github.com/EleutherAI/lm-evaluation-harness/blob/v0.4.12/lm_eval/tasks/ceval/README.md)
- [CMMLU task说明](https://github.com/EleutherAI/lm-evaluation-harness/blob/v0.4.12/lm_eval/tasks/cmmlu/README.md)
- [GSM8K generate_until 配置](https://github.com/EleutherAI/lm-evaluation-harness/blob/v0.4.12/lm_eval/tasks/gsm8k/gsm8k.yaml)
- [IFEval generate_until 配置](https://github.com/EleutherAI/lm-evaluation-harness/blob/v0.4.12/lm_eval/tasks/ifeval/ifeval.yaml)
