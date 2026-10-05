"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, Filter, RefreshCw, Search } from "lucide-react";
import { Select } from "@/components/ui/Select";

type Actor = { full_name: string | null; email: string | null } | null;
type AuditLog = {
  id: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor: Actor;
  target: Actor;
};

const ACTIONS = ["create", "update", "delete", "impersonate", "view", "approve", "reject"];
const RESOURCES = ["patrocinador", "usuario", "pedido", "blog", "organizacao", "sistema"];
const ACTION_LABELS: Record<string, string> = {
  create: "Criou", update: "Atualizou", delete: "Excluiu", impersonate: "Acessou como",
  view: "Visualizou", approve: "Aprovou", reject: "Rejeitou",
};
const RESOURCE_LABELS: Record<string, string> = {
  patrocinador: "Patrocinador", usuario: "Usuário", pedido: "Pedido", blog: "Blog", organizacao: "Organização", sistema: "Sistema",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function displayPerson(person: Actor, fallbackId: string | null) {
  return person?.full_name || person?.email || (fallbackId ? `${fallbackId.slice(0, 8)}…` : "Sistema");
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ q: "", action: "", resource: "", from: "", to: "" });
  const [applied, setApplied] = useState(filters);
  const limit = 25;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  async function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    Object.entries(applied).forEach(([key, value]) => { if (value) params.set(key, value); });
    try {
      const response = await fetch(`/api/admin/audit?${params.toString()}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os logs.");
      setLogs(body.data ?? []);
      setTotal(body.total ?? 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [page, applied]); // eslint-disable-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    setApplied(filters);
  }

  function clearFilters() {
    const empty = { q: "", action: "", resource: "", from: "", to: "" };
    setFilters(empty);
    setPage(1);
    setApplied(empty);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-[#0D0D0D]"><ClipboardList size={19} className="text-[#7259B5]" /> Logs administrativos</h1>
          <p className="mt-1 text-sm text-black/40">Histórico resumido das ações realizadas no backoffice.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-1.5 self-start rounded border border-black/[.12] bg-white px-3 py-2 text-[0.6875rem] font-semibold text-black/50 transition hover:bg-black/[.03] disabled:opacity-40"><RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Atualizar</button>
      </div>

      <form onSubmit={submit} className="mb-5 rounded border border-black/[.08] bg-white p-4">
        <div className="mb-3 flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-[.12em] text-black/35"><Filter size={12} /> Filtros</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr_auto]">
          <label className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/25" /><input value={filters.q} onChange={event => setFilters(current => ({ ...current, q: event.target.value }))} placeholder="Buscar no resumo ou ID" className="h-9 w-full rounded border border-black/[.12] pl-9 pr-3 text-[0.75rem] outline-none focus:border-[#7259B5]" /></label>
          <Select block={false} value={filters.action} onChange={event => setFilters(current => ({ ...current, action: event.target.value }))} className="h-9 rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black/60 outline-none focus:border-[#7259B5]"><option value="">Todas as ações</option>{ACTIONS.map(action => <option key={action} value={action}>{ACTION_LABELS[action]}</option>)}</Select>
          <Select block={false} value={filters.resource} onChange={event => setFilters(current => ({ ...current, resource: event.target.value }))} className="h-9 rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black/60 outline-none focus:border-[#7259B5]"><option value="">Todos os recursos</option>{RESOURCES.map(resource => <option key={resource} value={resource}>{RESOURCE_LABELS[resource]}</option>)}</Select>
          <input type="date" value={filters.from} onChange={event => setFilters(current => ({ ...current, from: event.target.value }))} className="h-9 rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black/55 outline-none focus:border-[#7259B5]" aria-label="Data inicial" />
          <input type="date" value={filters.to} onChange={event => setFilters(current => ({ ...current, to: event.target.value }))} className="h-9 rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black/55 outline-none focus:border-[#7259B5]" aria-label="Data final" />
          <div className="flex gap-2"><button type="submit" className="h-9 rounded bg-[#7259B5] px-3 text-[0.6875rem] font-semibold text-white hover:opacity-90">Aplicar</button><button type="button" onClick={clearFilters} className="h-9 rounded px-2 text-[0.6875rem] font-medium text-black/35 hover:text-black/60">Limpar</button></div>
        </div>
      </form>

      {error && <div className="mb-4 rounded border border-[#D94E4E]/20 bg-white px-4 py-3 text-[0.75rem] text-[#991B1B]">{error}</div>}

      <div className="overflow-hidden rounded border border-black/[.08] bg-white">
        <div className="flex items-center justify-between border-b bg-[#FAFAFA] px-4 py-3" style={{ borderColor: "rgba(13,13,13,.06)" }}><span className="text-[0.6875rem] font-semibold text-black/45">{total.toLocaleString("pt-BR")} evento{total === 1 ? "" : "s"}</span><span className="text-[0.625rem] text-black/30">Página {page} de {pageCount}</span></div>
        {loading ? <div className="space-y-3 p-5"><div className="h-12 animate-pulse rounded bg-black/[.04]" /><div className="h-12 animate-pulse rounded bg-black/[.04]" /><div className="h-12 animate-pulse rounded bg-black/[.04]" /></div> : logs.length === 0 ? <div className="py-16 text-center"><ClipboardList size={28} className="mx-auto mb-2 text-black/15" /><p className="text-sm text-black/35">Nenhum evento encontrado</p><p className="mt-1 text-[0.6875rem] text-black/25">Os próximos eventos administrativos aparecerão aqui.</p></div> : (
          <div className="divide-y divide-black/[.05]">
            {logs.map(log => <div key={log.id} className="px-4 py-3.5 transition hover:bg-black/[.015]">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:gap-4">
                <div className="w-36 shrink-0"><p className="text-[0.6875rem] text-black/45">{formatDate(log.created_at)}</p><p className="mt-1 truncate text-[0.625rem] text-black/25" title={displayPerson(log.actor, log.actor_user_id)}>{displayPerson(log.actor, log.actor_user_id)}</p></div>
                <div className="flex min-w-0 flex-1 items-start gap-3"><span className="shrink-0 rounded border border-[#7259B5]/30 bg-white px-2 py-1 text-[0.625rem] font-semibold text-[#7259B5]">{ACTION_LABELS[log.action] ?? log.action}</span><div className="min-w-0"><p className="text-[0.75rem] font-medium text-black/75">{log.summary}</p><p className="mt-1 text-[0.625rem] text-black/35">{RESOURCE_LABELS[log.resource_type] ?? log.resource_type}{log.resource_id ? ` · ${log.resource_id.slice(0, 12)}…` : ""}{log.target ? ` · alvo: ${displayPerson(log.target, log.target_user_id)}` : ""}</p></div></div>
                {Object.keys(log.metadata ?? {}).length > 0 && <details className="shrink-0"><summary className="cursor-pointer text-[0.625rem] font-medium text-black/30 hover:text-black/60">detalhes</summary><pre className="mt-2 max-w-[17.5rem] overflow-auto rounded bg-black/[.03] p-2 text-[0.5625rem] text-black/50">{JSON.stringify(log.metadata, null, 2)}</pre></details>}
              </div>
            </div>)}
          </div>
        )}
        <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: "rgba(13,13,13,.06)" }}><span className="text-[0.625rem] text-black/30">Exibindo até {limit} por página</span><div className="flex gap-1"><button disabled={page <= 1 || loading} onClick={() => setPage(current => current - 1)} className="rounded border border-black/[.1] p-1.5 text-black/35 hover:bg-black/[.03] disabled:opacity-30"><ChevronLeft size={13} /></button><button disabled={page >= pageCount || loading} onClick={() => setPage(current => current + 1)} className="rounded border border-black/[.1] p-1.5 text-black/35 hover:bg-black/[.03] disabled:opacity-30"><ChevronRight size={13} /></button></div></div>
      </div>
    </div>
  );
}
