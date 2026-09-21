"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas experimentais ainda não constam nos tipos gerados */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, MessageCircle, Send, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationName } from "@/contexts/OrganizationContext";
import { WorkspaceCoordination } from "@/components/captadores/WorkspaceCoordination";
import { CompanyLogo } from "@/components/CompanyLogo";

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

function DataMensagem({ data }: { data: string }) {
  return <time dateTime={data}>{new Date(data).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time>;
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
    <section aria-label={`Conversa sobre ${pedido.nome_busca}`} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[.08] pb-3">
        <div className="flex items-center gap-3">
          {pedido.empresa_site && <CompanyLogo nome={pedido.nome_busca} site={pedido.empresa_site} size={36} className="shrink-0 border border-black/[.08]" />}
          <div>
          <p className="text-[15px] font-semibold text-[#171717]">{pedido.oportunidade_titulo || pedido.nome_busca}</p>
          <p className="mt-0.5 text-[11px] text-black/45">{pedido.oportunidade_etiqueta?.nome ?? (pedido.tipo === "empresas" ? "Relacionamento" : pedido.tipo === "negociacoes" ? "Negociação" : "Edital")} · {pedido.nome_busca}</p>
          </div>
        </div>
        <span className="rounded border border-black/[.1] px-2 py-1 text-[11px] font-medium text-black/60">
          {isGestor && pedido.status === "aguardando_captador" ? "Aguardando captador" : pedido.status === "pendente" && !isGestor ? `Aguardando ${organizationName}` : STATUS[pedido.status]}
        </span>
      </div>

      <div className="max-h-72 space-y-3 overflow-y-auto" aria-live="polite">
        {pedido.mensagem && (
          <div className="border-l-2 border-[#5F4AA8] pl-3">
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-black/75">{pedido.mensagem}</p>
            <p className="mt-1 text-[11px] text-black/40">Mensagem inicial · <DataMensagem data={pedido.created_at} /></p>
          </div>
        )}
        {loading ? <p className="text-[12px] text-black/40">Carregando conversa…</p> : mensagens.length === 0 && !pedido.mensagem ? (
          <p className="text-[12px] text-black/45">Ainda não há mensagens nesta oportunidade.</p>
        ) : null}
        {mensagens.map(m => (
          <div key={m.id} className="border-l-2 border-black/[.12] pl-3">
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-black/75">{m.texto}</p>
            <p className="mt-1 text-[11px] text-black/40">{m.autor_email} · <DataMensagem data={m.created_at} /></p>
          </div>
        ))}
        {pedido.status === "aprovado" && <p className="text-[11px] font-medium text-[#2E8932]">Aprovado. O acompanhamento continua na atribuição.</p>}
      </div>

      {aberto && (
        <div className="space-y-2">
          <label htmlFor={`pedido-mensagem-${pedido.id}`} className="block text-[11px] font-medium text-black/55">
            {isGestor ? "Responder ou pedir mais informações" : `Responder a ${organizationName}`}
          </label>
          <textarea
            id={`pedido-mensagem-${pedido.id}`}
            value={texto}
            onChange={event => setTexto(event.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={isGestor ? "O que precisa esclarecer?" : "Escreva o contexto ou responda à pergunta…"}
            className="w-full resize-none rounded border border-black/[.15] px-3 py-2 text-[13px] outline-none focus:border-[#5F4AA8] focus:ring-2 focus:ring-[#5F4AA8]/10"
          />
          <button type="button" onClick={() => void enviar()} disabled={saving || !texto.trim()}
            className="inline-flex items-center gap-1.5 rounded bg-[#171717] px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5F4AA8] disabled:opacity-40">
            <Send size={13} /> {saving ? "Enviando…" : "Enviar mensagem"}
          </button>
        </div>
      )}

      {isGestor && aberto && (
        <div className="border-t border-black/[.08] pt-3">
          {recusando ? (
            <div className="space-y-2">
              <label htmlFor={`pedido-motivo-${pedido.id}`} className="block text-[11px] font-medium text-black/55">Motivo da recusa</label>
              <textarea id={`pedido-motivo-${pedido.id}`} value={motivo} onChange={event => setMotivo(event.target.value)} rows={2} maxLength={4000}
                className="w-full resize-none rounded border border-black/[.15] px-3 py-2 text-[13px] outline-none focus:border-[#5F4AA8]" />
              <div className="flex gap-2">
                <button type="button" onClick={() => void decidir("recusar")} disabled={saving || !motivo.trim()} className="rounded border border-[#B64545]/40 px-3 py-2 text-[12px] font-semibold text-[#B64545] disabled:opacity-40">Confirmar recusa</button>
                <button type="button" onClick={() => setRecusando(false)} className="px-3 py-2 text-[12px] text-black/50">Voltar</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => void decidir("aprovar")} disabled={saving} className="inline-flex items-center gap-1.5 rounded bg-[#2E8932] px-3.5 py-2 text-[12px] font-semibold text-white disabled:opacity-40"><Check size={13} />Aprovar e atribuir</button>
              <button type="button" onClick={() => setRecusando(true)} disabled={saving} className="inline-flex items-center gap-1.5 rounded border border-black/[.12] px-3 py-2 text-[12px] font-medium text-black/60"><X size={13} />Recusar</button>
            </div>
          )}
        </div>
      )}

      {pedido.status === "aprovado" && pedido.atribuicao_id && onOpenAtribuicao && (
        <button type="button" onClick={() => onOpenAtribuicao(pedido.atribuicao_id!)} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#5F4AA8] hover:underline">
          <MessageCircle size={13} />Abrir acompanhamento
        </button>
      )}
      {erro && <p role="alert" className="text-[11px] font-medium text-[#B64545]">{erro}</p>}
    </section>
  );
}

export function AtribuicaoConversa({ id, organizationId, pedido, onSent, isGestor = false }: {
  id: string;
  organizationId: string;
  pedido?: WorkspacePedido | null;
  onSent?: () => void;
  isGestor?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const organizationName = useOrganizationName() || "sua organização";
  const [notas, setNotas] = useState<{ id: string; autor_email: string; nota: string; created_at: string }[]>([]);
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [proximo, setProximo] = useState<{ texto: string | null; data: string | null; aguardando: "captador" | "gestor" | null } | null>(null);
  const [editarProximo, setEditarProximo] = useState(false);
  const [textoProximo, setTextoProximo] = useState("");
  const [dataProximo, setDataProximo] = useState("");
  const [aguardando, setAguardando] = useState<"captador" | "gestor">("captador");

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const { data, error } = await (supabase as any).from("atribuicao_notas")
      .select("id, autor_email, nota, created_at").eq("atribuicao_id", id).order("created_at", { ascending: true });
    setNotas((data ?? []) as typeof notas);
    setErro(error?.message ?? null);
    setLoading(false);
  }, [id, supabase]);
  const carregarProximo = useCallback(async () => {
    const { data } = await (supabase as any).rpc("fn_workspace_obter_proximo_passo", { p_atribuicao_id: id });
    if (data) setProximo(data as typeof proximo);
  }, [id, supabase]);
  useEffect(() => {
    const initial = window.setTimeout(() => { void carregar(); void carregarProximo(); }, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") { void carregar(true); void carregarProximo(); } }, 20_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [carregar, carregarProximo]);

  async function salvarProximo() {
    if (!textoProximo.trim() || saving) return;
    setSaving(true);
    setErro(null);
    const { error } = await (supabase as any).rpc("fn_workspace_definir_proximo_passo", {
      p_atribuicao_id: id, p_texto: textoProximo.trim(),
      p_data: dataProximo || null, p_aguardando: aguardando,
    });
    setSaving(false);
    if (error) { setErro(error.message); return; }
    setEditarProximo(false);
    await Promise.all([carregarProximo(), carregar()]);
    onSent?.();
  }

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
    await carregar();
    onSent?.();
  }

  return (
    <section aria-label="Acompanhamento compartilhado" className="space-y-4">
      {pedido && <div className="border-b border-black/[.08] pb-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-black/40">Como esta oportunidade começou</p>
        <PedidoConversa pedido={pedido} isGestor={false} onChange={() => {}} />
      </div>}
      <WorkspaceCoordination atribuicaoId={id} isGestor={isGestor} onChange={() => { void carregar(); onSent?.(); }} />
      {proximo && <div className="border-y border-black/[.08] py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-black/40">Próximo passo</p>
          {!editarProximo && <button type="button" onClick={() => { setTextoProximo(proximo.texto ?? ""); setDataProximo(proximo.data ?? ""); setAguardando(proximo.aguardando ?? "captador"); setEditarProximo(true); }} className="text-[11px] font-semibold text-[#5F4AA8] hover:underline">{proximo.texto ? "Alterar" : "Definir"}</button>}
        </div>
        {editarProximo ? <div className="mt-3 space-y-2">
          <label htmlFor={`proximo-${id}`} className="block text-[11px] text-black/55">O que precisa acontecer?</label>
          <input id={`proximo-${id}`} value={textoProximo} onChange={event => setTextoProximo(event.target.value)} maxLength={500}
            className="h-10 w-full rounded border border-black/[.15] px-3 text-[13px] outline-none focus:border-[#5F4AA8]" />
          <div className="flex flex-wrap gap-2">
            <div className="text-[11px] text-black/55">Responsável
              <div className="mt-1 inline-flex overflow-hidden rounded border border-black/[.15] align-middle">
                {(["captador", "gestor"] as const).map(opcao => <button key={opcao} type="button" onClick={() => setAguardando(opcao)} aria-pressed={aguardando === opcao}
                  className={`px-3 py-2 text-[12px] transition ${aguardando === opcao ? "bg-[#171717] text-white" : "bg-white text-black/60 hover:bg-black/[.04]"}`}>{opcao === "captador" ? "Captador" : organizationName}</button>)}
              </div>
            </div>
            <label className="text-[11px] text-black/55">Até <input type="date" value={dataProximo} onChange={event => setDataProximo(event.target.value)}
              className="ml-1 h-9 rounded border border-black/[.15] bg-white px-2 text-[12px] text-black" /></label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void salvarProximo()} disabled={saving || !textoProximo.trim()} className="rounded bg-[#171717] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-40">{saving ? "Salvando…" : "Salvar próximo passo"}</button>
            <button type="button" onClick={() => setEditarProximo(false)} className="px-2 py-2 text-[12px] text-black/50">Cancelar</button>
          </div>
        </div> : proximo.texto ? <div className="mt-2">
          <p className="text-[13px] font-medium text-black/80">{proximo.texto}</p>
          <p className="mt-1 text-[11px] text-black/45">Com {proximo.aguardando === "gestor" ? organizationName : "o captador"}{proximo.data ? ` · até ${proximo.data.split("-").reverse().join("/")}` : ""}</p>
        </div> : <p className="mt-2 text-[12px] text-black/45">Não definido.</p>}
      </div>}
      <div className="max-h-72 space-y-3 overflow-y-auto" aria-live="polite">
        {loading ? <p className="text-[12px] text-black/40">Carregando acompanhamento…</p> : notas.length === 0 ? (
          <p className="text-[12px] text-black/45">Nenhuma atualização.</p>
        ) : notas.map(n => (
          <div key={n.id} className="border-l-2 border-black/[.12] pl-3">
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-black/75">{n.nota}</p>
            <p className="mt-1 text-[11px] text-black/40">{n.autor_email} · <DataMensagem data={n.created_at} /></p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <label htmlFor={`atribuicao-mensagem-${id}`} className="block text-[11px] font-medium text-black/55">Atualização para o outro lado</label>
        <textarea id={`atribuicao-mensagem-${id}`} value={texto} onChange={event => setTexto(event.target.value)} rows={3}
          placeholder="O que aconteceu? Qual é o próximo passo?" className="w-full resize-none rounded border border-black/[.15] px-3 py-2 text-[13px] outline-none focus:border-[#5F4AA8] focus:ring-2 focus:ring-[#5F4AA8]/10" />
        <button type="button" onClick={() => void enviar()} disabled={saving || !texto.trim()}
          className="inline-flex items-center gap-1.5 rounded bg-[#171717] px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5F4AA8] disabled:opacity-40">
          <Send size={13} />{saving ? "Enviando…" : "Registrar atualização"}
        </button>
      </div>
      {erro && <p role="alert" className="text-[11px] font-medium text-[#B64545]">{erro}</p>}
    </section>
  );
}
