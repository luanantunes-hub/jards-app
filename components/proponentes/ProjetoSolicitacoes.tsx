"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- RPC experimental ainda não consta nos tipos gerados */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationName } from "@/contexts/OrganizationContext";
import { TopSheet } from "@/components/ui/TopSheet";

type Acao = {
  id: string;
  destinatario: "proponente" | "organizacao";
  descricao: string;
  prazo: string | null;
  status: "pendente" | "respondida" | "resolvida";
  resposta: string | null;
  created_at: string;
};

function dataCurta(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
}

export function ProjetoSolicitacoes({ projetoId, isOrganizacao, proponenteNome }: {
  projetoId: string;
  isOrganizacao: boolean;
  proponenteNome: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const organizationName = useOrganizationName() || "a organização";
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pedindoAcao, setPedindoAcao] = useState(false);
  const [novaAcao, setNovaAcao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [respostas, setRespostas] = useState<Record<string, string>>({});

  const meuPapel: Acao["destinatario"] = isOrganizacao ? "organizacao" : "proponente";
  const destinatario: Acao["destinatario"] = isOrganizacao ? "proponente" : "organizacao";
  const nomeDestinatario = (dest: Acao["destinatario"]) => (dest === "proponente" ? proponenteNome : organizationName);

  const carregar = useCallback(async () => {
    const { data, error } = await (supabase as any).from("projeto_workspace_acoes")
      .select("id, destinatario, descricao, prazo, status, resposta, created_at")
      .eq("projeto_id", projetoId).order("created_at", { ascending: false });
    if (error) { setErro(error.message); return; }
    setAcoes((data ?? []) as Acao[]);
  }, [projetoId, supabase]);

  useEffect(() => {
    const initial = window.setTimeout(() => { void carregar(); }, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void carregar(); }, 20_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [carregar]);

  async function executar(nome: string, parametros: Record<string, unknown>, onSuccess: () => void) {
    if (saving) return;
    setSaving(true);
    setErro(null);
    const { error } = await (supabase as any).rpc(nome, parametros);
    setSaving(false);
    if (error) { setErro(error.message); return; }
    onSuccess();
    await carregar();
  }

  const abertas = acoes.filter(acao => acao.status !== "resolvida");
  const resolvidas = acoes.filter(acao => acao.status === "resolvida");

  return <>
    <section className="rounded border bg-white p-4 sm:p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-black/30"><Send size={13} strokeWidth={1.8} /><h3 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-black/45">Solicitações</h3></div>
        <span className="text-[0.6875rem] tabular-nums text-black/40">{abertas.length} em aberto</span>
      </div>
      <div className="mt-3">
        {abertas.length === 0 ? (
          <div className="rounded border border-dashed px-3.5 py-3" style={{ borderColor: "rgba(13,13,13,.14)" }}>
            <p className="text-[0.78125rem] text-black/35">Nenhuma solicitação em aberto.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {abertas.map(acao => (
              <article key={acao.id} className="rounded border p-3.5" style={{ borderColor: "rgba(13,13,13,.07)", background: "rgba(13,13,13,.012)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.6875rem] font-medium text-black/50">Para {nomeDestinatario(acao.destinatario)}</p>
                    {acao.prazo && <p className="mt-0.5 text-[0.6875rem] text-black/40">Até {dataCurta(acao.prazo)}</p>}
                  </div>
                  <span className="shrink-0 rounded px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide" style={{ background: acao.status === "pendente" ? "#fff" : "rgba(13,13,13,.06)", color: acao.status === "pendente" ? "#B07A14" : "rgba(13,13,13,.45)" }}>
                    {acao.status === "pendente" ? "Aguardando resposta" : "Respondido"}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-black/80">{acao.descricao}</p>
                {acao.resposta && <div className="mt-2.5 border-l-2 border-black/15 pl-2.5">
                  <p className="text-[0.6875rem] text-black/45">Resposta</p>
                  <p className="whitespace-pre-wrap text-[0.75rem] leading-relaxed text-black/70">{acao.resposta}</p>
                </div>}
                {acao.status === "pendente" && acao.destinatario === meuPapel && <div className="mt-3 space-y-2">
                  <label htmlFor={`resposta-${acao.id}`} className="sr-only">Resposta ao pedido</label>
                  <textarea id={`resposta-${acao.id}`} rows={2} maxLength={2000} value={respostas[acao.id] ?? ""} onChange={e => setRespostas(prev => ({ ...prev, [acao.id]: e.target.value }))} placeholder="Responder ao pedido…" className="w-full resize-none rounded border border-black/[.15] bg-white px-3 py-2 text-[0.75rem] outline-none focus:border-[#7259B5]" />
                  <button type="button" disabled={saving || !respostas[acao.id]?.trim()} onClick={() => void executar("fn_projeto_responder_acao", { p_acao_id: acao.id, p_resposta: respostas[acao.id].trim() }, () => setRespostas(prev => ({ ...prev, [acao.id]: "" })))} className="inline-flex items-center gap-1.5 rounded bg-[#2E8932] px-3 py-1.5 text-[0.75rem] font-semibold text-white transition hover:bg-[#26752A] disabled:opacity-40"><Send size={12} />Responder</button>
                </div>}
                {acao.status === "respondida" && <button type="button" disabled={saving} onClick={() => void executar("fn_projeto_resolver_acao", { p_acao_id: acao.id }, () => {})} className="mt-3 inline-flex items-center gap-1.5 rounded border border-black/[.14] px-2.5 py-1 text-[0.6875rem] font-semibold text-black/60 transition hover:border-black/30 hover:text-[#282525] disabled:opacity-40"><Check size={12} />Marcar resolvido</button>}
              </article>
            ))}
          </div>
        )}
        <button type="button" onClick={() => setPedindoAcao(true)} className="mt-3.5 inline-flex h-9 items-center gap-1.5 rounded border border-black/[.14] px-3.5 text-[0.75rem] font-semibold text-black/65 transition hover:border-black/30 hover:text-[#282525]">
          <Send size={12} />Nova solicitação para {nomeDestinatario(destinatario)}
        </button>
        {resolvidas.length > 0 && <details className="mt-3.5 text-[0.6875rem] text-black/55"><summary className="cursor-pointer select-none">Resolvidos ({resolvidas.length})</summary><div className="mt-2 space-y-2">{resolvidas.map(acao => <div key={acao.id} className="rounded border border-black/[.07] px-3 py-2"><p className="font-medium text-black/65">{acao.descricao}</p>{acao.resposta && <p className="mt-1 text-black/50">{acao.resposta}</p>}</div>)}</div></details>}
      </div>
      {erro && <p role="alert" className="mt-3 text-[0.6875rem] font-medium text-[#B64545]">{erro}</p>}
    </section>

    {pedindoAcao && <TopSheet titulo={`Nova solicitação para ${nomeDestinatario(destinatario)}`} onClose={() => setPedindoAcao(false)} footer={close => <>
      <button type="button" onClick={close} className="text-[0.75rem] text-black/50 hover:text-black/70">Cancelar</button>
      <button type="button" disabled={saving || !novaAcao.trim()} onClick={() => void executar("fn_projeto_criar_acao", { p_projeto_id: projetoId, p_destinatario: destinatario, p_descricao: novaAcao.trim(), p_prazo: prazo || null }, () => { setNovaAcao(""); setPrazo(""); close(); })} className="rounded bg-[#2E8932] px-3.5 py-1.5 text-[0.75rem] font-semibold text-white transition hover:bg-[#26752A] disabled:opacity-40">
        {saving ? "Enviando…" : "Enviar solicitação"}
      </button>
    </>}>
      <div className="space-y-3">
        <div>
          <label htmlFor={`nova-acao-${projetoId}`} className="mb-1.5 block text-[0.6875rem] font-medium text-black/55">O que {nomeDestinatario(destinatario)} precisa fazer?</label>
          <textarea id={`nova-acao-${projetoId}`} autoFocus value={novaAcao} onChange={e => setNovaAcao(e.target.value)} maxLength={2000} rows={4} placeholder="Documento, aprovação, retorno…" className="w-full resize-none rounded border border-black/[.15] px-3 py-2 text-[0.8125rem] outline-none focus:border-[#7259B5]" />
        </div>
        <label className="block text-[0.6875rem] text-black/50">Prazo (opcional)
          <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} className="mt-1 h-9 w-full rounded border border-black/[.15] bg-white px-2 text-[0.75rem] text-[#282525]" />
        </label>
        {erro && <p role="alert" className="text-[0.6875rem] font-medium text-[#B64545]">{erro}</p>}
      </div>
    </TopSheet>}
  </>;
}
