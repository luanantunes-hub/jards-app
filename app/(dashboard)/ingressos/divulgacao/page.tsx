"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { ListContent, ListPageHeader, PrimaryListAction, SecondaryListAction } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { AcaoSheet, AcoesDaLoja, DivulgacaoDaLoja, LinkDeDivulgacaoSheet } from "@/components/ticketeria/DivulgacaoView";
import { ConexoesDaLoja, EscolherContaSheet, type ContaParaEscolher, type EstadoDoMeta } from "@/components/ticketeria/ConexoesView";
import { gastoParaCampo, lerAcao, type CamposDaAcao, type DivulgacaoDaLoja as DadosDaDivulgacao } from "@/lib/ticketeria/divulgacao";

type Aba = "origem" | "acoes" | "conexoes";
const ABAS: { valor: Aba; rotulo: string }[] = [{ valor: "origem", rotulo: "De onde vieram" }, { valor: "acoes", rotulo: "Ações e gasto" }, { valor: "conexoes", rotulo: "Conexões" }];
/** O que a volta do login da Meta conta (?meta=…): a frase quando não deu certo. */
const AVISO_DO_RETORNO: Record<string, string> = {
  negado: "O Meta não liberou o acesso. Conecte de novo e aceite a leitura dos anúncios.", invalido: "Não foi possível confirmar o login do Meta. Conecte de novo.",
  falhou: "Não foi possível concluir a conexão com o Meta. Tente de novo.", indisponivel: "A conexão com o Meta ainda não está disponível.",
};

/** Divulgação: de onde vieram as vendas, o link de divulgação de cada sessão e as ações (com gasto) cruzadas com as vendas por dia. Lê da rota do servidor, que confere quem edita a Ticketeria. */
export default function DivulgacaoPage() {
  const organizationId = useOrganizationId();
  const [estado, setEstado] = useState<{ lojaId: string | null; dados: DadosDaDivulgacao | null } | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("origem");
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [versao, setVersao] = useState(0);
  // A folha de ação: `null` fechada; `{ id: null }` registrando; `{ id }` editando.
  const [acao, setAcao] = useState<{ id: string | null; valores: CamposDaAcao } | null>(null);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  // As conexões de mídia (aba Conexões): o estado do Meta, a folha de escolher a conta e o que a volta do login contou.
  const [meta, setMeta] = useState<EstadoDoMeta>({ disponivel: false, conexao: null });
  const [escolhendo, setEscolhendo] = useState<{ contas: ContaParaEscolher[] | null; escolhida: string | null; erro: string | null } | null>(null);
  const [ocupadoMeta, setOcupadoMeta] = useState(false);
  const [avisoMeta, setAvisoMeta] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data: loja, error } = await clienteDaTicketeria(createClient()).from("ticketeria_lojas").select("id").eq("organization_id", organizationId).maybeSingle();
      if (!ativo) return;
      if (error) { setErro("Não foi possível carregar a divulgação. Recarregue a página."); setEstado({ lojaId: null, dados: null }); return; }
      if (!loja) { setEstado({ lojaId: null, dados: { linhas: [], sessoes: [], acoes: [], por_dia: {}, hoje: new Date().toISOString().slice(0, 10) } }); return; }
      try {
        const resposta = await fetch(`/api/ticketeria/lojas/${loja.id}/divulgacao`, { cache: "no-store" });
        if (!resposta.ok) throw new Error(String(resposta.status));
        const dados = (await resposta.json()) as DadosDaDivulgacao;
        const c = await fetch(`/api/ticketeria/lojas/${loja.id}/conexoes`, { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).catch(() => null) as { meta?: EstadoDoMeta } | null;
        if (ativo) { setErro(null); setEstado({ lojaId: loja.id, dados }); if (c?.meta) setMeta(c.meta); }
      } catch {
        if (ativo) { setErro("Não foi possível carregar a divulgação. Só quem edita a Ticketeria vê esta página."); setEstado({ lojaId: loja.id, dados: null }); }
      }
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  // A volta do login da Meta (?aba=conexoes&meta=…): abre a aba, a escolha da conta ou o aviso, e limpa o endereço.
  useEffect(() => {
    if (!estado?.lojaId) return;
    queueMicrotask(() => {
      const p = new URLSearchParams(window.location.search);
      if (p.get("aba") === "conexoes") setAba("conexoes");
      const m = p.get("meta");
      if (m === "escolher") void abrirEscolha();
      else if (m && AVISO_DO_RETORNO[m]) setAvisoMeta(AVISO_DO_RETORNO[m]);
      if (p.has("aba") || p.has("meta")) window.history.replaceState(null, "", window.location.pathname);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado?.lojaId]);

  const abrirNova = useCallback((hoje: string) => { setAcaoErro(null); setAcao({ id: null, valores: { nome: "", canal: "instagram", inicio: hoje, fim: hoje, gasto: "" } }); }, []);

  async function salvar() {
    if (!acao || !estado?.lojaId || !organizationId) return;
    const lida = lerAcao(acao.valores);
    if (!lida.ok) { setAcaoErro(lida.erro); return; }
    setSalvando(true);
    setAcaoErro(null);
    const t = clienteDaTicketeria(createClient());
    const { error } = acao.id
      ? await t.from("ticketeria_acoes_divulgacao").update(lida.valor).eq("id", acao.id)
      : await t.from("ticketeria_acoes_divulgacao").insert({ ...lida.valor, organization_id: organizationId, loja_id: estado.lojaId });
    setSalvando(false);
    if (error) { setAcaoErro("Não foi possível salvar a ação. Tente de novo."); return; }
    setAcao(null);
    setVersao(v => v + 1);
  }

  async function apagar() {
    if (!acao?.id) return;
    setSalvando(true);
    setAcaoErro(null);
    const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_acoes_divulgacao").delete().eq("id", acao.id);
    setSalvando(false);
    if (error) { setAcaoErro("Não foi possível apagar a ação. Tente de novo."); return; }
    setAcao(null);
    setVersao(v => v + 1);
  }

  async function abrirEscolha() {
    if (!estado?.lojaId) return;
    setEscolhendo({ contas: null, escolhida: null, erro: null });
    try {
      const r = await fetch(`/api/ticketeria/lojas/${estado.lojaId}/conexoes/meta/contas`, { cache: "no-store" });
      const d = (await r.json().catch(() => ({}))) as { contas?: ContaParaEscolher[]; mensagem?: string };
      if (!r.ok || !d.contas) { setEscolhendo({ contas: [], escolhida: null, erro: d.mensagem ?? "Não foi possível buscar as contas agora. Tente de novo." }); return; }
      setEscolhendo({ contas: d.contas, escolhida: d.contas.find(c => c.suportada && c.ativa)?.id ?? null, erro: null });
    } catch { setEscolhendo({ contas: [], escolhida: null, erro: "Sem conexão. Tente de novo." }); }
  }

  async function confirmarConta() {
    if (!estado?.lojaId || !escolhendo?.escolhida) return;
    setSalvando(true);
    setEscolhendo(e => (e ? { ...e, erro: null } : e));
    try {
      const r = await fetch(`/api/ticketeria/lojas/${estado.lojaId}/conexoes/meta/contas`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conta_id: escolhendo.escolhida }) });
      const d = (await r.json().catch(() => ({}))) as { mensagem?: string; leitura?: { ok: boolean; erro?: string } };
      if (!r.ok) { setEscolhendo(e => (e ? { ...e, erro: d.mensagem ?? "Não foi possível conectar esta conta. Tente de novo." } : e)); return; }
      setEscolhendo(null);
      if (d.leitura && !d.leitura.ok) setAvisoMeta(d.leitura.erro ?? "A conta foi conectada, mas a primeira leitura não deu certo. Use Ler agora.");
      setVersao(v => v + 1);
    } catch { setEscolhendo(e => (e ? { ...e, erro: "Sem conexão. Tente de novo." } : e)); } finally { setSalvando(false); }
  }

  /** Vai para a rota que abre o login do Meta: é uma rota de servidor que redireciona para fora do app, então tem de ser navegação do navegador (não do roteador). */
  function conectarMeta() {
    if (!estado?.lojaId) return;
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/ticketeria/lojas/${estado.lojaId}/conexoes/meta/iniciar`;
  }

  async function lerMeta() {
    if (!estado?.lojaId) return;
    setOcupadoMeta(true);
    setAvisoMeta(null);
    try {
      const r = await fetch(`/api/ticketeria/lojas/${estado.lojaId}/conexoes/meta/ler`, { method: "POST" });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; erro?: string };
      if (!r.ok || d.ok === false) setAvisoMeta(d.erro ?? "Não foi possível ler o Meta agora. Tente mais tarde.");
    } catch { setAvisoMeta("Sem conexão. Tente de novo."); } finally { setOcupadoMeta(false); setVersao(v => v + 1); }
  }

  async function desconectarMeta() {
    if (!estado?.lojaId || !window.confirm("Desconectar o Meta Ads? O gasto já lido fica guardado; para voltar a ler, é só conectar de novo.")) return;
    setOcupadoMeta(true);
    try { await fetch(`/api/ticketeria/lojas/${estado.lojaId}/conexoes/meta`, { method: "DELETE" }); } finally { setOcupadoMeta(false); setVersao(v => v + 1); }
  }

  if (estado === undefined || !organizationId) return <DetailPageSkeleton />;
  const dados = estado.dados;
  const acoes = (
    <>
      {dados && aba === "acoes" && <SecondaryListAction onClick={() => abrirNova(dados.hoje)}>Registrar ação</SecondaryListAction>}
      {dados && <PrimaryListAction onClick={() => setCriando(true)}><Link2 size={13} aria-hidden="true" /> Criar link de divulgação</PrimaryListAction>}
    </>
  );
  return (
    <>
      <ListPageHeader title="Divulgação" actions={dados ? acoes : undefined} />
      <ListContent>
        {erro && <p role="alert" className="mb-4 rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {dados && (
          <div className="space-y-4">
            <div className="flex gap-2" role="group" aria-label="O que ver">
              {ABAS.map(a => (
                <button key={a.valor} type="button" onClick={() => setAba(a.valor)} aria-pressed={aba === a.valor}
                  className={`rounded-xl border px-3.5 py-1.5 text-[0.8125rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${aba === a.valor ? "border-[#7259B5] bg-[#F5F2FB] font-normal text-[#1C0E33]" : "bg-white text-black/60 hover:bg-black/[.03]"}`}
                  style={aba === a.valor ? undefined : { borderColor: "rgba(13,13,13,.08)" }}>{a.rotulo}</button>
              ))}
            </div>
            {aba === "origem"
              ? <DivulgacaoDaLoja linhas={dados.linhas} sessoes={dados.sessoes} sessaoId={sessaoId} onSessao={setSessaoId} onCriarLink={() => setCriando(true)} />
              : aba === "conexoes"
              ? <ConexoesDaLoja meta={meta} aviso={avisoMeta} ocupado={ocupadoMeta} onConectar={conectarMeta} onEscolherConta={() => void abrirEscolha()} onLer={() => void lerMeta()} onDesconectar={() => void desconectarMeta()} />
              : <AcoesDaLoja acoes={dados.acoes} por_dia={dados.por_dia} hoje={dados.hoje} onRegistrar={() => abrirNova(dados.hoje)}
                  onAbrir={id => { const a = dados.acoes.find(x => x.id === id); if (a) { setAcaoErro(null); setAcao({ id, valores: { nome: a.nome, canal: a.canal, inicio: a.inicio, fim: a.fim, gasto: gastoParaCampo(a.gasto_centavos) } }); } }} />}
          </div>
        )}
      </ListContent>
      {criando && dados && <LinkDeDivulgacaoSheet sessoes={dados.sessoes} origem={window.location.origin} sessaoInicial={sessaoId} onClose={() => setCriando(false)} />}
      {escolhendo && <EscolherContaSheet contas={escolhendo.contas} escolhida={escolhendo.escolhida} erro={escolhendo.erro} salvando={salvando} onEscolher={id => setEscolhendo(e => (e ? { ...e, escolhida: id } : e))} onClose={() => setEscolhendo(null)} onSalvar={() => void confirmarConta()} />}
      {acao && <AcaoSheet editando={acao.id !== null} valores={acao.valores} erro={acaoErro} salvando={salvando} onMudar={(campo, valor) => setAcao(a => (a ? { ...a, valores: { ...a.valores, [campo]: valor } } : a))} onClose={() => setAcao(null)} onSalvar={() => void salvar()} onApagar={() => void apagar()} />}
    </>
  );
}
