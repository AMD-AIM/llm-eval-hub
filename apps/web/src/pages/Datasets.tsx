import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, FileCheck2, Loader2, Plus, Upload } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import type { Dataset, DatasetVersion } from "../types";

export function Datasets() {
  const client = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<Dataset | null>(null);
  const [form, setForm] = useState({ name: "", display_name: "", owner: "ai-platform", sensitivity: "internal", description: "" });
  const [manifest, setManifest] = useState<File | null>(null);
  const [data, setData] = useState<File | null>(null);
  const datasets = useQuery({ queryKey: ["datasets"], queryFn: () => api<Dataset[]>("/datasets") });
  const create = useMutation({ mutationFn: () => api<Dataset>("/datasets", { method: "POST", body: JSON.stringify(form) }), onSuccess: () => { client.invalidateQueries({ queryKey: ["datasets"] }); setCreateOpen(false); setForm({ name: "", display_name: "", owner: "ai-platform", sensitivity: "internal", description: "" }); } });
  const upload = useMutation({ mutationFn: async () => { if (!uploadTarget || !manifest || !data) throw new Error("Select both the manifest and JSONL files"); const body = new FormData(); body.set("manifest_file", manifest); body.set("data_file", data); return api<DatasetVersion>(`/datasets/${uploadTarget.id}/versions`, { method: "POST", body }); }, onSuccess: () => { client.invalidateQueries({ queryKey: ["datasets"] }); setUploadTarget(null); setManifest(null); setData(null); } });

  return (
    <div className="page">
      <div className="page-heading"><div><p className="eyebrow">Registry</p><h1>Datasets</h1><p>Immutable versions, checksum validation, and protocol checks.</p></div><button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={16} />New Dataset</button></div>
      <section className="section-block">
        {datasets.data?.length ? <div className="dataset-list">{datasets.data.map((dataset) => <article className="dataset-row" key={dataset.id}><div className="dataset-symbol"><Database size={19} /></div><div className="dataset-main"><div className="dataset-title"><strong>{dataset.display_name}</strong><code>{dataset.name}</code><span className="sensitivity">{dataset.sensitivity}</span></div><p>{dataset.description || "No description"}</p><div className="version-list">{dataset.versions.length ? dataset.versions.map((version) => <span key={version.id}><FileCheck2 size={13} /><strong>{version.version}</strong><small>{version.row_count} samples · {version.manifest_json.protocol.id}</small><code>{version.checksum.slice(0, 10)}</code></span>) : <span className="muted">No versions available</span>}</div></div><button className="quiet-button" onClick={() => setUploadTarget(dataset)}><Upload size={15} />Upload Version</button></article>)}</div> : <EmptyState icon={Database} title="No datasets" detail="Create a dataset, then upload its YAML manifest and JSONL data file." action={<button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={16} />New Dataset</button>} />}
      </section>
      <Modal title="New Dataset" open={createOpen} onClose={() => setCreateOpen(false)}><form className="form-stack" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}><div className="form-grid"><label>Identifier<input required pattern="[a-z0-9](?:[a-z0-9]|-){1,62}" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="internal-support-intent" /></label><label>Display Name<input required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></label></div><div className="form-grid"><label>Owner<input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></label><label>Sensitivity<select value={form.sensitivity} onChange={(e) => setForm({ ...form, sensitivity: e.target.value })}><option value="internal">internal</option><option value="confidential">confidential</option><option value="restricted">restricted</option></select></label></div><label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></label>{create.error && <div className="form-error">{create.error.message}</div>}<div className="form-actions"><button className="quiet-button" type="button" onClick={() => setCreateOpen(false)}>Cancel</button><button className="primary-button" disabled={create.isPending}>{create.isPending && <Loader2 className="spin" size={15} />}Create</button></div></form></Modal>
      <Modal title={`Upload Version · ${uploadTarget?.display_name || ""}`} open={Boolean(uploadTarget)} onClose={() => setUploadTarget(null)}><form className="form-stack" onSubmit={(e) => { e.preventDefault(); upload.mutate(); }}><label className="file-field"><span>YAML Manifest</span><input type="file" accept=".yaml,.yml,text/yaml" required onChange={(e) => setManifest(e.target.files?.[0] || null)} /><small>{manifest?.name || "Select manifest.yaml"}</small></label><label className="file-field"><span>JSONL Data</span><input type="file" accept=".jsonl,application/x-ndjson" required onChange={(e) => setData(e.target.files?.[0] || null)} /><small>{data?.name || "Select data.jsonl"}</small></label>{upload.error && <div className="form-error">{upload.error.message}</div>}<div className="form-actions"><button className="quiet-button" type="button" onClick={() => setUploadTarget(null)}>Cancel</button><button className="primary-button" disabled={upload.isPending}>{upload.isPending && <Loader2 className="spin" size={15} />}Validate and Upload</button></div></form></Modal>
    </div>
  );
}
