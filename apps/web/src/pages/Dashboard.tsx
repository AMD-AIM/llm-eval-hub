import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Server, TimerReset } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import type { Endpoint, Run } from "../types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function Dashboard() {
  const runs = useQuery({ queryKey: ["runs"], queryFn: () => api<Run[]>("/runs?limit=8"), refetchInterval: 5000 });
  const endpoints = useQuery({ queryKey: ["endpoints"], queryFn: () => api<Endpoint[]>("/endpoints") });
  const running = runs.data?.filter((run) => ["QUEUED", "PREPARING", "RUNNING", "AGGREGATING"].includes(run.status)).length || 0;
  const healthy = endpoints.data?.filter((endpoint) => endpoint.status === "healthy").length || 0;
  const failed = runs.data?.filter((run) => run.status === "FAILED").length || 0;

  return (
    <div className="page">
      <div className="page-heading">
        <div><p className="eyebrow">Workspace</p><h1>Evaluation Overview</h1><p>Endpoint health, task progress, and recent results.</p></div>
        <Link className="primary-button" to="/evaluations/new">New Evaluation <ArrowRight size={16} /></Link>
      </div>
      <section className="metric-grid">
        <article className="metric-card"><span className="metric-icon green"><CheckCircle2 size={18} /></span><div><span>Healthy Endpoints</span><strong>{healthy}<small> / {endpoints.data?.length || 0}</small></strong></div></article>
        <article className="metric-card"><span className="metric-icon blue"><TimerReset size={18} /></span><div><span>Active Runs</span><strong>{running}</strong></div></article>
        <article className="metric-card"><span className="metric-icon red"><AlertTriangle size={18} /></span><div><span>Recent Failures</span><strong>{failed}</strong></div></article>
        <article className="metric-card"><span className="metric-icon amber"><Clock3 size={18} /></span><div><span>Recent Runs</span><strong>{runs.data?.length || 0}</strong></div></article>
      </section>
      <section className="section-block">
        <div className="section-heading"><div><h2>Recent Runs</h2><p>Status refreshes every 5 seconds</p></div><Link className="text-link" to="/runs">View all <ArrowRight size={14} /></Link></div>
        {runs.data?.length ? (
          <div className="table-wrap"><table><thead><tr><th>Run</th><th>Model</th><th>Progress</th><th>Status</th><th>Created</th></tr></thead><tbody>
            {runs.data.map((run) => { const total = run.datasets.reduce((sum, item) => sum + item.total_samples, 0); const completed = run.datasets.reduce((sum, item) => sum + item.completed_samples, 0); return (
              <tr key={run.id}><td><Link className="strong-link" to={`/runs/${run.id}`}>{run.name}</Link><small className="table-sub">{run.protocol_fingerprint.slice(0, 10)}</small></td><td>{run.run_spec_json.model_name}</td><td><div className="progress-cell"><div className="progress-track"><span style={{ width: `${total ? (completed / total) * 100 : 0}%` }} /></div><small>{completed}/{total}</small></div></td><td><StatusBadge status={run.status} /></td><td>{formatDate(run.created_at)}</td></tr>
            ); })}
          </tbody></table></div>
        ) : <EmptyState icon={TimerReset} title="No runs yet" detail="Create your first evaluation to see its progress and results here." action={<Link className="primary-button" to="/evaluations/new">New Evaluation</Link>} />}
      </section>
      <section className="section-block">
        <div className="section-heading"><div><h2>Endpoint Status</h2><p>Latest capability probe results</p></div><Link className="text-link" to="/endpoints">Manage <ArrowRight size={14} /></Link></div>
        <div className="endpoint-strip">
          {endpoints.data?.map((endpoint) => <article key={endpoint.id}><span className={`health-light ${endpoint.status}`} /><div><strong>{endpoint.name}</strong><small>{endpoint.base_url}</small></div><StatusBadge status={endpoint.status} /></article>)}
          {!endpoints.data?.length && <EmptyState icon={Server} title="No endpoints registered" detail="Register a model API to run a capability probe." />}
        </div>
      </section>
    </div>
  );
}
