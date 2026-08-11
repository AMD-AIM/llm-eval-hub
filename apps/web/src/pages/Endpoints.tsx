import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Radar, Server, X } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { StatusBadge } from "../components/StatusBadge";
import type { Endpoint, Model } from "../types";

interface EndpointForm {
  name: string;
  base_url: string;
  auth_type: "bearer" | "api-key-header" | "none";
  api_key: string;
  concurrency_limit: number;
  qps_limit: number;
}

const initialForm: EndpointForm = { name: "", base_url: "http://mock-openai:8001/v1", auth_type: "none", api_key: "", concurrency_limit: 8, qps_limit: 10 };

export function Endpoints() {
  const client = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [expanded, setExpanded] = useState<string | null>(null);
  const endpoints = useQuery({ queryKey: ["endpoints"], queryFn: () => api<Endpoint[]>("/endpoints") });
  const models = useQuery({ queryKey: ["endpoint-models", expanded], queryFn: () => api<Model[]>(`/endpoints/${expanded}/models`), enabled: Boolean(expanded) });
  const create = useMutation({ mutationFn: (payload: EndpointForm) => api<Endpoint>("/endpoints", { method: "POST", body: JSON.stringify({ ...payload, api_key: payload.api_key || null }) }), onSuccess: () => { client.invalidateQueries({ queryKey: ["endpoints"] }); setCreateOpen(false); setForm(initialForm); } });
  const probe = useMutation({ mutationFn: (id: string) => api(`/endpoints/${id}/probe`, { method: "POST", body: JSON.stringify({}) }), onSuccess: () => { client.invalidateQueries({ queryKey: ["endpoints"] }); client.invalidateQueries({ queryKey: ["endpoint-models"] }); } });

  return (
    <div className="page">
      <div className="page-heading"><div><p className="eyebrow">Registry</p><h1>Endpoints</h1><p>登记、探测并管理 OpenAI-compatible 模型服务。</p></div><button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={16} />登记 Endpoint</button></div>
      <section className="section-block">
        {endpoints.data?.length ? <div className="table-wrap"><table><thead><tr><th>名称</th><th>Base URL</th><th>认证</th><th>能力</th><th>状态</th><th className="actions-column">操作</th></tr></thead><tbody>
          {endpoints.data.map((endpoint) => <tr key={endpoint.id} className={expanded === endpoint.id ? "selected-row" : ""}><td><button className="strong-link button-link" onClick={() => setExpanded(expanded === endpoint.id ? null : endpoint.id)}>{endpoint.name}</button><small className="table-sub">owner: {endpoint.owner}</small></td><td><code>{endpoint.base_url}</code></td><td>{endpoint.auth_type}<small className="table-sub">{endpoint.api_key_configured ? `••••${endpoint.secret_hint}` : "无密钥"}</small></td><td><div className="capability-list"><span className={endpoint.capability?.chat_completions ? "cap-on" : "cap-off"}>{endpoint.capability?.chat_completions ? <Check size={12} /> : <X size={12} />} chat</span><span className={endpoint.capability?.usage ? "cap-on" : "cap-off"}>{endpoint.capability?.usage ? <Check size={12} /> : <X size={12} />} usage</span></div></td><td><StatusBadge status={endpoint.status} /></td><td className="actions-column"><button className="icon-button" title="执行能力探测" onClick={() => probe.mutate(endpoint.id)} disabled={probe.isPending}>{probe.isPending && probe.variables === endpoint.id ? <Loader2 className="spin" size={17} /> : <Radar size={17} />}</button></td></tr>)}
        </tbody></table></div> : <EmptyState icon={Server} title="尚未登记 Endpoint" detail="登记一个模型 API，并执行连通性与能力探测。" action={<button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={16} />登记 Endpoint</button>} />}
        {expanded && <div className="detail-drawer"><div className="section-heading"><div><h3>可用模型</h3><p>发现结果与手工登记模型</p></div></div>{models.isLoading ? <div className="loading-line"><Loader2 className="spin" size={16} />加载中</div> : <div className="model-list">{models.data?.map((model) => <span key={model.id}>{model.model_name}<small>{model.source}</small></span>)}{!models.data?.length && <span className="muted">尚未发现模型，请先执行探测。</span>}</div>}</div>}
      </section>
      <Modal title="登记 Endpoint" open={createOpen} onClose={() => setCreateOpen(false)}>
        <form className="form-stack" onSubmit={(event) => { event.preventDefault(); create.mutate(form); }}>
          <div className="form-grid"><label>名称<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Qwen production" /></label><label>认证方式<select value={form.auth_type} onChange={(e) => setForm({ ...form, auth_type: e.target.value as EndpointForm["auth_type"] })}><option value="bearer">Bearer</option><option value="api-key-header">api-key header</option><option value="none">无认证</option></select></label></div>
          <label>Base URL<input required value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="http://model-host:8000/v1" /></label>
          {form.auth_type !== "none" && <label>API Key<input type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} autoComplete="new-password" /></label>}
          <div className="form-grid"><label>并发上限<input type="number" min="1" max="256" value={form.concurrency_limit} onChange={(e) => setForm({ ...form, concurrency_limit: Number(e.target.value) })} /></label><label>QPS 上限<input type="number" min="0.1" step="0.1" value={form.qps_limit} onChange={(e) => setForm({ ...form, qps_limit: Number(e.target.value) })} /></label></div>
          {create.error && <div className="form-error">{create.error.message}</div>}
          <div className="form-actions"><button className="quiet-button" type="button" onClick={() => setCreateOpen(false)}>取消</button><button className="primary-button" disabled={create.isPending}>{create.isPending && <Loader2 className="spin" size={15} />}保存</button></div>
        </form>
      </Modal>
    </div>
  );
}

