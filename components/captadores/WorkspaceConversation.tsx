"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas experimentais ainda não constam nos tipos gerados */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, MessageCircle, Send, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationName } from "@/contexts/OrganizationContext";
import { WorkspaceCoordination, BotaoSalvar } from "@/components/captadores/WorkspaceCoordination";
import { CompanyLogo } from "@/components/CompanyLogo";
import { AnchoredPopover, useAnchoredPopover } from "@/components/ui/AnchoredPopover";

export type WorkspacePedido = {
  id: string;
  tipo: "empresas" | "negociacoes" | "inscricoes";
  nome_busca: string;
  oportunidade_titulo?: string | null;
  oportunidade_etiqueta_id?: string | null;
  oportunidade_etiqueta?: { nome: string } | null;
  empresa_site?: string | null;
  mensagem: string | null;
  status: "pendente" | "aguardando_captador" | "aprovado" | "recusado";
  created_at: string;
  decidido_em?: string | null;
  atribuicao_id?: string | null;
};

export async function listarPedidosWorkspace(supabase: ReturnType<typeof createClient>, workspaceId: string) {
  const base = (supabase as any).from("captador_workspace_pedidos");
  const result = await base
    .select("id, tipo, nome_busca, oportunidade_titulo, oportunidade_etiqueta_id, oportunidade_etiqueta:captador_oportunidade_etiquetas!oportunidade_etiqueta_id(nome), empresa_site, mensagem, status, created_at, decidido_em, atribuicao_id")
    .eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (!result.error) return { pedidos: (result.data ?? []) as WorkspacePedido[], error: null };
  if (!["42703", "PGRST200", "PGRST205"].includes(result.error.code)) return { pedidos: [] as WorkspacePedido[], error: result.error.message as string };

  const legacy = await (supabase as any).from("captador_workspace_pedidos")
    .select("id, tipo, nome_busca, mensagem, status, created_at, decidido_em, atribuicao_id")
    .eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (!legacy.error) return { pedidos: (legacy.data ?? []) as WorkspacePedido[], error: null };
  // Permite visualizar pedidos existentes antes de aplicar as migrações experimentais.
  const fallback = await (supabase as any).from("captador_workspace_pedidos")
    .select("id, tipo, nome_busca, mensagem, status, created_at, decidido_em")
    .eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  return { pedidos: (fallback.data ?? []) as WorkspacePedido[], error: fallback.error?.message ?? null };
}

type Mensagem = { id: string; autor_email: string; texto: string; created_at: string };

const STATUS: Record<WorkspacePedido["status"], string> = {
  pendente: "Aguardando decisão",
  aguardando_captador: "Aguardando sua resposta",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

const STATUS_COR: Record<WorkspacePedido["status"], string> = {
  pendente: "#B07A14",
  aguardando_captador: "#7259B5",
  aprovado: "#2E8932",
  recusado: "#B64545",
};

function DataMensagem({ data }: { data: string }) {
  return <time dateTime={data}>{new Date(data).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time>;
}

function VazioSutil({ texto }: { texto: string }) {
  return (
    <div className="rounded border border-dashed px-3.5 py-3" style={{ borderColor: "rgba(13,13,13,.14)" }}>
      <p className="text-[0.78125rem] text-black/35">{texto}</p>
    </div>
  );
}

function MensagemBubble({ autor, texto, data, destaque = false, rotulo }: {
  autor: string; texto: string; data: string; destaque?: boolean; rotulo?: string;
}) {
  const inicial = autor.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="flex gap-2.5">
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold text-white ${destaque ? "bg-[#171717]" : "bg-black/25"}`}>{inicial}</div>
      <div className="min-w-0 flex-1 rounded border bg-white px-3.5 py-2.5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <p className="whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-black/80">{texto}</p>
        <p className="mt-1.5 text-[0.6875rem] text-black/40">{rotulo ?? autor} · <DataMensagem data={data} /></p>
      </div>
    </div>
  );
}

export function PedidoConversa({ pedido, isGestor, onChange, onOpenAtribuicao }: {
  pedido: WorkspacePedido;
  isGestor: boolean;
  onChange: () => void;
  onOpenAtribuicao?: (id: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const organizationName = useOrganizationName() || "sua organização";
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [recusando, setRecusando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const { data, error } = await (supabase as any)
      .from("captador_workspace_mensagens")
      .select("id, autor_email, texto, created_at")
      .eq("pedido_id", pedido.id)
      .order("created_at", { ascending: true });
    setMensagens((data ?? []) as Mensagem[]);
    setErro(error ? "Conversa indisponível." : null);
    setLoading(false);
  }, [pedido.id, supabase]);

  useEffect(() => {
    const initial = window.setTimeout(() => { void carregar(); }, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void carregar(true); }, 20_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [carregar]);

  async function enviar() {
    if (!texto.trim() || saving) return;
    setSaving(true);
    setErro(null);
    const { error } = await (supabase as any).rpc("fn_workspace_enviar_mensagem", {
      p_pedido_id: pedido.id, p_texto: texto.trim(),
    });
    setSaving(false);
    if (error) { setErro(error.message); return; }
    setTexto("");
    await carregar();
    onChange();
  }

  async function decidir(acao: "aprovar" | "recusar") {
    if (saving || (acao === "recusar" && !motivo.trim())) return;
    setSaving(true);
    setErro(null);
    const { error } = acao === "aprovar"
      ? await (supabase as any).rpc("fn_aprovar_pedido_workspace", { p_pedido_id: pedido.id })
      : await (supabase as any).rpc("fn_workspace_recusar_pedido", { p_pedido_id: pedido.id, p_motivo: motivo.trim() });
    setSaving(false);
    if (error) { setErro(error.message); return; }
    onChange();
  }

  const aberto = pedido.status === "pendente" || pedido.status === "aguardando_captador";

  return (
    <section aria-label={`Conversa sobre ${pedido.nome_busca}`} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <div className="flex items-center gap-3">
          <CompanyLogo nome={pedido.nome_busca} site={pedido.empresa_site} size={40} className="shrink-0 border border-black/[.08]" />
          <div>
            <p className="text-[1rem] font-semibold leading-tight text-[#171717]">{pedido.oportunidade_titulo || pedido.nome_busca}</p>
            <p className="mt-1 text-[0.71875rem] text-black/45">{pedido.oportunidade_etiqueta?.nome ?? (pedido.tipo === "empresas" ? "Relacionamento" : pedido.tipo === "negociacoes" ? "Negociação" : "Edital")} · {pedido.nome_busca}</p>
          </div>
        </div>
        <span className="shrink-0 rounded border px-2.5 py-1 text-[0.6875rem] font-semibold" style={{ borderColor: STATUS_COR[pedido.status] + "40", color: STATUS_COR[pedido.status] }}>
          {isGestor && pedido.status === "aguardando_captador" ? "Aguardando captador" : pedido.status === "pendente" && !isGestor ? `Aguardando ${organizationName}` : STATUS[pedido.status]}
        </span>
      </div>

      <div className="max-h-80 space-y-3 overflow-y-auto" aria-live="polite">
        {pedido.mensagem && (
          <MensagemBubble autor="Mensagem inicial" rotulo="Mensagem inicial" texto={pedido.mensagem} data={pedido.created_at} destaque />
        )}
        {loading ? <p className="text-[0.75rem] text-black/40">Carregando conversa…</p> : mensagens.length === 0 && !pedido.mensagem ? (
          <VazioSutil texto="Ainda não há mensagens nesta oportunidade." />
        ) : null}
        {mensagens.map(m => (
          <MensagemBubble key={m.id} autor={m.autor_email} texto={m.texto} data={m.created_at} />
        ))}
        {pedido.status === "aprovado" && (
          <div className="flex items-center gap-2 rounded border px-3.5 py-2.5" style={{ borderColor: "#2E893230", background: "#fff" }}>
            <Check size={13} className="shrink-0 text-[#2E8932]" />
            <p className="text-[0.75rem] font-medium text-black/70">Aprovado. O acompanhamento continua na atribuição.</p>
          </div>
        )}
      </div>

      {aberto && (
        <div className="space-y-2">
          <label htmlFor={`pedido-mensagem-${pedido.id}`} className="block text-[0.6875rem] font-medium text-black/55">
            {isGestor ? "Responder ou pedir mais informações" : `Responder a ${organizationName}`}
          </label>
          <textarea
            id={`pedido-mensagem-${pedido.id}`}
            value={texto}
            onChange={event => setTexto(event.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={isGestor ? "O que precisa esclarecer?" : "Escreva o contexto ou responda à pergunta…"}
            className="w-full resize-none rounded border border-black/[.15] px-3 py-2.5 text-[0.8125rem] outline-none focus:border-[#7259B5] focus:ring-2 focus:ring-[#7259B5]/10"
          />
          <button type="button" onClick={() => void enviar()} disabled={saving || !texto.trim()}
            className="inline-flex items-center gap-1.5 rounded bg-[#2E8932] px-3.5 py-2 text-[0.75rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-40">
            <Send size={13} /> {saving ? "Enviando…" : "Enviar mensagem"}
          </button>
        </div>
      )}

      {isGestor && aberto && (
        <div className="border-t pt-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          {recusando ? (
            <div className="space-y-2">
              <label htmlFor={`pedido-motivo-${pedido.id}`} className="block text-[0.6875rem] font-medium text-black/55">Motivo da recusa</label>
              <textarea id={`pedido-motivo-${pedido.id}`} value={motivo} onChange={event => setMotivo(event.target.value)} rows={2} maxLength={4000}
                className="w-full resize-none rounded border border-black/[.15] px-3 py-2 text-[0.8125rem] outline-none focus:border-[#7259B5]" />
              <div className="flex gap-2">
                <button type="button" onClick={() => void decidir("recusar")} disabled={saving || !motivo.trim()} className="rounded border border-[#B64545]/40 px-3 py-2 text-[0.75rem] font-semibold text-[#B64545] disabled:opacity-40">Confirmar recusa</button>
                <button type="button" onClick={() => setRecusando(false)} className="px-3 py-2 text-[0.75rem] text-black/50">Voltar</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => void decidir("aprovar")} disabled={saving} className="inline-flex items-center gap-1.5 rounded bg-[#2E8932] px-3.5 py-2 text-[0.75rem] font-semibold text-white disabled:opacity-40"><Check size={13} />Aprovar e atribuir</button>
              <button type="button" onClick={() => setRecusando(true)} disabled={saving} className="inline-flex items-center gap-1.5 rounded border border-black/[.12] px-3 py-2 text-[0.75rem] font-medium text-black/60"><X size={13} />Recusar</button>
            </div>
          )}
        </div>
      )}

      {pedido.status === "aprovado" && pedido.atribuicao_id && onOpenAtribuicao && (
        <button type="button" onClick={() => onOpenAtribuicao(pedido.atribuicao_id!)} className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-[#7259B5] hover:underline">
          <MessageCircle size={13} />Abrir acompanhamento
        </button>
      )}
      {erro && <p role="alert" className="text-[0.6875rem] font-medium text-[#B64545]">{erro}</p>}
    </section>
  );
}

export function AtribuicaoConversa({ id, organizationId, pedido, onSent, isGestor = false, abrirPedidoTrigger }: {
  id: string;
  organizationId: string;
  pedido?: WorkspacePedido | null;
  onSent?: () => void;
  isGestor?: boolean;
  abrirPedidoTrigger?: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [notas, setNotas] = useState<{ id: string; autor_email: string; nota: string; created_at: string }[]>([]);
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const atualizacaoPop = useAnchoredPopover();

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const { data, error } = await (supabase as any).from("atribuicao_notas")
      .select("id, autor_email, nota, created_at").eq("atribuicao_id", id).order("created_at", { ascending: true });
    setNotas((data ?? []) as typeof notas);
    setErro(error?.message ?? null);
    setLoading(false);
  }, [id, supabase]);
  useEffect(() => {
    const initial = window.setTimeout(() => { void carregar(); }, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void carregar(true); }, 20_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [carregar]);

  async function enviar() {
    if (!texto.trim() || saving) return;
    setSaving(true);
    setErro(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErro("Entre na sua conta para enviar."); setSaving(false); return; }
    const { error } = await (supabase as any).from("atribuicao_notas").insert({
      atribuicao_id: id, organization_id: organizationId, autor_id: user.id,
      autor_email: user.email ?? "Usuário", nota: texto.trim(),
    });
    setSaving(false);
    if (error) { setErro(error.message); return; }
    setTexto("");
    atualizacaoPop.fechar();
    await carregar();
    onSent?.();
  }

  return (
    <section aria-label="Acompanhamento compartilhado" className="space-y-6">
      {pedido && <div className="border-b pb-5" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-black/40">Como esta oportunidade começou</p>
        <PedidoConversa pedido={pedido} isGestor={false} onChange={() => {}} />
      </div>}
      <WorkspaceCoordination atribuicaoId={id} isGestor={isGestor} onChange={() => { void carregar(); onSent?.(); }} abrirPedidoTrigger={abrirPedidoTrigger} />

      <div className="border-t pt-6" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-black/40">Histórico</p>
          <button type="button" onClick={event => atualizacaoPop.abrir(event, 360)} className="rounded border border-black/[.14] px-2.5 py-1.5 text-[0.6875rem] font-medium text-black/60 transition hover:border-black/30 hover:text-[#282525]">Nova atualização</button>
        </div>
        <div className="max-h-80 space-y-3 overflow-y-auto" aria-live="polite">
          {loading ? <p className="text-[0.75rem] text-black/40">Carregando acompanhamento…</p> : notas.length === 0 ? (
            <VazioSutil texto="Nenhuma atualização ainda." />
          ) : notas.map(n => (
            <MensagemBubble key={n.id} autor={n.autor_email} texto={n.nota} data={n.created_at} />
          ))}
        </div>
      </div>
      <AnchoredPopover pos={atualizacaoPop.pos} onClose={atualizacaoPop.fechar}>
        <label htmlFor={`atribuicao-mensagem-${id}`} className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">Atualização para o outro lado</label>
        <textarea id={`atribuicao-mensagem-${id}`} autoFocus value={texto} onChange={event => setTexto(event.target.value)} rows={4}
          placeholder="O que aconteceu? Qual é o próximo passo?" className="w-full resize-none rounded border border-black/[.15] px-3 py-2.5 text-[0.8125rem] outline-none focus:border-[#7259B5] focus:ring-2 focus:ring-[#7259B5]/10" />
        <div className="mt-2.5 flex items-center gap-3">
          <BotaoSalvar disabled={saving || !texto.trim()} onClick={() => void enviar()}>{saving ? "Enviando…" : "Registrar atualização"}</BotaoSalvar>
          <button type="button" onClick={atualizacaoPop.fechar} className="text-[0.75rem] text-black/45 hover:text-black/65">Cancelar</button>
        </div>
        {erro && <p role="alert" className="mt-2 text-[0.6875rem] font-medium text-[#B64545]">{erro}</p>}
      </AnchoredPopover>
      {erro && <p role="alert" className="text-[0.6875rem] font-medium text-[#B64545]">{erro}</p>}
    </section>
  );
}
