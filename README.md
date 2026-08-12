# LLM Eval Hub

面向公司内部 OpenAI-compatible 模型 API 的可复现自动化测评平台。当前实现以项目计划中的 Phase 1 vertical slice 为目标，包含 endpoint 管理、数据集导入、异步评测、指标与失败样本查看。

## 本地启动

```bash
cp .env.example .env
# 设置 ADMIN_API_KEY，并用 `python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'` 生成 SECRET_ENCRYPTION_KEY
docker compose up -d --build
```

- Web: <http://localhost:18080>
- API 文档: <http://localhost:18000/docs>
- Mock OpenAI API: <http://localhost:18001/v1>

开发环境默认管理密钥为 `zihao-local-dev-key`，只可用于本机验证。所有容器和持久卷使用 `zihao` 前缀。

## 测试真实 OpenAI-compatible API

1. 打开 Web 的 `Endpoints`，点击“登记 Endpoint”。
2. `Base URL` 填供应商提供的 OpenAI API 根地址；末尾没有 `/v1` 时平台会自动补齐。
3. `Model ID` 填供应商要求的精确模型名，例如 `minicpm-v`。
4. 标准 OpenAI 认证选择 `Bearer`，在密码输入框填写 API Key，然后“保存并探测”。
5. Endpoint 状态变为 `healthy` 后，进入“新建测评”，选择模型、数据集版本和执行参数并创建运行。
6. 运行详情页通过 SSE 显示实时进度，并提供逐样本结果、失败筛选和 CSV/JSONL 导出。

供应商不提供 `/v1/models` 时，探测会使用手工填写的 Model ID。公网域名仍受 `ALLOWED_ENDPOINT_HOSTS` 精确白名单约束；当前 Compose 默认允许 `developer.amd.com.cn`，不要通过放开全部公网 CIDR 绕过 SSRF 防护。

当前 Native Engine 只发送文本 `chat/completions`。现有主库只有 12 条中文意图分类数据，可验证 API 闭环和该数据集 accuracy/F1；图片输入、MMLU/C-Eval 等标准 benchmark 尚未接入，不能把这次结果解释为完整的多模态或通用能力评分。

## Hugging Face 数据目录

项目不会自动下载 Hugging Face 数据。若后续显式同步数据，必须使用仓库内路径：

```bash
export HF_HOME="$PWD/hf_cache"
export HF_HUB_CACHE="$PWD/hf_cache/hub"
export HF_DATASETS_CACHE="$PWD/hf_cache/datasets"
export HUGGINGFACE_HUB_CACHE="$PWD/hf_cache/hub"
```

Compose 已固定同样的容器内映射，下载内容最终落在本仓库 `hf_cache/` 下。
