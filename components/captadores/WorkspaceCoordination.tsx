"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- migração experimental ainda não consta nos tipos gerados */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, Flag, MessageCircle, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationName } from "@/contexts/OrganizationContext";
import { TopSheet } from "@/components/ui/TopSheet";

type Acao = {
  id: string;
  destinatario: "captador" | "organizacao";
  descricao: string;
  prazo: string | null;
  status: "pendente" | "respondida" | "resolvida";
  resposta: string | null;
  created_at: string;
};
type Coordenacao = { situacao: string | null; resultado: string | null; resultado_em: string | null };

function dataCurta(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
}

function CoordCard({ icon: Icon, title, action, children }: {
  icon: LucideIcon; title: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded border bg-white p-4 sm:p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={13} strokeWidth={1.8} className="text-black/30" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-black/45">{title}</h3>
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function WorkspaceCoordination({ atribuicaoId, isGestor, onChange }: {
  atribuicaoId: string;
  isGestor: boolean;
  onChange?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const organizationName = useOrganizationName() || "Organização";
  const [coordenacao, setCoordenacao] = useState<Coordenacao | null>(null);
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [disponivel, setDisponivel] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editandoSituacao, setEditandoSituacao] = useState(false);
  const [situacao, setSituacao] = useState("");
  const [novaAcao, setNovaAcao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [pedindoAcao, setPedindoAcao] = useState(false);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [editandoResultado, setEditandoResultado] = useState(false);
  const [resultado, setResultado] = useState("");
  const meuPapel = isGestor ? "organizacao" : "captador";
  const destinatario = isGestor ? "captador" : "organizacao";

  const carregar = useCallback(async () => {
    const [estado, pedidos] = await Promise.all([
      (supabase as any).rpc("fn_workspace_obter_coordenacao", { p_atribuicao_id: atribuicaoId }),
      (supabase as any).from("workspace_acoes").select("id, destinatario, descricao, prazo, status, resposta, created_at")
        .eq("atribuicao_id", atribuicaoId).order("created_at", { ascending: false }),
    ]);
    if (estado.error || pedidos.error) {
      if (estado.error?.code === "PGRST202" || pedidos.error?.code === "42P01" || pedidos.error?.code === "PGRST205") {
        setDisponivel(false);
      } else {
        setErro(estado.error?.message ?? pedidos.error?.message ?? "Não foi possível carregar a coordenação.");
      }
      return;
    }
    setDisponivel(true);
    setCoordenacao(estado.data as Coordenacao);
    setAcoes((pedidos.data ?? []) as Acao[]);
  }, [atribuicaoId, supabase]);

  useEffect(() => {
    const initial = window.setTimeout(() => { void carregar(); }, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible" && disponivel) void carregar(); }, 20_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [carregar, disponivel]);

  async function executar(nome: string, parametros: Record<string, unknown>, onSuccess: () => void) {
    if (saving) return;
    setSaving(true);
    setErro(null);
    const { error } = await (supabase as any).rpc(nome, parametros);
    setSaving(false);
    if (error) { setErro(error.message); return; }
    onSuccess();
    await carregar();
    onChange?.();
  }

  if (!disponivel) return null;

  const abertas = acoes.filter(acao => acao.status !== "resolvida");
  const resolvidas = acoes.filter(acao => acao.status === "resolvida");
  const nomeDestinatario = destinatario === "captador" ? "o captador" : organizationName;

  return <>
  <div className="space-y-4">
    <CoordCard icon={MessageCircle} title="Situação atual" action={!editandoSituacao && (
      <button type="button" onClick={() => { setSituacao(coordenacao?.situacao ?? ""); setEditandoSituacao(true); }} className="text-[11px] font-semibold text-[#5F4AA8] hover:underline">
        {coordenacao?.situacao ? "Alterar" : "Informar"}
      </button>
    )}>
      {editandoSituacao ? <div className="space-y-2.5">
        <label htmlFor={`situacao-${atribuicaoId}`} className="sr-only">Situação atual</label>
        <textarea id={`situacao-${atribuicaoId}`} autoFocus value={situacao} onChange={e => setSituacao(e.target.value)} maxLength={500} rows={3} className="w-full resize-none rounded border border-black/[.15] px-3 py-2.5 text-[13px] outline-none focus:border-[#5F4AA8] focus:ring-2 focus:ring-[#5F4AA8]/10" placeholder="Em que pé está esta oportunidade?" />
        <div className="flex gap-3"><button type="button" disabled={saving || !situacao.trim()} onClick={() => void executar("fn_workspace_definir_situacao", { p_atribuicao_id: atribuicaoId, p_texto: situacao.trim() }, () => setEditandoSituacao(false))} className="text-[12px] font-semibold text-[#5F4AA8] disabled:opacity-40">Salvar</button><button type="button" onClick={() => setEditandoSituacao(false)} className="text-[12px] text-black/45">Cancelar</button></div>
      </div> : coordenacao?.situacao ? <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-black/75">{coordenacao.situacao}</p> : (
        <div className="rounded border border-dashed px-3.5 py-3" style={{ borderColor: "rgba(13,13,13,.14)" }}>
          <p className="text-[12.5px] text-black/35">Sem situação informada ainda.</p>
        </div>
      )}
    </CoordCard>

    <CoordCard icon={Send} title="Pedidos de ação" action={<span className="text-[11px] tabular-nums text-black/40">{abertas.length} em aberto</span>}>
      {abertas.length === 0 ? (
        <div className="rounded border border-dashed px-3.5 py-3" style={{ borderColor: "rgba(13,13,13,.14)" }}>
          <p className="text-[12.5px] text-black/35">Nenhum pedido em aberto.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {abertas.map(acao => (
            <article key={acao.id} className="rounded border p-3.5" style={{ borderColor: "rgba(13,13,13,.07)", background: "rgba(13,13,13,.012)" }}>
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <p className="text-[11px] font-medium text-black/50">Para {acao.destinatario === "captador" ? "o captador" : organizationName}{acao.prazo ? ` · até ${dataCurta(acao.prazo)}` : ""}</p>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-black/40">{acao.status === "pendente" ? "Aguardando resposta" : "Respondido"}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-black/80">{acao.descricao}</p>
              {acao.resposta && <div className="mt-2.5 border-l-2 border-[#5F4AA8] pl-2.5"><p className="text-[11px] text-black/45">Resposta</p><p className="whitespace-pre-wrap text-[12px] leading-relaxed text-black/70">{acao.resposta}</p></div>}
              {acao.status === "pendente" && acao.destinatario === meuPapel && <div className="mt-2.5 space-y-2">
                <label htmlFor={`resposta-${acao.id}`} className="sr-only">Resposta ao pedido</label>
                <textarea id={`resposta-${acao.id}`} rows={2} maxLength={2000} value={respostas[acao.id] ?? ""} onChange={e => setRespostas(prev => ({ ...prev, [acao.id]: e.target.value }))} placeholder="Responder ao pedido…" className="w-full resize-none rounded border border-black/[.15] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#5F4AA8]" />
                <button type="button" disabled={saving || !respostas[acao.id]?.trim()} onClick={() => void executar("fn_workspace_responder_acao", { p_acao_id: acao.id, p_resposta: respostas[acao.id].trim() }, () => setRespostas(prev => ({ ...prev, [acao.id]: "" })))} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#5F4AA8] disabled:opacity-40"><Send size={12} />Responder</button>
              </div>}
              {acao.status === "respondida" && <button type="button" disabled={saving} onClick={() => void executar("fn_workspace_resolver_acao", { p_acao_id: acao.id }, () => {})} className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-black/55 hover:text-[#5F4AA8] disabled:opacity-40"><Check size={12} />Marcar resolvido</button>}
            </article>
          ))}
        </div>
      )}
      <button type="button" onClick={() => setPedindoAcao(true)} className="mt-3.5 inline-flex h-9 items-center gap-1.5 rounded border border-black/[.14] px-3.5 text-[12px] font-semibold text-black/65 transition hover:border-[#5F4AA8]/40 hover:text-[#5F4AA8]">
        <Send size={12} />Pedir uma ação a {nomeDestinatario}
      </button>
      {resolvidas.length > 0 && <details className="mt-3.5 text-[11px] text-black/55"><summary className="cursor-pointer select-none">Resolvidos ({resolvidas.length})</summary><div className="mt-2 space-y-2">{resolvidas.map(acao => <div key={acao.id} className="rounded border border-black/[.07] px-3 py-2"><p className="font-medium text-black/65">{acao.descricao}</p>{acao.resposta && <p className="mt-1 text-black/50">{acao.resposta}</p>}</div>)}</div></details>}
    </CoordCard>

    <CoordCard icon={Flag} title="Resultado" action={!editandoResultado && (
      <button type="button" onClick={() => { setResultado(coordenacao?.resultado ?? ""); setEditandoResultado(true); }} className="text-[11px] font-semibold text-[#5F4AA8] hover:underline">
        {coordenacao?.resultado ? "Atualizar" : "Registrar"}
      </button>
    )}>
      {editandoResultado ? <div className="space-y-2.5">
        <label htmlFor={`resultado-${atribuicaoId}`} className="sr-only">Resultado</label>
        <textarea id={`resultado-${atribuicaoId}`} autoFocus value={resultado} onChange={e => setResultado(e.target.value)} maxLength={2000} rows={3} placeholder="O que aconteceu?" className="w-full resize-none rounded border border-black/[.15] px-3 py-2.5 text-[13px] outline-none focus:border-[#5F4AA8] focus:ring-2 focus:ring-[#5F4AA8]/10" />
        <div className="flex gap-3"><button type="button" disabled={saving || !resultado.trim()} onClick={() => void executar("fn_workspace_registrar_resultado", { p_atribuicao_id: atribuicaoId, p_texto: resultado.trim() }, () => setEditandoResultado(false))} className="text-[12px] font-semibold text-[#5F4AA8] disabled:opacity-40">Salvar resultado</button><button type="button" onClick={() => setEditandoResultado(false)} className="text-[12px] text-black/45">Cancelar</button></div>
      </div> : coordenacao?.resultado ? <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-black/70">{coordenacao.resultado}</p> : (
        <div className="rounded border border-dashed px-3.5 py-3" style={{ borderColor: "rgba(13,13,13,.14)" }}>
          <p className="text-[12.5px] text-black/35">Ainda não registrado.</p>
        </div>
      )}
    </CoordCard>
    {erro && <p role="alert" className="text-[11px] font-medium text-[#B64545]">{erro}</p>}
  </div>
  {pedindoAcao && <TopSheet titulo={`Pedir uma ação a ${nomeDestinatario}`} onClose={() => setPedindoAcao(false)} footer={close => <>
    <button type="button" onClick={close} className="text-[12px] text-black/50">Cancelar</button>
    <button type="button" disabled={saving || !novaAcao.trim()} onClick={() => void executar("fn_workspace_criar_acao", { p_atribuicao_id: atribuicaoId, p_destinatario: destinatario, p_descricao: novaAcao.trim(), p_prazo: prazo || null }, () => { setNovaAcao(""); setPrazo(""); close(); })} className="inline-flex items-center gap-1.5 rounded bg-[#171717] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40"><Send size={12}/>{saving ? "Enviando…" : "Enviar pedido"}</button>
  </>}>
    <div className="space-y-3">
      <div>
        <label htmlFor={`nova-acao-${atribuicaoId}`} className="mb-1.5 block text-[11px] font-medium text-black/55">O que {nomeDestinatario} precisa fazer?</label>
        <textarea id={`nova-acao-${atribuicaoId}`} autoFocus value={novaAcao} onChange={e => setNovaAcao(e.target.value)} maxLength={2000} rows={4} placeholder="Reunião, documento, aprovação…" className="w-full resize-none rounded border border-black/[.15] px-3 py-2 text-[13px] outline-none focus:border-[#5F4AA8]" />
      </div>
      <label className="block text-[11px] text-black/50">Prazo (opcional)
        <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} className="mt-1 h-9 w-full rounded border border-black/[.15] bg-white px-2 text-[12px] text-black" />
      </label>
      {erro && <p role="alert" className="text-[11px] font-medium text-[#B64545]">{erro}</p>}
    </div>
  </TopSheet>}
  </>;
}
