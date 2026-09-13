"use client";

import { useEffect, useState } from "react";
import { Briefcase, Check, Plus, Search, Send, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";

type EscopoTipo = "empresas" | "negociacoes" | "inscricoes";
type EscopoModo = "pedido" | "consulta" | "ver_tudo";
type Escopo = { tipo: EscopoTipo; habilitado: boolean; modo: EscopoModo };
type PedidoStatus = "pendente" | "aprovado" | "recusado";
type Pedido = { id: string; tipo: EscopoTipo; nome_busca: string; status: PedidoStatus; created_at: string };

const TIPO_LABEL: Record<EscopoTipo, string> = {
  empresas: "Empresas",
  negociacoes: "Negociações",
  inscricoes: "Inscrições",
};

const MODO_LABEL: Record<EscopoModo, string> = {
  pedido: "Solicitação — pede acesso e espera aprovação",
  consulta: "Consulta — verifica um item específico",
  ver_tudo: "Ver tudo — lista completa",
};

const TRIGGER_LABEL: Record<EscopoModo, string> = {
  pedido: "Nova solicitação",
  consulta: "Consultar",
  ver_tudo: "Adicionar",
};

const STATUS_PEDIDO: Record<PedidoStatus, { label: string; cor: string; fundo: string }> = {
  pendente: { label: "Pendente", cor: "#B07A14", fundo: "#B07A1414" },
  aprovado: { label: "Aprovado", cor: "#2E8932", fundo: "#2E893214" },
  recusado: { label: "Recusado", cor: "#D94E4E", fundo: "#D94E4E14" },
};

type LinhaEmpresa = { id: string; nome: string; status: string | null };
type LinhaCaptacao = { id: string; titulo: string; status: string; empresaNome: string };
type SheetState = { tipo: EscopoTipo; modo: EscopoModo };

function TriggerButton({ modo, onClick }: { modo: EscopoModo; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-1.5 rounded bg-[#0D0D0D] px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-black/80 active:scale-[.98]"
    >
      <Plus size={13} />{TRIGGER_LABEL[modo]}
    </button>
  );
}

function StatusPedidoBadge({ status }: { status: PedidoStatus }) {
  const cfg = STATUS_PEDIDO[status];
  return <span className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: cfg.cor, background: cfg.fundo }}>{cfg.label}</span>;
}

function TopSheet({ titulo, onClose, children, footer }: { titulo: string; onClose: () => void; children: React.ReactNode; footer: (close: () => void) => React.ReactNode }) {
  const [sheetVisible, setSheetVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setSheetVisible(true)));
  }, []);

  function close() {
    setSheetVisible(false);
    setTimeout(onClose, 260);
  }

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ background: sheetVisible ? "rgba(0,0,0,.38)" : "rgba(0,0,0,0)", transition: "background 260ms ease" }}
      onClick={close}
    >
      <div
        className="absolute left-1/2 top-0 overflow-hidden rounded-b bg-white"
        style={{
          width: 440,
          maxWidth: "92vw",
          transform: sheetVisible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(-100%)",
          transition: "transform 260ms cubic-bezier(.32,.72,0,1)",
        }}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <h3 className="text-[14px] font-semibold text-black/80">{titulo}</h3>
          <button onClick={close} className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/[.05]">
            <X size={14} className="text-black/40" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          {footer(close)}
        </div>
      </div>
    </div>
  );
}

function BuscarOuCriarSheet({
  workspaceId, tipo, variant, onClose, onCriado,
}: {
  workspaceId: string;
  tipo: EscopoTipo;
  variant: "consulta" | "ver_tudo";
  onClose: () => void;
  onCriado?: () => void;
}) {
  const supabase = createClient();
  const [nome, setNome] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ livre: boolean; encontrado?: any } | null>(null);

  async function consultar() {
    if (!nome.trim()) return;
    setBuscando(true);
    setErro(null);
    const { data, error } = await (supabase as any).rpc("fn_captador_consultar", {
      p_workspace_id: workspaceId,
      p_tipo: tipo,
      p_nome_busca: nome.trim(),
    });
    setBuscando(false);
    if (error) { setErro(error.message); return; }
    setResultado(data);
    if (data?.livre) onCriado?.();
  }

  return (
    <TopSheet
      titulo={`${variant === "ver_tudo" ? "Adicionar" : "Consultar"} — ${TIPO_LABEL[tipo]}`}
      onClose={onClose}
      footer={(close: () => void) => !resultado ? (
        <>
          <button onClick={close} className="text-[12px] font-medium text-black/35 transition hover:text-black/55">Cancelar</button>
          <button
            onClick={() => void consultar()}
            disabled={buscando || !nome.trim()}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#26752A] active:scale-[.98] disabled:opacity-40"
          >
            <Search size={12} />{buscando ? "Consultando…" : variant === "ver_tudo" ? "Adicionar" : "Consultar"}
          </button>
        </>
      ) : (
        <button onClick={close} className="rounded bg-[#0D0D0D] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-black/80 active:scale-[.98]">
          Fechar
        </button>
      )}
    >
      {!resultado ? (
        <>
          <label className="mb-1.5 block text-[11px] font-medium text-black/45">Nome</label>
          <input
            value={nome}
            onChange={event => { setNome(event.target.value); setErro(null); }}
            onKeyDown={event => { if (event.key === "Enter") void consultar(); }}
            placeholder="Nome da empresa…"
            autoFocus
            className="h-10 w-full rounded border border-black/[.15] bg-white px-3 text-[13px] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5] focus:ring-2 focus:ring-[#7259B5]/10"
          />
          {erro && <p className="mt-2 text-[11px] font-medium text-[#D94E4E]">{erro}</p>}
        </>
      ) : resultado.livre ? (
        <div className="flex items-center gap-2.5 rounded border border-[#2E8932]/25 bg-[#2E8932]/[.06] px-3.5 py-3">
          <Check size={16} className="shrink-0 text-[#2E8932]" />
          <p className="text-[12.5px] font-medium text-black/70">
            {variant === "ver_tudo"
              ? <><strong className="text-black">{nome}</strong> foi adicionado.</>
              : <><strong className="text-black">{nome}</strong> está livre — pode prosseguir. Já registramos o seu interesse.</>}
          </p>
        </div>
      ) : (
        <div className="rounded border border-[#D94E4E]/25 bg-[#D94E4E]/[.06] px-3.5 py-3">
          <p className="text-[12.5px] font-medium text-black/70">
            <strong className="text-black">{resultado.encontrado?.empresa ?? resultado.encontrado?.nome ?? nome}</strong> já está em andamento{resultado.encontrado?.titulo ? ` (${resultado.encontrado.titulo})` : ""}.
          </p>
          {resultado.encontrado?.status && <p className="mt-1 text-[11px] uppercase tracking-wide text-black/40">{resultado.encontrado.status}</p>}
        </div>
      )}
    </TopSheet>
  );
}

function NovaSolicitacaoSheet({
  workspaceId, tipo, onClose, onEnviado,
}: { workspaceId: string; tipo: EscopoTipo; onClose: () => void; onEnviado: () => void }) {
  const supabase = createClient();
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(close: () => void) {
    if (!nome.trim()) return;
    setEnviando(true);
    setErro(null);
    const { error } = await (supabase as any).from("captador_workspace_pedidos").insert({
      workspace_id: workspaceId,
      tipo,
      nome_busca: nome.trim(),
      mensagem: mensagem.trim() || null,
    });
    setEnviando(false);
    if (error) { setErro(error.message); return; }
    onEnviado();
    close();
  }

  return (
    <TopSheet
      titulo={`Nova solicitação — ${TIPO_LABEL[tipo]}`}
      onClose={onClose}
      footer={(close: () => void) => (
        <>
          <button onClick={close} className="text-[12px] font-medium text-black/35 transition hover:text-black/55">Cancelar</button>
          <button
            onClick={() => void enviar(close)}
            disabled={enviando || !nome.trim()}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#26752A] active:scale-[.98] disabled:opacity-40"
          >
            <Send size={12} />{enviando ? "Enviando…" : "Enviar solicitação"}
          </button>
        </>
      )}
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-black/45">Nome</label>
          <input
            value={nome}
            onChange={event => setNome(event.target.value)}
            placeholder="Nome da empresa ou edital…"
            autoFocus
            className="h-10 w-full rounded border border-black/[.15] bg-white px-3 text-[13px] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5] focus:ring-2 focus:ring-[#7259B5]/10"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-black/45">Mensagem (opcional)</label>
          <textarea
            value={mensagem}
            onChange={event => setMensagem(event.target.value)}
            placeholder="Contexto para quem for aprovar…"
            rows={3}
            className="w-full resize-none rounded border border-black/[.15] bg-white px-3 py-2 text-[13px] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5] focus:ring-2 focus:ring-[#7259B5]/10"
          />
        </div>
        {erro && <p className="text-[11px] font-medium text-[#D94E4E]">{erro}</p>}
      </div>
    </TopSheet>
  );
}

export default function WorkspaceCaptadorPage() {
  const organizationId = useOrganizationId();
  const [carregando, setCarregando] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [escopos, setEscopos] = useState<Escopo[] | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [empresas, setEmpresas] = useState<LinhaEmpresa[]>([]);
  const [negociacoes, setNegociacoes] = useState<LinhaCaptacao[]>([]);
  const [inscricoes, setInscricoes] = useState<LinhaCaptacao[]>([]);
  const [sheetAberto, setSheetAberto] = useState<SheetState | null>(null);

  async function carregarPedidos(wsId: string) {
    const supabase = createClient();
    const { data } = await (supabase as any)
      .from("captador_workspace_pedidos")
      .select("id, tipo, nome_busca, status, created_at")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false });
    setPedidos((data ?? []) as Pedido[]);
  }

  async function carregarEmpresas(orgId: string) {
    const supabase = createClient();
    const { data } = await (supabase as any)
      .from("empresas_crm")
      .select("id, nome, status")
      .eq("organization_id", orgId)
      .order("nome");
    setEmpresas((data ?? []) as LinhaEmpresa[]);
  }

  async function carregarNegociacoes(orgId: string) {
    const supabase = createClient();
    const { data } = await (supabase as any)
      .from("captacoes")
      .select("id, titulo, status, empresa_crm:empresas_crm!empresa_crm_id(nome), empresa_pub:empresas!empresa_id(nome)")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false });
    setNegociacoes(((data ?? []) as any[]).map(r => ({
      id: r.id, titulo: r.titulo, status: r.status,
      empresaNome: r.empresa_crm?.nome ?? r.empresa_pub?.nome ?? "—",
    })));
  }

  async function carregarInscricoes(orgId: string) {
    const supabase = createClient();
    const { data } = await (supabase as any)
      .from("editais_user")
      .select("id, titulo, status, empresas_crm!empresa_crm_id(nome), empresas!empresa_pub_id(nome)")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false });
    setInscricoes(((data ?? []) as any[]).map(r => ({
      id: r.id, titulo: r.titulo ?? "Sem título", status: r.status,
      empresaNome: r.empresas_crm?.nome ?? r.empresas?.nome ?? "—",
    })));
  }

  useEffect(() => {
    async function carregar() {
      if (!organizationId) return;
      setCarregando(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: captador } = await (supabase as any)
        .from("captadores")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!captador) { setNaoEncontrado(true); setCarregando(false); return; }

      const { data: workspace } = await (supabase as any)
        .from("captador_workspaces")
        .select("id, captador_workspace_escopos(tipo, habilitado, modo)")
        .eq("captador_id", captador.id)
        .maybeSingle();

      if (!workspace) { setNaoEncontrado(true); setCarregando(false); return; }

      setWorkspaceId(workspace.id);
      const escoposCarregados = (workspace.captador_workspace_escopos ?? []) as Escopo[];
      setEscopos(escoposCarregados);
      void carregarPedidos(workspace.id);

      const verTudo = (tipo: EscopoTipo) => escoposCarregados.some(e => e.tipo === tipo && e.habilitado && e.modo === "ver_tudo");

      if (verTudo("empresas")) await carregarEmpresas(organizationId);
      if (verTudo("negociacoes")) await carregarNegociacoes(organizationId);
      if (verTudo("inscricoes")) await carregarInscricoes(organizationId);

      setCarregando(false);
    }
    void carregar();
  }, [organizationId]);

  if (carregando) return null;

  const habilitados = (escopos ?? []).filter(e => e.habilitado);

  function ListaCaptacao({ linhas, vazio }: { linhas: LinhaCaptacao[]; vazio: string }) {
    if (linhas.length === 0) return <p className="mt-3 text-[12px] text-black/35">{vazio}</p>;
    return (
      <div className="mt-3 divide-y divide-black/[.06] rounded border border-black/[.08]">
        {linhas.map(linha => (
          <div key={linha.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-medium text-black/80">{linha.titulo}</p>
              <p className="truncate text-[11px] text-black/40">{linha.empresaNome}</p>
            </div>
            <span className="shrink-0 rounded bg-black/[.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-black/50">{linha.status}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded bg-black/[.05]"><Briefcase size={20} className="text-black" /></div>
        <div>
          <h1 className="text-[22px] font-bold text-black">Seu workspace</h1>
          <p className="text-[13px] text-black/45">Acesso limitado configurado pela organização que te convidou.</p>
        </div>
      </div>

      {naoEncontrado ? (
        <p className="mt-8 text-[13px] text-black/50">Não encontramos um workspace configurado pra você nesta organização.</p>
      ) : habilitados.length === 0 ? (
        <p className="mt-8 text-[13px] text-black/50">Nenhum acesso foi habilitado ainda. Fale com quem te convidou.</p>
      ) : (
        <div className="mt-8 space-y-3">
          {habilitados.map(escopo => {
            const meusPedidos = pedidos.filter(p => p.tipo === escopo.tipo);
            return (
              <div key={escopo.tipo} className="rounded border border-black/[.10] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold text-black">{TIPO_LABEL[escopo.tipo]}</p>
                    <p className="mt-1 text-[12px] text-black/45">{MODO_LABEL[escopo.modo]}</p>
                  </div>
                  <TriggerButton modo={escopo.modo} onClick={() => setSheetAberto({ tipo: escopo.tipo, modo: escopo.modo })} />
                </div>

                {escopo.modo === "ver_tudo" && (
                  escopo.tipo === "empresas" ? (
                    empresas.length === 0 ? <p className="mt-3 text-[12px] text-black/35">Nenhuma empresa cadastrada ainda.</p> : (
                      <div className="mt-3 divide-y divide-black/[.06] rounded border border-black/[.08]">
                        {empresas.map(e => (
                          <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                            <p className="truncate text-[12.5px] font-medium text-black/80">{e.nome}</p>
                            {e.status && <span className="shrink-0 rounded bg-black/[.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-black/50">{e.status}</span>}
                          </div>
                        ))}
                      </div>
                    )
                  ) : escopo.tipo === "negociacoes" ? (
                    <ListaCaptacao linhas={negociacoes} vazio="Nenhuma negociação em andamento." />
                  ) : (
                    <ListaCaptacao linhas={inscricoes} vazio="Nenhuma inscrição em andamento." />
                  )
                )}

                {escopo.modo === "pedido" && meusPedidos.length > 0 && (
                  <div className="mt-3 border-t border-black/[.07] pt-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-black/30">Minhas solicitações</p>
                    <div className="divide-y divide-black/[.06] rounded border border-black/[.08]">
                      {meusPedidos.map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <p className="truncate text-[12.5px] font-medium text-black/80">{p.nome_busca}</p>
                          <StatusPedidoBadge status={p.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sheetAberto && workspaceId && (
        sheetAberto.modo === "pedido" ? (
          <NovaSolicitacaoSheet
            workspaceId={workspaceId}
            tipo={sheetAberto.tipo}
            onClose={() => setSheetAberto(null)}
            onEnviado={() => void carregarPedidos(workspaceId)}
          />
        ) : (
          <BuscarOuCriarSheet
            workspaceId={workspaceId}
            tipo={sheetAberto.tipo}
            variant={sheetAberto.modo === "ver_tudo" ? "ver_tudo" : "consulta"}
            onClose={() => setSheetAberto(null)}
            onCriado={() => {
              if (!organizationId) return;
              if (sheetAberto.tipo === "empresas") void carregarEmpresas(organizationId);
              else if (sheetAberto.tipo === "negociacoes") void carregarNegociacoes(organizationId);
              else void carregarInscricoes(organizationId);
            }}
          />
        )
      )}
    </div>
  );
}
