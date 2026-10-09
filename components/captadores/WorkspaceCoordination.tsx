"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- migração experimental ainda não consta nos tipos gerados */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Check, CheckCircle2, Flag, MessageCircle, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationName } from "@/contexts/OrganizationContext";
import { TopSheet } from "@/components/ui/TopSheet";
import { AnchoredPopover, useAnchoredPopover } from "@/components/ui/AnchoredPopover";

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
type ProximoPasso = { texto: string | null; data: string | null; aguardando: "captador" | "gestor" | null };

function dataCurta(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
}

export function BotaoSecundario({ onClick, children }: { onClick: (event: React.MouseEvent<HTMLElement>) => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 rounded border border-black/[.14] px-2.5 py-1.5 text-[0.6875rem] font-medium text-black/60 transition hover:border-black/30 hover:text-[#282525]">
      {children}
    </button>
  );
}

export function BotaoSalvar({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="rounded bg-[#2E8932] px-3.5 py-1.5 text-[0.75rem] font-semibold text-white transition hover:bg-[#26752A] disabled:opacity-40">
      {children}
    </button>
  );
}

function PainelTile({ icon: Icon, title, action, children }: {
  icon: typeof MessageCircle; title: string; action: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 bg-white p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-black/40">
          <Icon size={12} strokeWidth={1.8} />
          <p className="text-[0.625rem] font-semibold uppercase tracking-wide">{title}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function WorkspaceCoordination({ atribuicaoId, isGestor, onChange, abrirPedidoTrigger }: {
  atribuicaoId: string;
  isGestor: boolean;
  onChange?: () => void;
  abrirPedidoTrigger?: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const organizationName = useOrganizationName() || "Organização";
  const [coordenacao, setCoordenacao] = useState<Coordenacao | null>(null);
  const [proximo, setProximo] = useState<ProximoPasso | null>(null);
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [disponivel, setDisponivel] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const situacaoPop = useAnchoredPopover();
  const [situacao, setSituacao] = useState("");
  const proximoPop = useAnchoredPopover();
  const [textoProximo, setTextoProximo] = useState("");
  const [dataProximo, setDataProximo] = useState("");
  const [aguardandoProximo, setAguardandoProximo] = useState<"captador" | "gestor">("captador");
  const resultadoPop = useAnchoredPopover();
  const [resultado, setResultado] = useState("");
  const [novaAcao, setNovaAcao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [pedindoAcao, setPedindoAcao] = useState(false);
  const [ultimoTrigger, setUltimoTrigger] = useState(abrirPedidoTrigger);
  if (abrirPedidoTrigger !== ultimoTrigger) {
    setUltimoTrigger(abrirPedidoTrigger);
    setPedindoAcao(true);
  }
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const meuPapel = isGestor ? "organizacao" : "captador";
  const destinatario = isGestor ? "captador" : "organizacao";

  const carregar = useCallback(async () => {
    const [estado, pedidos, passo] = await Promise.all([
      (supabase as any).rpc("fn_workspace_obter_coordenacao", { p_atribuicao_id: atribuicaoId }),
      (supabase as any).from("workspace_acoes").select("id, destinatario, descricao, prazo, status, resposta, created_at")
        .eq("atribuicao_id", atribuicaoId).order("created_at", { ascending: false }),
      (supabase as any).rpc("fn_workspace_obter_proximo_passo", { p_atribuicao_id: atribuicaoId }),
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
    if (!passo.error) setProximo(passo.data as ProximoPasso);
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
    <section className="overflow-hidden rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="grid divide-y divide-black/[.08] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <PainelTile icon={MessageCircle} title="Situação atual" action={
          <BotaoSecundario onClick={event => { setSituacao(coordenacao?.situacao ?? ""); situacaoPop.abrir(event); }}>
            {coordenacao?.situacao ? "Alterar" : "Informar"}
          </BotaoSecundario>
        }>
          {coordenacao?.situacao ? <p className="line-clamp-4 whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-black/75">{coordenacao.situacao}</p> : <p className="text-[0.78125rem] text-black/35">Sem situação informada.</p>}
        </PainelTile>

        <PainelTile icon={Flag} title="Próximo passo" action={
          <BotaoSecundario onClick={event => { setTextoProximo(proximo?.texto ?? ""); setDataProximo(proximo?.data ?? ""); setAguardandoProximo(proximo?.aguardando ?? "captador"); proximoPop.abrir(event, 380); }}>
            {proximo?.texto ? "Alterar" : "Definir"}
          </BotaoSecundario>
        }>
          {proximo?.texto ? <div>
            <p className="line-clamp-3 text-[0.8125rem] font-medium leading-snug text-black/80">{proximo.texto}</p>
            <p className="mt-1 flex items-center gap-1 text-[0.6875rem] text-black/45"><Calendar size={10} />Com {proximo.aguardando === "gestor" ? organizationName : "o captador"}{proximo.data ? ` · ${proximo.data.split("-").reverse().join("/")}` : ""}</p>
          </div> : <p className="text-[0.78125rem] text-black/35">Não definido.</p>}
        </PainelTile>

        <PainelTile icon={CheckCircle2} title="Resultado" action={
          <BotaoSecundario onClick={event => { setResultado(coordenacao?.resultado ?? ""); resultadoPop.abrir(event); }}>
            {coordenacao?.resultado ? "Atualizar" : "Registrar"}
          </BotaoSecundario>
        }>
          {coordenacao?.resultado ? <p className="line-clamp-4 whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-black/70">{coordenacao.resultado}</p> : <p className="text-[0.78125rem] text-black/35">Ainda não registrado.</p>}
        </PainelTile>
      </div>
    </section>

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
                    <p className="text-[0.6875rem] font-medium text-black/50">Para {acao.destinatario === "captador" ? "o captador" : organizationName}</p>
                    {acao.prazo && <p className="mt-0.5 text-[0.6875rem] text-black/40">Até {dataCurta(acao.prazo)}</p>}
                  </div>
                  <span className="shrink-0 rounded px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide" style={{ background: acao.status === "pendente" ? "#fff" : "rgba(13,13,13,.06)", color: acao.status === "pendente" ? "#B07A14" : "rgba(13,13,13,.45)" }}>
                    {acao.status === "pendente" ? "Aguardando resposta" : "Respondido"}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-black/80">{acao.descricao}</p>
                {acao.resposta && <div className="mt-2.5 border-l-2 border-black/15 pl-2.5"><p className="text-[0.6875rem] text-black/45">Resposta</p><p className="whitespace-pre-wrap text-[0.75rem] leading-relaxed text-black/70">{acao.resposta}</p></div>}
                {acao.status === "pendente" && acao.destinatario === meuPapel && <div className="mt-3 space-y-2">
                  <label htmlFor={`resposta-${acao.id}`} className="sr-only">Resposta ao pedido</label>
                  <textarea id={`resposta-${acao.id}`} rows={2} maxLength={2000} value={respostas[acao.id] ?? ""} onChange={e => setRespostas(prev => ({ ...prev, [acao.id]: e.target.value }))} placeholder="Responder ao pedido…" className="w-full resize-none rounded border border-black/[.15] bg-white px-3 py-2 text-[0.75rem] outline-none focus:border-[#7259B5]" />
                  <button type="button" disabled={saving || !respostas[acao.id]?.trim()} onClick={() => void executar("fn_workspace_responder_acao", { p_acao_id: acao.id, p_resposta: respostas[acao.id].trim() }, () => setRespostas(prev => ({ ...prev, [acao.id]: "" })))} className="inline-flex items-center gap-1.5 rounded bg-[#2E8932] px-3 py-1.5 text-[0.75rem] font-semibold text-white transition hover:bg-[#26752A] disabled:opacity-40"><Send size={12} />Responder</button>
                </div>}
                {acao.status === "respondida" && <button type="button" disabled={saving} onClick={() => void executar("fn_workspace_resolver_acao", { p_acao_id: acao.id }, () => {})} className="mt-3 inline-flex items-center gap-1.5 rounded border border-black/[.14] px-2.5 py-1 text-[0.6875rem] font-semibold text-black/60 transition hover:border-black/30 hover:text-[#282525] disabled:opacity-40"><Check size={12} />Marcar resolvido</button>}
              </article>
            ))}
          </div>
        )}
        <button type="button" onClick={() => setPedindoAcao(true)} className="mt-3.5 inline-flex h-9 items-center gap-1.5 rounded border border-black/[.14] px-3.5 text-[0.75rem] font-semibold text-black/65 transition hover:border-black/30 hover:text-[#282525]">
          <Send size={12} />Nova solicitação para {nomeDestinatario}
        </button>
        {resolvidas.length > 0 && <details className="mt-3.5 text-[0.6875rem] text-black/55"><summary className="cursor-pointer select-none">Resolvidos ({resolvidas.length})</summary><div className="mt-2 space-y-2">{resolvidas.map(acao => <div key={acao.id} className="rounded border border-black/[.07] px-3 py-2"><p className="font-medium text-black/65">{acao.descricao}</p>{acao.resposta && <p className="mt-1 text-black/50">{acao.resposta}</p>}</div>)}</div></details>}
      </div>
    </section>
    {erro && <p role="alert" className="text-[0.6875rem] font-medium text-[#B64545]">{erro}</p>}
  </div>

  <AnchoredPopover pos={situacaoPop.pos} onClose={situacaoPop.fechar}>
    <label htmlFor={`situacao-${atribuicaoId}`} className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">Situação atual</label>
    <textarea id={`situacao-${atribuicaoId}`} autoFocus value={situacao} onChange={e => setSituacao(e.target.value)} maxLength={500} rows={4} className="w-full resize-none rounded border border-black/[.15] px-3 py-2.5 text-[0.8125rem] outline-none focus:border-[#7259B5] focus:ring-2 focus:ring-[#7259B5]/10" placeholder="Em que pé está esta oportunidade?" />
    <div className="mt-2.5 flex items-center gap-3">
      <BotaoSalvar disabled={saving || !situacao.trim()} onClick={() => void executar("fn_workspace_definir_situacao", { p_atribuicao_id: atribuicaoId, p_texto: situacao.trim() }, situacaoPop.fechar)}>Salvar</BotaoSalvar>
      <button type="button" onClick={situacaoPop.fechar} className="text-[0.75rem] text-black/45 hover:text-black/65">Cancelar</button>
    </div>
    {erro && <p role="alert" className="mt-2 text-[0.6875rem] font-medium text-[#B64545]">{erro}</p>}
  </AnchoredPopover>

  <AnchoredPopover pos={proximoPop.pos} onClose={proximoPop.fechar}>
    <div className="space-y-3">
      <div>
        <label htmlFor={`proximo-${atribuicaoId}`} className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">O que precisa acontecer?</label>
        <input id={`proximo-${atribuicaoId}`} autoFocus value={textoProximo} onChange={event => setTextoProximo(event.target.value)} maxLength={500}
          className="h-10 w-full rounded border border-black/[.15] px-3 text-[0.8125rem] outline-none focus:border-[#7259B5]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[0.6875rem] font-medium text-black/55">Responsável</p>
          <div className="inline-flex overflow-hidden rounded border border-black/[.15]">
            {(["captador", "gestor"] as const).map(opcao => <button key={opcao} type="button" onClick={() => setAguardandoProximo(opcao)} aria-pressed={aguardandoProximo === opcao}
              className={`px-3 py-2 text-[0.75rem] transition ${aguardandoProximo === opcao ? "bg-[#171717] text-white" : "bg-white text-black/60 hover:bg-black/[.04]"}`}>{opcao === "captador" ? "Captador" : organizationName}</button>)}
          </div>
        </div>
        <div>
          <label htmlFor={`proximo-data-${atribuicaoId}`} className="mb-1.5 block text-[0.6875rem] font-medium text-black/55">Até quando</label>
          <input id={`proximo-data-${atribuicaoId}`} type="date" value={dataProximo} onChange={event => setDataProximo(event.target.value)}
            className="h-10 w-full rounded border border-black/[.15] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none focus:border-[#7259B5]" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <BotaoSalvar disabled={saving || !textoProximo.trim()} onClick={() => void executar("fn_workspace_definir_proximo_passo", { p_atribuicao_id: atribuicaoId, p_texto: textoProximo.trim(), p_data: dataProximo || null, p_aguardando: aguardandoProximo }, proximoPop.fechar)}>
          {saving ? "Salvando…" : "Salvar próximo passo"}
        </BotaoSalvar>
        <button type="button" onClick={proximoPop.fechar} className="text-[0.75rem] text-black/45 hover:text-black/65">Cancelar</button>
      </div>
      {erro && <p role="alert" className="text-[0.6875rem] font-medium text-[#B64545]">{erro}</p>}
    </div>
  </AnchoredPopover>

  <AnchoredPopover pos={resultadoPop.pos} onClose={resultadoPop.fechar}>
    <label htmlFor={`resultado-${atribuicaoId}`} className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">Resultado</label>
    <textarea id={`resultado-${atribuicaoId}`} autoFocus value={resultado} onChange={e => setResultado(e.target.value)} maxLength={2000} rows={4} placeholder="O que aconteceu?" className="w-full resize-none rounded border border-black/[.15] px-3 py-2.5 text-[0.8125rem] outline-none focus:border-[#7259B5] focus:ring-2 focus:ring-[#7259B5]/10" />
    <div className="mt-2.5 flex items-center gap-3">
      <BotaoSalvar disabled={saving || !resultado.trim()} onClick={() => void executar("fn_workspace_registrar_resultado", { p_atribuicao_id: atribuicaoId, p_texto: resultado.trim() }, resultadoPop.fechar)}>Salvar resultado</BotaoSalvar>
      <button type="button" onClick={resultadoPop.fechar} className="text-[0.75rem] text-black/45 hover:text-black/65">Cancelar</button>
    </div>
    {erro && <p role="alert" className="mt-2 text-[0.6875rem] font-medium text-[#B64545]">{erro}</p>}
  </AnchoredPopover>

  {pedindoAcao && <TopSheet titulo={`Nova solicitação para ${nomeDestinatario}`} onClose={() => setPedindoAcao(false)} footer={close => <>
    <button type="button" onClick={close} className="text-[0.75rem] text-black/50 hover:text-black/70">Cancelar</button>
    <BotaoSalvar disabled={saving || !novaAcao.trim()} onClick={() => void executar("fn_workspace_criar_acao", { p_atribuicao_id: atribuicaoId, p_destinatario: destinatario, p_descricao: novaAcao.trim(), p_prazo: prazo || null }, () => { setNovaAcao(""); setPrazo(""); close(); })}>
      {saving ? "Enviando…" : "Enviar solicitação"}
    </BotaoSalvar>
  </>}>
    <div className="space-y-3">
      <div>
        <label htmlFor={`nova-acao-${atribuicaoId}`} className="mb-1.5 block text-[0.6875rem] font-medium text-black/55">O que {nomeDestinatario} precisa fazer?</label>
        <textarea id={`nova-acao-${atribuicaoId}`} autoFocus value={novaAcao} onChange={e => setNovaAcao(e.target.value)} maxLength={2000} rows={4} placeholder="Reunião, documento, aprovação…" className="w-full resize-none rounded border border-black/[.15] px-3 py-2 text-[0.8125rem] outline-none focus:border-[#7259B5]" />
      </div>
      <label className="block text-[0.6875rem] text-black/50">Prazo (opcional)
        <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} className="mt-1 h-9 w-full rounded border border-black/[.15] bg-white px-2 text-[0.75rem] text-[#282525]" />
      </label>
      {erro && <p role="alert" className="text-[0.6875rem] font-medium text-[#B64545]">{erro}</p>}
    </div>
  </TopSheet>}
  </>;
}
