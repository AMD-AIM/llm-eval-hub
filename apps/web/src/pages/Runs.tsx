import { useQuery } from "@tanstack/react-query";
import { Activity, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import type { Run } from "../types";

const statuses = ["ALL", "QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"];

export function Runs() {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const runs = useQuery({ queryKey: ["runs", filter], queryFn: () => api<Run[]>(`/runs?limit=100${filter === "ALL" ? "" : `&status=${filter}`}`), refetchInterval: 5000 });
  const visible = runs.data?.filter((run) => run.name.toLowerCase().includes(search.toLowerCase())) || [];
  return (
    <div className="page">
      <div className="page-heading"><div><p className="eyebrow">History</p><h1>Runs</h1><p>Frozen configurations, execution status, and protocol fingerprints.</p></div><Link className="primary-button" to="/evaluations/new">New Evaluation</Link></div>
      <div className="filterbar"><div className="segmented">{statuses.map((status) => <button key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>{status}</button>)}</div><label className="search-field"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search runs" /></label></div>
      <section className="section-block">{visible.length ? <div className="table-wrap"><table><thead><tr><th>Run</th><th>Model</th><th>Datasets</th><th>Progress</th><th>Status</th><th>Created By</th><th>Created</th></tr></thead><tbody>{visible.map((run) => { const total = run.datasets.reduce((sum, item) => sum + item.total_samples, 0); const completed = run.datasets.reduce((sum, item) => sum + item.completed_samples, 0); return <tr key={run.id}><td><Link className="strong-link" to={`/runs/${run.id}`}>{run.name}</Link><small className="table-sub mono">{run.protocol_fingerprint.slice(0, 12)}</small></td><td>{run.run_spec_json.model_name}</td><td>{run.datasets.length}</td><td><div className="progress-cell"><div className="progress-track"><span style={{ width: `${total ? completed / total * 100 : 0}%` }} /></div><small>{completed}/{total}</small></div></td><td><StatusBadge status={run.status} /></td><td>{run.created_by}</td><td>{new Date(run.created_at).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td></tr>; })}</tbody></table></div> : <EmptyState icon={Activity} title="No matching runs" detail="Adjust the filters or create a new evaluation." />}</section>
    </div>
  );
}
