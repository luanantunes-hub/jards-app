"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { ListContent, ListPageHeader, PrimaryListAction, SecondaryListAction } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { AcaoSheet, AcoesDaLoja, DivulgacaoDaLoja, LinkDeDivulgacaoSheet } from "@/components/ticketeria/DivulgacaoView";
import { HistoricoDaLoja, ImportarPlanilhaSheet } from "@/components/ticketeria/HistoricoView";
import { DatasDePicoSheet } from "@/components/ticketeria/DatasDePicoSheet";
import { SimularOrcamentoSheet } from "@/components/ticketeria/SimularOrcamentoSheet";
import { lerDataDePico, type CamposDaDataDePico, type DataDePico } from "@/lib/ticketeria/modelo-controles";
import { ModeloDaLoja, ResultadoDoModelo } from "@/components/ticketeria/ModeloView";
import type { ResultadoParaATela } from "@/lib/ticketeria/modelo-servidor";
import type { ProntidaoDoModelo } from "@/lib/ticketeria/modelo";
import type { CorpoDaImportacao, ImportacaoDaLista, TipoDeHistorico } from "@/lib/ticketeria/historico";
import { CARTOES, ConexoesDaLoja, EscolherContaSheet, type ContaParaEscolher, type EstadoDeMidia, type ProvedorDoCartao } from "@/components/ticketeria/ConexoesView";
import { gastoParaCampo, lerAcao, type CamposDaAcao, type DivulgacaoDaLoja as DadosDaDivulgacao } from "@/lib/ticketeria/divulgacao";

type Aba = "origem" | "acoes" | "conexoes" | "historico" | "modelo";
const ABAS: { valor: Aba; rotulo: string }[] = [{ valor: "origem", rotulo: "De onde vieram" }, { valor: "acoes", rotulo: "Ações e gasto" }, { valor: "conexoes", rotulo: "Conexões" }, { valor: "historico", rotulo: "Histórico" }, { valor: "modelo", rotulo: "Modelo" }];
/** O que a volta do login da Meta conta (?meta=…): a frase quando não deu certo. */
const AVISO_DO_RETORNO = (fonte: string): Record<string, string> => ({
  negado: `O ${fonte} não liberou o acesso. Conecte de novo e aceite a leitura dos anúncios.`, invalido: `Não foi possível confirmar o login do ${fonte}. Conecte de novo.`,
  falhou: `Não foi possível concluir a conexão com o ${fonte}. Tente de novo.`, indisponivel: `A conexão com o ${fonte} ainda não está disponível.`,
});
/** O pedaço do endereço das rotas de cada provedor (lib/ticketeria/midia/provedores.ts). */
const PEDACO: Record<ProvedorDoCartao, string> = { meta: "meta", google_ads: "google", ga4: "ga4" };
const SEM_CONEXAO: Record<ProvedorDoCartao, EstadoDeMidia> = { meta: { disponivel: false, conexao: null }, google_ads: { disponivel: false, conexao: null }, ga4: { disponivel: false, conexao: null } };

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
  const [conexoes, setConexoes] = useState<Record<ProvedorDoCartao, EstadoDeMidia>>(SEM_CONEXAO);
  const [escolhendo, setEscolhendo] = useState<{ provedor: ProvedorDoCartao; contas: ContaParaEscolher[] | null; escolhida: string | null; erro: string | null } | null>(null);
  const [ocupadoMidia, setOcupadoMidia] = useState<ProvedorDoCartao | null>(null);
  const [avisoMidia, setAvisoMidia] = useState<string | null>(null);
  // O histórico importado de planilha (aba Histórico): as importações, a folha de importar e o que está sendo desfeito.
  const [historico, setHistorico] = useState<{ importacoes: ImportacaoDaLista[]; semanas: Record<TipoDeHistorico, number> }>({ importacoes: [], semanas: { vendas: 0, gasto: 0 } });
  const [importando, setImportando] = useState(false);
  const [folhaDeImportar, setFolhaDeImportar] = useState(false);
  const [erroDeImportar, setErroDeImportar] = useState<string | null>(null);
  const [desfazendo, setDesfazendo] = useState<string | null>(null);
  // A prontidão do modelo (aba Modelo): lida só quando a aba é aberta (junta várias fontes).
  const [prontidao, setProntidao] = useState<ProntidaoDoModelo | null>(null);
  const [prontidaoErro, setProntidaoErro] = useState(false);
  const [resultadoDoModelo, setResultadoDoModelo] = useState<ResultadoParaATela | null>(null);
  // As datas de pico da loja (a folha "Adicionar uma data sua" da aba Modelo).
  const [datasDePico, setDatasDePico] = useState<DataDePico[]>([]);
  const [simulando, setSimulando] = useState(false);
  const [folhaDeDatas, setFolhaDeDatas] = useState<{ valores: CamposDaDataDePico; erro: string | null } | null>(null);

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
        const c = await fetch(`/api/ticketeria/lojas/${loja.id}/conexoes`, { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).catch(() => null) as Partial<Record<ProvedorDoCartao, EstadoDeMidia>> | null;
        const h = await fetch(`/api/ticketeria/lojas/${loja.id}/historico`, { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).catch(() => null) as { importacoes: ImportacaoDaLista[]; semanas: Record<TipoDeHistorico, number> } | null;
        if (ativo) { setErro(null); setEstado({ lojaId: loja.id, dados }); if (h) setHistorico(h); if (c) setConexoes({ meta: c.meta ?? SEM_CONEXAO.meta, google_ads: c.google_ads ?? SEM_CONEXAO.google_ads, ga4: c.ga4 ?? SEM_CONEXAO.ga4 }); }
      } catch {
        if (ativo) { setErro("Não foi possível carregar a divulgação. Só quem edita a Ticketeria vê esta página."); setEstado({ lojaId: loja.id, dados: null }); }
      }
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  // A volta do login (?aba=conexoes&conexao=…&resultado=…): abre a aba, a escolha da conta ou o aviso, e limpa o endereço.
  useEffect(() => {
    if (!estado?.lojaId) return;
    queueMicrotask(() => {
      const p = new URLSearchParams(window.location.search);
      if (p.get("aba") === "conexoes") setAba("conexoes");
      const provedor = (["meta", "google_ads", "ga4"] as const).find(x => x === p.get("conexao")) ?? null;
      const resultado = p.get("resultado");
      if (provedor && resultado === "escolher") void abrirEscolha(provedor);
      else if (provedor && resultado && AVISO_DO_RETORNO(CARTOES[provedor].fonte)[resultado]) setAvisoMidia(AVISO_DO_RETORNO(CARTOES[provedor].fonte)[resultado]);
      if (p.has("aba") || p.has("conexao")) window.history.replaceState(null, "", window.location.pathname);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado?.lojaId]);

  // A prontidão do modelo junta vendas, gasto e visitas: só se lê quando a aba é aberta (e de novo depois de importar ou ler uma conexão: `versao`).
  useEffect(() => {
    if (aba !== "modelo" || !estado?.lojaId) return;
    let ativo = true;
    void fetch(`/api/ticketeria/lojas/${estado.lojaId}/modelo`, { cache: "no-store" })
      .then(r => (r.ok ? (r.json() as Promise<ProntidaoDoModelo>) : Promise.reject(new Error(String(r.status)))))
      .then(p => { if (ativo) { setProntidao(p); setProntidaoErro(false); } })
      .catch(() => { if (ativo) setProntidaoErro(true); });
    void fetch(`/api/ticketeria/lojas/${estado.lojaId}/modelo/resultado`, { cache: "no-store" })
      .then(r => (r.ok ? (r.json() as Promise<{ resultado: ResultadoParaATela | null }>) : null))
      .then(d => { if (ativo && d) setResultadoDoModelo(d.resultado); })
      .catch(() => { /* sem resultado: segue a checklist */ });
    void clienteDaTicketeria(createClient()).from("ticketeria_datas_de_pico").select("id, dia, nome").eq("loja_id", estado.lojaId).order("dia", { ascending: true })
      .then(({ data }) => { if (ativo && data) setDatasDePico(data); });
    return () => { ativo = false; };
  }, [aba, estado?.lojaId, versao]);

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

  async function adicionarData() {
    if (!folhaDeDatas || !estado?.lojaId || !organizationId) return;
    const lida = lerDataDePico(folhaDeDatas.valores);
    if (!lida.ok) { setFolhaDeDatas(f => (f ? { ...f, erro: lida.erro } : f)); return; }
    setSalvando(true);
    const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_datas_de_pico").insert({ ...lida.valor, organization_id: organizationId, loja_id: estado.lojaId });
    setSalvando(false);
    if (error) { setFolhaDeDatas(f => (f ? { ...f, erro: error.code === "23505" ? "Já há uma data sua neste dia." : "Não foi possível adicionar a data. Tente de novo." } : f)); return; }
    setFolhaDeDatas({ valores: { dia: "", nome: "" }, erro: null });
    setVersao(v => v + 1);
  }

  async function apagarData(id: string) {
    setSalvando(true);
    const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_datas_de_pico").delete().eq("id", id);
    setSalvando(false);
    if (error) { setFolhaDeDatas(f => (f ? { ...f, erro: "Não foi possível remover a data. Tente de novo." } : f)); return; }
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

  async function abrirEscolha(provedor: ProvedorDoCartao) {
    if (!estado?.lojaId) return;
    setEscolhendo({ provedor, contas: null, escolhida: null, erro: null });
    try {
      const r = await fetch(`/api/ticketeria/lojas/${estado.lojaId}/conexoes/${PEDACO[provedor]}/contas`, { cache: "no-store" });
      const d = (await r.json().catch(() => ({}))) as { contas?: ContaParaEscolher[]; mensagem?: string };
      if (!r.ok || !d.contas) { setEscolhendo({ provedor, contas: [], escolhida: null, erro: d.mensagem ?? "Não foi possível buscar as contas agora. Tente de novo." }); return; }
      setEscolhendo({ provedor, contas: d.contas, escolhida: d.contas.find(c => c.suportada && c.ativa)?.id ?? null, erro: null });
    } catch { setEscolhendo({ provedor, contas: [], escolhida: null, erro: "Sem conexão. Tente de novo." }); }
  }

  async function confirmarConta() {
    if (!estado?.lojaId || !escolhendo?.escolhida) return;
    const provedor = escolhendo.provedor;
    setSalvando(true);
    setEscolhendo(e => (e ? { ...e, erro: null } : e));
    try {
      const r = await fetch(`/api/ticketeria/lojas/${estado.lojaId}/conexoes/${PEDACO[provedor]}/contas`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conta_id: escolhendo.escolhida }) });
      const d = (await r.json().catch(() => ({}))) as { mensagem?: string; leitura?: { ok: boolean; erro?: string } };
      if (!r.ok) { setEscolhendo(e => (e ? { ...e, erro: d.mensagem ?? "Não foi possível conectar esta conta. Tente de novo." } : e)); return; }
      setEscolhendo(null);
      if (d.leitura && !d.leitura.ok) setAvisoMidia(d.leitura.erro ?? "A conta foi conectada, mas a primeira leitura não deu certo. Use Ler agora.");
      setVersao(v => v + 1);
    } catch { setEscolhendo(e => (e ? { ...e, erro: "Sem conexão. Tente de novo." } : e)); } finally { setSalvando(false); }
  }

  /** Vai para a rota que abre o login da plataforma: é uma rota de servidor que redireciona para fora do app, então tem de ser navegação do navegador (não do roteador). */
  function conectar(provedor: ProvedorDoCartao) {
    if (!estado?.lojaId) return;
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/ticketeria/lojas/${estado.lojaId}/conexoes/${PEDACO[provedor]}/iniciar`;
  }

  async function ler(provedor: ProvedorDoCartao) {
    if (!estado?.lojaId) return;
    setOcupadoMidia(provedor);
    setAvisoMidia(null);
    try {
      const r = await fetch(`/api/ticketeria/lojas/${estado.lojaId}/conexoes/${PEDACO[provedor]}/ler`, { method: "POST" });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; erro?: string };
      if (!r.ok || d.ok === false) setAvisoMidia(d.erro ?? `Não foi possível ler o ${CARTOES[provedor].fonte} agora. Tente mais tarde.`);
    } catch { setAvisoMidia("Sem conexão. Tente de novo."); } finally { setOcupadoMidia(null); setVersao(v => v + 1); }
  }

  async function desconectar(provedor: ProvedorDoCartao) {
    if (!estado?.lojaId || !window.confirm(`Desconectar o ${CARTOES[provedor].nome}? O que já foi lido fica guardado; para voltar a ler, é só conectar de novo.`)) return;
    setOcupadoMidia(provedor);
    try { await fetch(`/api/ticketeria/lojas/${estado.lojaId}/conexoes/${PEDACO[provedor]}`, { method: "DELETE" }); } finally { setOcupadoMidia(null); setVersao(v => v + 1); }
  }

  async function importar(corpo: CorpoDaImportacao) {
    if (!estado?.lojaId) return;
    setImportando(true);
    setErroDeImportar(null);
    try {
      const r = await fetch(`/api/ticketeria/lojas/${estado.lojaId}/historico`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
      if (!r.ok) { setErroDeImportar(r.status === 413 ? "O arquivo ficou grande demais. Divida em partes menores." : r.status === 429 ? "Muitas importações seguidas. Espere um instante." : "Não foi possível importar agora. Tente de novo."); return; }
      setFolhaDeImportar(false);
      setVersao(v => v + 1);
    } catch { setErroDeImportar("Sem conexão. Tente de novo."); } finally { setImportando(false); }
  }

  async function desfazerImportacao(id: string) {
    if (!estado?.lojaId || !window.confirm("Desfazer esta importação? O que ela trouxe é apagado (o arquivo original não muda).")) return;
    setDesfazendo(id);
    try { await fetch(`/api/ticketeria/lojas/${estado.lojaId}/historico/${id}`, { method: "DELETE" }); } finally { setDesfazendo(null); setVersao(v => v + 1); }
  }

  if (estado === undefined || !organizationId) return <DetailPageSkeleton />;
  const dados = estado.dados;
  // O gasto por semana de cada canal (o mais comum nas semanas com gasto): a base da previsão e do simulador.
  const gastoSemanal: Record<string, number> = Object.fromEntries((prontidao?.canais ?? []).filter(c => c.medianaCentavos > 0).map(c => [c.canal, c.medianaCentavos]));
  const acoes = (
    <>
      {dados && aba === "acoes" && <SecondaryListAction onClick={() => abrirNova(dados.hoje)}>Registrar ação</SecondaryListAction>}
      {dados && aba === "modelo" && resultadoDoModelo && Object.keys(gastoSemanal).length > 0 && <SecondaryListAction onClick={() => setSimulando(true)}>Simular orçamento</SecondaryListAction>}
      {dados && aba === "historico" && <SecondaryListAction onClick={() => { setErroDeImportar(null); setFolhaDeImportar(true); }}>Importar planilha</SecondaryListAction>}
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
              : aba === "modelo"
              ? (prontidaoErro ? <p role="alert" className="rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>Não foi possível conferir os dados do modelo agora. Recarregue a página.</p>
                : prontidao ? (
                  <div className="space-y-4">
                    {resultadoDoModelo && <ResultadoDoModelo resultado={resultadoDoModelo} gastoSemanal={gastoSemanal} />}
                    {(!resultadoDoModelo || !prontidao.pronto) && <ModeloDaLoja prontidao={prontidao} onImportar={() => { setAba("historico"); setErroDeImportar(null); setFolhaDeImportar(true); }} onConexoes={() => setAba("conexoes")} onDatas={() => setFolhaDeDatas({ valores: { dia: "", nome: "" }, erro: null })} />}
                  </div>)
                : <p className="text-[0.8125rem] text-black/40" aria-live="polite">Conferindo os dados…</p>)
              : aba === "historico"
              ? <HistoricoDaLoja importacoes={historico.importacoes} semanas={historico.semanas} desfazendo={desfazendo} onDesfazer={id => void desfazerImportacao(id)} onImportar={() => { setErroDeImportar(null); setFolhaDeImportar(true); }} />
              : aba === "conexoes"
              ? <ConexoesDaLoja estados={conexoes} aviso={avisoMidia} ocupado={ocupadoMidia} onConectar={conectar} onEscolherConta={p => void abrirEscolha(p)} onLer={p => void ler(p)} onDesconectar={p => void desconectar(p)} />
              : <AcoesDaLoja acoes={dados.acoes} por_dia={dados.por_dia} hoje={dados.hoje} onRegistrar={() => abrirNova(dados.hoje)}
                  onAbrir={id => { const a = dados.acoes.find(x => x.id === id); if (a) { setAcaoErro(null); setAcao({ id, valores: { nome: a.nome, canal: a.canal, inicio: a.inicio, fim: a.fim, gasto: gastoParaCampo(a.gasto_centavos) } }); } }} />}
          </div>
        )}
      </ListContent>
      {criando && dados && <LinkDeDivulgacaoSheet sessoes={dados.sessoes} origem={window.location.origin} sessaoInicial={sessaoId} onClose={() => setCriando(false)} />}
      {folhaDeImportar && <ImportarPlanilhaSheet existentes={historico.importacoes} erro={erroDeImportar} importando={importando} onClose={() => setFolhaDeImportar(false)} onImportar={c => void importar(c)} />}
      {escolhendo && <EscolherContaSheet fonte={CARTOES[escolhendo.provedor].fonte} tipo={escolhendo.provedor === "ga4" ? "visitas" : "gasto"} contas={escolhendo.contas} escolhida={escolhendo.escolhida} erro={escolhendo.erro} salvando={salvando} onEscolher={id => setEscolhendo(e => (e ? { ...e, escolhida: id } : e))} onClose={() => setEscolhendo(null)} onSalvar={() => void confirmarConta()} />}
      {simulando && resultadoDoModelo && <SimularOrcamentoSheet canais={resultadoDoModelo.canais} gastoSemanal={gastoSemanal} onClose={() => setSimulando(false)} />}
      {folhaDeDatas && <DatasDePicoSheet datas={datasDePico} valores={folhaDeDatas.valores} erro={folhaDeDatas.erro} salvando={salvando} onMudar={(campo, valor) => setFolhaDeDatas(f => (f ? { ...f, valores: { ...f.valores, [campo]: valor } } : f))} onClose={() => setFolhaDeDatas(null)} onAdicionar={() => void adicionarData()} onApagar={id => void apagarData(id)} />}
      {acao && <AcaoSheet editando={acao.id !== null} valores={acao.valores} erro={acaoErro} salvando={salvando} onMudar={(campo, valor) => setAcao(a => (a ? { ...a, valores: { ...a.valores, [campo]: valor } } : a))} onClose={() => setAcao(null)} onSalvar={() => void salvar()} onApagar={() => void apagar()} />}
    </>
  );
}
