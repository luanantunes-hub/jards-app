"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Clock3, Inbox } from "lucide-react";
import { Select } from "@/components/ui/Select";

type PedidoStatus = "pendente" | "entregue";

type Pedido = {
  id: string;
  created_at: string;
  updated_at: string;
  concluida_em: string | null;
  solicitante_id: string;
  empresa_id: string;
  organization_id: string;
  status: PedidoStatus;
  user_nome: string | null;
  user_email: string | null;
  empresa_nome: string | null;
  tem_detalhe: boolean;
};

function fmtDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPedidosPage() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/admin/pedidos", { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(body.error ?? "Não foi possível carregar os pedidos");
      return;
    }
    setPedidos(body.pedidos ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function changeStatus(pedido: Pedido, status: PedidoStatus) {
    if (pedido.status === status || changingId) return;
    const previous = pedido.status;
    setChangingId(pedido.id);
    setError(null);
    setPedidos((rows) => rows.map((row) => row.id === pedido.id ? { ...row, status } : row));

    const response = await fetch("/api/admin/pedidos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pedido.id, status }),
    });
    const body = await response.json().catch(() => ({}));
    setChangingId(null);

    if (!response.ok) {
      setPedidos((rows) => rows.map((row) => row.id === pedido.id ? { ...row, status: previous } : row));
      setError(body.error ?? "Não foi possível atualizar o pedido");
      return;
    }

    setPedidos((rows) => rows.map((row) => row.id === pedido.id ? {
      ...row,
      status: body.status,
      updated_at: body.updated_at ?? row.updated_at,
      concluida_em: body.concluida_em ?? null,
      tem_detalhe: status === "entregue" ? true : row.tem_detalhe,
    } : row));
  }

  const pendentes = pedidos.filter((pedido) => pedido.status === "pendente").length;
  const entregues = pedidos.length - pendentes;

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[#7259B5] border-t-transparent" /></div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0D0D0D]">Pedidos de pesquisa</h1>
          <p className="mt-1 text-sm text-black/40">A entrega libera o patrocinador e notifica o solicitante dentro da Jards.</p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 rounded border border-[#B07A14]/20 bg-white px-2.5 py-1.5 font-medium text-[#9A6910]"><Clock3 size={12} />{pendentes} pendentes</span>
          <span className="inline-flex items-center gap-1.5 rounded border border-[#2E8932]/20 bg-white px-2.5 py-1.5 font-medium text-[#2E8932]"><CheckCircle2 size={12} />{entregues} entregues</span>
        </div>
      </header>

      {error && <p role="alert" className="mb-4 rounded border border-[#D94E4E]/25 bg-white px-3 py-2 text-xs text-[#D94E4E]">{error}</p>}

      {!pedidos.length ? (
        <div className="flex flex-col items-center justify-center rounded border border-black/[.08] bg-white py-24 text-center">
          <Inbox size={32} className="mb-3 text-black/20" />
          <p className="text-sm text-black/40">Nenhum pedido de pesquisa ainda</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-black/[.08] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead><tr className="border-b border-black/[.07] bg-black/[.015]">
                {['Solicitante', 'Patrocinador', 'Solicitado em', 'Entregue em', 'Status', 'Ação'].map((label) => <th key={label} className="px-4 py-3 text-[10px] font-medium uppercase tracking-[.06em] text-black/30">{label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-black/[.06]">
                {pedidos.map((pedido) => {
                  const delivered = pedido.status === "entregue";
                  return (
                    <tr key={pedido.id} className="transition hover:bg-black/[.018]">
                      <td className="px-4 py-4"><p className="text-[12px] font-semibold text-black/70">{pedido.user_nome ?? "Usuário"}</p><p className="mt-0.5 text-[10px] text-black/35">{pedido.user_email ?? pedido.solicitante_id.slice(0, 8)}</p></td>
                      <td className="px-4 py-4"><p className="text-[12px] font-semibold text-black/70">{pedido.empresa_nome ?? "—"}</p><p className="mt-0.5 text-[10px] text-black/30">{pedido.tem_detalhe ? "Detalhes disponíveis" : "Em preparação"}</p></td>
                      <td className="px-4 py-4 text-[11px] tabular-nums text-black/40">{fmtDate(pedido.created_at)}</td>
                      <td className="px-4 py-4 text-[11px] tabular-nums text-black/40">{fmtDate(pedido.concluida_em)}</td>
                      <td className="px-4 py-4">
                        <Select
                          value={pedido.status}
                          disabled={changingId === pedido.id}
                          onChange={(event) => void changeStatus(pedido, event.target.value as PedidoStatus)}
                          aria-label={`Status do pedido de ${pedido.empresa_nome ?? "patrocinador"}`}
                          className="rounded border bg-white px-2.5 py-1.5 text-[11px] font-semibold outline-none transition hover:bg-black/[.04] disabled:opacity-45"
                          style={{ borderColor: delivered ? "rgba(46,137,50,.28)" : "rgba(176,122,20,.28)", color: delivered ? "#2E8932" : "#9A6910" }}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="entregue">Entregue</option>
                        </Select>
                      </td>
                      <td className="px-4 py-4">
                        <button type="button" onClick={() => router.push(`/admin/patrocinadores/${pedido.empresa_id}`)} className="inline-flex items-center gap-1 rounded border border-[#7259B5]/25 bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#7259B5] transition hover:bg-black/[.04]">Abrir patrocinador <ArrowRight size={11} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
