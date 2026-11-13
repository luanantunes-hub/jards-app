"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Plus, TriangleAlert } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { APAGAR, BOTAO, BOTAO_PEQUENO, CAMPO, CANCELAR, Erro, ROTULO, SALVAR } from "@/components/producao/estilosDoBordero";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { CATEGORIAS_DO_ORCAMENTO, type CategoriaDoOrcamento, type SituacaoDoOrcamento } from "@/lib/producao/estados";
import { formatarReais, lerValorEmReais } from "@/lib/producao/bordero";
import {
  calcularOrcamento, lerLinhaDoOrcamento, mensagemDoErroDeOrcamento, planilhaDoOrcamento, ROTULO_DA_CATEGORIA_DO_ORCAMENTO, ROTULO_DA_SITUACAO_DO_ORCAMENTO, textoDoOrcamento,
  type LinhaDoOrcamento,
} from "@/lib/producao/orcamento";

type Orcamento = { id: string; nome: string; situacao: SituacaoDoOrcamento; aprovado_em: string | null };

const paraCampo = (valor: number | null) => (valor === null ? "" : String(valor).replace(".", ","));
const reaisOuTraco = (centavos: number | null) => (centavos === null ? "—" : formatarReais(centavos));

function NovoOrcamentoSheet({ organizationId, temporadaId, nomeSugerido, onClose, onCriou }: { organizationId: string; temporadaId: string; nomeSugerido: string; onClose: () => void; onCriou: (id: string) => void }) {
  const [nome, setNome] = useState(nomeSugerido);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar(fechar: () => void) {
    const limpo = nome.trim();
    if (limpo === "") { setErro("Escreva o nome do orçamento."); return; }
    setSalvando(true);
    setErro(null);
    const { data, error } = await clienteDaProducao(createClient()).from("producao_orcamentos").insert({ organization_id: organizationId, temporada_id: temporadaId, nome: limpo }).select("id").single();
    setSalvando(false);
    if (error || !data) { setErro(mensagemDoErroDeOrcamento(error ?? {})); return; }
    onCriou(data.id);
    fechar();
  }

  return (
    <TopSheet
      titulo="Novo orçamento"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void criar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Criando…" : "Criar orçamento"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <div>
          <label className={ROTULO} htmlFor="orc-nome">Nome</label>
          <input id="orc-nome" className={CAMPO} value={nome} maxLength={80} onChange={event => setNome(event.target.value)} disabled={salvando} />
        </div>
        <p className="text-[0.6875rem] text-black/45">Uma temporada pode ter mais de um orçamento (por exemplo, um para cada cenário).</p>
      </div>
    </TopSheet>
  );
}

function LinhaSheet({ organizationId, orcamentoId, situacao, linha, onClose, onSalvou }: { organizationId: string; orcamentoId: string; situacao: SituacaoDoOrcamento; linha: LinhaDoOrcamento | null; onClose: () => void; onSalvou: () => void }) {
  const { confirmDelete } = useDeleteConfirm();
  const [categoria, setCategoria] = useState<CategoriaDoOrcamento>(linha?.categoria ?? "outros");
  const [descricao, setDescricao] = useState(linha?.descricao ?? "");
  const [estimativa, setEstimativa] = useState(paraCampo(linha?.estimativa ?? null));
  const [aprovado, setAprovado] = useState(paraCampo(linha?.aprovado ?? null));
  const [revisado, setRevisado] = useState(paraCampo(linha?.revisado ?? null));
  const [comprometido, setComprometido] = useState(linha && linha.comprometido !== 0 ? paraCampo(linha.comprometido) : "");
  const [pago, setPago] = useState(linha && linha.pago !== 0 ? paraCampo(linha.pago) : "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const aprovadoOrcamento = situacao === "aprovado";
  const travada = aprovadoOrcamento && linha !== null; // aprovado: estimativa, aprovado e categoria da linha existente não mudam
  const naoApaga = aprovadoOrcamento && linha?.aprovado != null;

  async function salvar(fechar: () => void) {
    const leitura = lerLinhaDoOrcamento({ categoria, descricao, estimativa, aprovado, revisado, comprometido, pago, ordem: String(linha?.ordem ?? 0) }, lerValorEmReais);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = linha
      ? await producao.from("producao_orcamento_linhas").update(travada ? { descricao: leitura.valor.descricao, revisado: leitura.valor.revisado, comprometido: leitura.valor.comprometido, pago: leitura.valor.pago } : leitura.valor).eq("id", linha.id)
      : await producao.from("producao_orcamento_linhas").insert({ organization_id: organizationId, orcamento_id: orcamentoId, ...leitura.valor, aprovado: aprovadoOrcamento ? null : leitura.valor.aprovado });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDeOrcamento(error)); return; }
    onSalvou();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!linha) return;
    confirmDelete({
      title: "Apagar linha do orçamento?",
      description: `${linha.descricao} sai do orçamento.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_orcamento_linhas").delete().eq("id", linha.id);
        if (error) throw new Error(mensagemDoErroDeOrcamento(error));
        onSalvou();
        fechar();
      },
    });
  }

  const campoValor = (id: string, rotulo: string, valor: string, mudar: (texto: string) => void, desabilitado = false, dica?: string) => (
    <div>
      <label className={ROTULO} htmlFor={id}>{rotulo}</label>
      <input id={id} inputMode="decimal" className={CAMPO} value={valor} onChange={event => mudar(event.target.value)} disabled={salvando || desabilitado} placeholder="0,00" />
      {dica && <p className="mt-1 text-[0.625rem] text-black/45">{dica}</p>}
    </div>
  );

  return (
    <TopSheet
      titulo={linha ? "Editar linha" : "Nova linha do orçamento"}
      onClose={onClose}
      footer={fechar => (
        <>
          {linha && !naoApaga && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className={APAGAR}>Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : linha ? "Salvar" : "Adicionar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <div>
            <span className={ROTULO}>Categoria</span>
            <Dropdown ariaLabel="Categoria do gasto" value={categoria} onChange={novo => setCategoria(novo as CategoriaDoOrcamento)} disabled={salvando || travada} options={CATEGORIAS_DO_ORCAMENTO.map(item => ({ value: item, label: ROTULO_DA_CATEGORIA_DO_ORCAMENTO[item] }))} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="orc-descricao">O que é</label>
            <input id="orc-descricao" className={CAMPO} value={descricao} maxLength={120} onChange={event => setDescricao(event.target.value)} disabled={salvando} placeholder="Cachê do elenco" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {campoValor("orc-estimativa", "Estimativa (R$)", estimativa, setEstimativa, travada)}
          {campoValor("orc-aprovado", "Aprovado (R$)", aprovado, setAprovado, travada || aprovadoOrcamento, aprovadoOrcamento ? "Preenchido ao aprovar o orçamento." : "Deixe em branco: ao aprovar, vale a estimativa.")}
          {campoValor("orc-revisado", "Revisado (R$)", revisado, setRevisado, false, "Vale mais que os outros dois.")}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {campoValor("orc-comprometido", "Comprometido (R$)", comprometido, setComprometido, false, "O que já foi combinado ou contratado.")}
          {campoValor("orc-pago", "Pago (R$)", pago, setPago, false, "O que já saiu do caixa.")}
        </div>
        {travada && <p className="rounded border bg-white px-3 py-2 text-[0.6875rem] text-black/55" style={{ borderColor: "rgba(13,13,13,.1)" }}>O orçamento está aprovado: a categoria, a estimativa e o aprovado desta linha não mudam. Para corrigir o valor, use o revisado.</p>}
      </div>
    </TopSheet>
  );
}

/** O orçamento vivo de uma temporada (PD5.1): linhas por categoria, estimativa, aprovado e revisado, comprometido e pago. Só aparece a quem tem a permissão de dinheiro. */
export function OrcamentoDaTemporada({ organizationId, temporadaId, temporadaTitulo, podeEditar }: { organizationId: string; temporadaId: string; temporadaTitulo: string; podeEditar: boolean }) {
  const { confirmDelete } = useDeleteConfirm();
  const [comDinheiro, setComDinheiro] = useState<boolean | null>(null);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [escolhido, setEscolhido] = useState("");
  const [linhas, setLinhas] = useState<LinhaDoOrcamento[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [confirmando, setConfirmando] = useState<"aprovar" | "encerrar" | null>(null);
  const [folhaNovo, setFolhaNovo] = useState(false);
  const [folhaLinha, setFolhaLinha] = useState<{ linha: LinhaDoOrcamento | null } | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data } = await clienteDaProducao(createClient()).rpc("auth_producao_pode", { p_org: organizationId, p_acao: "dinheiro" });
      if (ativo) setComDinheiro(data === true);
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  useEffect(() => {
    if (!comDinheiro) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const orc = await producao.from("producao_orcamentos").select("id, nome, situacao, aprovado_em").eq("temporada_id", temporadaId).order("created_at");
      const lista = (orc.data ?? []) as Orcamento[];
      const idAtual = lista.some(item => item.id === escolhido) ? escolhido : lista[0]?.id ?? "";
      const lin = idAtual
        ? await producao.from("producao_orcamento_linhas").select("id, categoria, descricao, estimativa, aprovado, revisado, comprometido, pago, ordem").eq("orcamento_id", idAtual)
        : { data: [], error: null };
      if (!ativo) return;
      setOrcamentos(lista);
      setEscolhido(idAtual);
      setLinhas((lin.data ?? []) as LinhaDoOrcamento[]);
      setCarregado(true);
      setErro(orc.error || lin.error ? "Não foi possível carregar o orçamento. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
    // `escolhido` entra de propósito só pela troca no seletor, que também passa por `versao`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comDinheiro, temporadaId, versao]);

  const orcamento = orcamentos.find(item => item.id === escolhido) ?? null;
  const contas = useMemo(() => calcularOrcamento(linhas), [linhas]);
  const editavel = podeEditar && orcamento?.situacao !== "encerrado";
  const recarregar = () => setVersao(atual => atual + 1);
  const comAprovado = orcamento !== null && orcamento.situacao !== "rascunho";

  if (!comDinheiro || !carregado) return null;

  async function mudarSituacao(situacao: SituacaoDoOrcamento) {
    if (!orcamento) return;
    setTrabalhando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_orcamentos").update({ situacao }).eq("id", orcamento.id);
    setTrabalhando(false);
    setConfirmando(null);
    if (error) { setErro(mensagemDoErroDeOrcamento(error)); return; }
    recarregar();
  }

  function apagarOrcamento() {
    if (!orcamento) return;
    confirmDelete({
      title: "Apagar orçamento?",
      description: `${orcamento.nome} e todas as linhas dele saem da temporada. Isso não pode ser desfeito.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_orcamentos").delete().eq("id", orcamento.id);
        if (error) throw new Error(mensagemDoErroDeOrcamento(error));
        setEscolhido("");
        recarregar();
      },
    });
  }

  async function copiar() {
    if (!orcamento) return;
    try { await navigator.clipboard.writeText(textoDoOrcamento({ temporada: temporadaTitulo, nome: orcamento.nome, situacao: orcamento.situacao, contas })); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { setErro("Não foi possível copiar. Selecione o texto e copie à mão."); }
  }

  function baixar() {
    if (!orcamento) return;
    const arquivo = new Blob([planilhaDoOrcamento({ temporada: temporadaTitulo, nome: orcamento.nome, situacao: orcamento.situacao, contas })], { type: "text/csv;charset=utf-8" });
    const endereco = URL.createObjectURL(arquivo);
    const ancora = document.createElement("a");
    ancora.href = endereco;
    ancora.download = "orcamento.csv";
    ancora.click();
    URL.revokeObjectURL(endereco);
  }

  const resumo = [
    { rotulo: "Custo final previsto", valor: formatarReais(contas.previstoCentavos), zero: contas.previstoCentavos === 0, forte: true },
    ...(comAprovado ? [{ rotulo: "Aprovado", valor: formatarReais(contas.aprovadoCentavos), zero: contas.aprovadoCentavos === 0, forte: false }, {
      rotulo: "Variação", valor: `${contas.variacaoCentavos > 0 ? "+" : contas.variacaoCentavos < 0 ? "−" : ""}${formatarReais(Math.abs(contas.variacaoCentavos))}`, zero: contas.variacaoCentavos === 0, forte: false,
    }] : []),
    { rotulo: "Comprometido", valor: formatarReais(contas.comprometidoCentavos), zero: contas.comprometidoCentavos === 0, forte: false },
    { rotulo: "Pago", valor: formatarReais(contas.pagoCentavos), zero: contas.pagoCentavos === 0, forte: false },
    { rotulo: "A pagar", valor: formatarReais(contas.aPagarCentavos), zero: contas.aPagarCentavos === 0, forte: false },
  ];

  return (
    <section aria-labelledby="orcamento-da-temporada" className="mt-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="orcamento-da-temporada" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Orçamento</h2>
        <div className="flex flex-wrap items-center gap-2">
          {orcamentos.length > 1 && (
            <div className="w-48">
              <Dropdown ariaLabel="Orçamento da temporada" value={escolhido} onChange={novo => { setEscolhido(novo); recarregar(); }} options={orcamentos.map(item => ({ value: item.id, label: item.nome }))} />
            </div>
          )}
          {orcamento && <button type="button" onClick={() => void copiar()} className={BOTAO}><Copy size={13} aria-hidden="true" /> {copiado ? "Copiado" : "Copiar"}</button>}
          {orcamento && linhas.length > 0 && <button type="button" onClick={baixar} className={BOTAO}><Download size={13} aria-hidden="true" /> Planilha</button>}
          {podeEditar && <button type="button" onClick={() => setFolhaNovo(true)} className={BOTAO}><Plus size={13} aria-hidden="true" /> Orçamento</button>}
        </div>
      </div>
      {erro && <div className="mb-2"><Erro texto={erro} /></div>}

      {!orcamento ? (
        <p className="rounded border bg-white px-5 py-6 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Esta temporada ainda não tem orçamento. Crie um e lance os gastos por categoria: estimativa, aprovado, revisado, comprometido e pago.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="rounded border px-2 py-1 text-[0.6875rem] font-medium text-[#282525]" style={{ borderColor: "rgba(13,13,13,.25)" }}>{ROTULO_DA_SITUACAO_DO_ORCAMENTO[orcamento.situacao]}{orcamento.situacao !== "rascunho" && orcamento.aprovado_em ? ` em ${new Date(orcamento.aprovado_em).toLocaleDateString("pt-BR")}` : ""}</span>
            {podeEditar && orcamento.situacao === "rascunho" && confirmando !== "aprovar" && <button type="button" className={BOTAO} disabled={trabalhando} onClick={() => setConfirmando("aprovar")}>Aprovar orçamento</button>}
            {podeEditar && orcamento.situacao !== "encerrado" && confirmando !== "encerrar" && <button type="button" className={BOTAO} disabled={trabalhando} onClick={() => setConfirmando("encerrar")}>Encerrar</button>}
            {podeEditar && <button type="button" className={`${BOTAO_PEQUENO} text-[#B23B3B]`} disabled={trabalhando} onClick={apagarOrcamento}>Apagar orçamento</button>}
            {confirmando && (
              <div className="flex flex-wrap items-center gap-2 rounded border bg-white px-3 py-2" style={{ borderColor: "#B07A1447" }}>
                <span className="text-[0.75rem] text-[#B07A14]">{confirmando === "aprovar" ? "Aprovar guarda a estimativa como o valor aprovado e trava a estimativa e a categoria das linhas. Depois, use o revisado. Não volta para rascunho." : "Encerrar trava tudo: nada mais muda."}</span>
                <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando} onClick={() => void mudarSituacao(confirmando === "aprovar" ? "aprovado" : "encerrado")}>{confirmando === "aprovar" ? "Aprovar" : "Encerrar"}</button>
                <button type="button" className={BOTAO_PEQUENO} onClick={() => setConfirmando(null)}>Voltar</button>
              </div>
            )}
          </div>

          <dl className={`grid gap-2 sm:grid-cols-3 ${comAprovado ? "lg:grid-cols-6" : "lg:grid-cols-4"}`}>
            {resumo.map(item => (
              <div key={item.rotulo} className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <dt className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{item.rotulo}</dt>
                <dd className={`mt-1 text-[1.0625rem] tabular-nums ${item.forte ? "font-semibold" : "font-medium"} ${item.zero ? "text-black/30" : "text-[#282525]"}`} title={item.valor}>{item.valor}</dd>
              </div>
            ))}
          </dl>
          {contas.avisos.map(aviso => <p key={aviso} className="flex items-start gap-1.5 rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}><TriangleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0" /> {aviso}</p>)}

          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.6875rem] text-black/45">O comprometido e o pago são digitados por enquanto; depois virão dos acordos e dos lançamentos.</p>
            {editavel && <button type="button" onClick={() => setFolhaLinha({ linha: null })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Linha</button>}
          </div>

          {contas.linhas.length === 0 ? (
            <p className="rounded border bg-white px-5 py-5 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Nenhuma linha. Comece pelo cachê, a hospedagem e o transporte.</p>
          ) : (
            <div className="overflow-x-auto rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <table className="w-full min-w-[56rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-black/[.06]">
                    {["Gasto", "Estimativa", "Aprovado", "Revisado", "Previsto", ...(comAprovado ? ["Variação"] : []), "Comprometido", "Pago", "A pagar"].map((titulo, indice) => (
                      <th key={titulo} scope="col" className={`px-3 py-2.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45 ${indice > 0 ? "text-right" : ""}`}>{titulo}</th>
                    ))}
                    {editavel && <th scope="col" className="px-3 py-2.5"><span className="sr-only">Ações</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {contas.linhas.map(conta => {
                    const original = linhas.find(item => item.id === conta.id) ?? null;
                    return (
                      <tr key={conta.id} className="border-b border-black/[.06] align-top last:border-b-0">
                        <th scope="row" className="px-3 py-2 text-left">
                          <span className="block text-[0.8125rem] font-medium text-[#282525]">{conta.descricao}</span>
                          <span className="block text-[0.6875rem] font-normal text-black/45">{ROTULO_DA_CATEGORIA_DO_ORCAMENTO[conta.categoria]}</span>
                          {conta.avisos.map(aviso => <span key={aviso} className="mt-0.5 block text-[0.6875rem] font-normal text-[#B07A14]">{aviso}</span>)}
                        </th>
                        {[conta.estimativaCentavos, conta.aprovadoCentavos, conta.revisadoCentavos].map((valor, indice) => <td key={indice} className={`px-3 py-2 text-right text-[0.8125rem] tabular-nums ${valor === null ? "text-black/30" : "text-black/65"}`}>{reaisOuTraco(valor)}</td>)}
                        <td className="px-3 py-2 text-right text-[0.8125rem] font-medium tabular-nums text-[#282525]">{formatarReais(conta.previstoCentavos)}</td>
                        {comAprovado && <td className={`px-3 py-2 text-right text-[0.8125rem] tabular-nums ${conta.variacaoCentavos === null || conta.variacaoCentavos === 0 ? "text-black/30" : "text-[#282525]"}`}>{conta.variacaoCentavos === null ? "—" : `${conta.variacaoCentavos > 0 ? "+" : conta.variacaoCentavos < 0 ? "−" : ""}${formatarReais(Math.abs(conta.variacaoCentavos))}`}</td>}
                        <td className={`px-3 py-2 text-right text-[0.8125rem] tabular-nums ${conta.comprometidoCentavos === 0 ? "text-black/30" : "text-[#282525]"}`}>{formatarReais(conta.comprometidoCentavos)}</td>
                        <td className={`px-3 py-2 text-right text-[0.8125rem] tabular-nums ${conta.pagoCentavos === 0 ? "text-black/30" : "text-[#282525]"}`}>{formatarReais(conta.pagoCentavos)}</td>
                        <td className={`px-3 py-2 text-right text-[0.8125rem] tabular-nums ${conta.aPagarCentavos === 0 ? "text-black/30" : "text-[#282525]"}`}>{formatarReais(conta.aPagarCentavos)}</td>
                        {editavel && <td className="px-3 py-2 text-right"><button type="button" className={BOTAO_PEQUENO} onClick={() => setFolhaLinha({ linha: original })}>Editar</button></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {folhaNovo && <NovoOrcamentoSheet organizationId={organizationId} temporadaId={temporadaId} nomeSugerido={orcamentos.length === 0 ? "Orçamento" : `Cenário ${orcamentos.length + 1}`} onClose={() => setFolhaNovo(false)} onCriou={id => { setEscolhido(id); recarregar(); }} />}
      {folhaLinha && orcamento && <LinhaSheet organizationId={organizationId} orcamentoId={orcamento.id} situacao={orcamento.situacao} linha={folhaLinha.linha} onClose={() => setFolhaLinha(null)} onSalvou={recarregar} />}
    </section>
  );
}
