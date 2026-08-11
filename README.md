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

## Hugging Face 数据目录

项目不会自动下载 Hugging Face 数据。若后续显式同步数据，必须使用仓库内路径：

```bash
export HF_HOME="$PWD/hf_cache"
export HF_HUB_CACHE="$PWD/hf_cache/hub"
export HF_DATASETS_CACHE="$PWD/hf_cache/datasets"
export HUGGINGFACE_HUB_CACHE="$PWD/hf_cache/hub"
```

Compose 已固定同样的容器内映射，下载内容最终落在本仓库 `hf_cache/` 下。
