"use client";

import { useEffect, useState } from "react";
import { Briefcase, Check, Search, Send } from "lucide-react";
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

const STATUS_PEDIDO: Record<PedidoStatus, { label: string; cor: string; fundo: string }> = {
  pendente: { label: "Pendente", cor: "#B07A14", fundo: "#B07A1414" },
  aprovado: { label: "Aprovado", cor: "#2E8932", fundo: "#2E893214" },
  recusado: { label: "Recusado", cor: "#D94E4E", fundo: "#D94E4E14" },
};

type LinhaEmpresa = { id: string; nome: string; status: string | null };
type LinhaCaptacao = { id: string; titulo: string; status: string; empresaNome: string };

function StatusPedidoBadge({ status }: { status: PedidoStatus }) {
  const cfg = STATUS_PEDIDO[status];
  return <span className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: cfg.cor, background: cfg.fundo }}>{cfg.label}</span>;
}

function ConsultaPainel({ workspaceId, tipo }: { workspaceId: string; tipo: EscopoTipo }) {
  const supabase = createClient();
  const [nome, setNome] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ livre: boolean; encontrado?: any } | null>(null);

  async function consultar() {
    if (!nome.trim()) return;
    setBuscando(true);
    setErro(null);
    setResultado(null);
    const { data, error } = await (supabase as any).rpc("fn_captador_consultar", {
      p_workspace_id: workspaceId,
      p_tipo: tipo,
      p_nome_busca: nome.trim(),
    });
    setBuscando(false);
    if (error) { setErro(error.message); return; }
    setResultado(data);
  }

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <input
          value={nome}
          onChange={event => { setNome(event.target.value); setResultado(null); setErro(null); }}
          onKeyDown={event => { if (event.key === "Enter") void consultar(); }}
          placeholder="Nome da empresa…"
          className="h-9 min-w-0 flex-1 rounded border border-black/[.15] bg-white px-3 text-[12.5px] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5] focus:ring-2 focus:ring-[#7259B5]/10"
        />
        <button
          type="button"
          onClick={() => void consultar()}
          disabled={buscando || !nome.trim()}
          className="flex items-center gap-1.5 rounded bg-[#0D0D0D] px-3.5 text-[12px] font-semibold text-white transition hover:bg-black/80 disabled:opacity-40"
        >
          <Search size={13} />{buscando ? "Consultando…" : "Consultar"}
        </button>
      </div>

      {erro && <p className="mt-2 text-[11px] font-medium text-[#D94E4E]">{erro}</p>}

      {resultado && (
        resultado.livre ? (
          <div className="mt-3 flex items-center gap-2 rounded border border-[#2E8932]/25 bg-[#2E8932]/[.06] px-3 py-2.5">
            <Check size={14} className="shrink-0 text-[#2E8932]" />
            <p className="text-[12px] font-medium text-black/70"><strong className="text-black">{nome}</strong> está livre — pode prosseguir. Já registramos o seu interesse.</p>
          </div>
        ) : (
          <div className="mt-3 rounded border border-[#D94E4E]/25 bg-[#D94E4E]/[.06] px-3 py-2.5">
            <p className="text-[12px] font-medium text-black/70">
              <strong className="text-black">{resultado.encontrado?.empresa ?? resultado.encontrado?.nome ?? nome}</strong> já está em andamento{resultado.encontrado?.titulo ? ` (${resultado.encontrado.titulo})` : ""}.
            </p>
            {resultado.encontrado?.status && <p className="mt-0.5 text-[11px] uppercase tracking-wide text-black/40">{resultado.encontrado.status}</p>}
          </div>
        )
      )}
    </div>
  );
}

function PedidoPainel({ workspaceId, tipo, pedidos, onEnviado }: { workspaceId: string; tipo: EscopoTipo; pedidos: Pedido[]; onEnviado: () => void }) {
  const supabase = createClient();
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
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
    setNome(""); setMensagem("");
    onEnviado();
  }

  const meusPedidos = pedidos.filter(p => p.tipo === tipo);

  return (
    <div className="mt-3 space-y-3">
      <div className="space-y-2">
        <input
          value={nome}
          onChange={event => setNome(event.target.value)}
          placeholder="Nome da empresa ou edital…"
          className="h-9 w-full rounded border border-black/[.15] bg-white px-3 text-[12.5px] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5] focus:ring-2 focus:ring-[#7259B5]/10"
        />
        <textarea
          value={mensagem}
          onChange={event => setMensagem(event.target.value)}
          placeholder="Mensagem (opcional)…"
          rows={2}
          className="w-full resize-none rounded border border-black/[.15] bg-white px-3 py-2 text-[12.5px] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5] focus:ring-2 focus:ring-[#7259B5]/10"
        />
        {erro && <p className="text-[11px] font-medium text-[#D94E4E]">{erro}</p>}
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={enviando || !nome.trim()}
          className="flex items-center gap-1.5 rounded bg-[#0D0D0D] px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-black/80 disabled:opacity-40"
        >
          <Send size={12} />{enviando ? "Enviando…" : "Enviar solicitação"}
        </button>
      </div>

      {meusPedidos.length > 0 && (
        <div className="border-t border-black/[.07] pt-3">
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

  async function carregarPedidos(wsId: string) {
    const supabase = createClient();
    const { data } = await (supabase as any)
      .from("captador_workspace_pedidos")
      .select("id, tipo, nome_busca, status, created_at")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false });
    setPedidos((data ?? []) as Pedido[]);
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

      if (verTudo("empresas")) {
        const { data } = await (supabase as any)
          .from("empresas_crm")
          .select("id, nome, status")
          .eq("organization_id", organizationId)
          .order("nome");
        setEmpresas((data ?? []) as LinhaEmpresa[]);
      }

      if (verTudo("negociacoes")) {
        const { data } = await (supabase as any)
          .from("captacoes")
          .select("id, titulo, status, empresa_crm:empresas_crm!empresa_crm_id(nome), empresa_pub:empresas!empresa_id(nome)")
          .eq("organization_id", organizationId)
          .order("updated_at", { ascending: false });
        setNegociacoes(((data ?? []) as any[]).map(r => ({
          id: r.id, titulo: r.titulo, status: r.status,
          empresaNome: r.empresa_crm?.nome ?? r.empresa_pub?.nome ?? "—",
        })));
      }

      if (verTudo("inscricoes")) {
        const { data } = await (supabase as any)
          .from("editais_user")
          .select("id, titulo, status, empresas_crm!empresa_crm_id(nome), empresas!empresa_pub_id(nome)")
          .eq("organization_id", organizationId)
          .order("updated_at", { ascending: false });
        setInscricoes(((data ?? []) as any[]).map(r => ({
          id: r.id, titulo: r.titulo ?? "Sem título", status: r.status,
          empresaNome: r.empresas_crm?.nome ?? r.empresas?.nome ?? "—",
        })));
      }

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
          {habilitados.map(escopo => (
            <div key={escopo.tipo} className="rounded border border-black/[.10] p-4">
              <p className="text-[14px] font-semibold text-black">{TIPO_LABEL[escopo.tipo]}</p>
              <p className="mt-1 text-[12px] text-black/45">{MODO_LABEL[escopo.modo]}</p>

              {escopo.modo === "ver_tudo" ? (
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
              ) : escopo.modo === "consulta" ? (
                workspaceId && <ConsultaPainel workspaceId={workspaceId} tipo={escopo.tipo} />
              ) : (
                workspaceId && <PedidoPainel workspaceId={workspaceId} tipo={escopo.tipo} pedidos={pedidos} onEnviado={() => void carregarPedidos(workspaceId)} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
