"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Plus } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { APAGAR, BOTAO, BOTAO_PEQUENO, CAMPO, CANCELAR, Erro, ROTULO, SALVAR } from "@/components/producao/estilosDoBordero";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { emCentavos, formatarReais, lerValorEmReais } from "@/lib/producao/bordero";
import { ROTULO_DA_CATEGORIA_DO_ORCAMENTO } from "@/lib/producao/orcamento";
import type { CategoriaDoOrcamento } from "@/lib/producao/estados";
import {
  contaDaDivisao, dividirIgualmente, lerLancamento, mensagemDoErroDeLancamento, planilhaDosLancamentos, type DivisaoDoLancamento, type LancamentoDaTemporada,
} from "@/lib/producao/lancamentos";

/** Aviso entre os blocos da página da temporada: o orçamento escuta para recalcular o pago quando um lançamento muda. */
export const EVENTO_LANCAMENTOS_MUDARAM = "producao-lancamentos-mudaram";

type LinhaDisponivel = { id: string; rotulo: string };
type LinhaDaDivisao = { chave: number; linhaId: string; valor: string };

const paraCampo = (valor: number) => String(valor).replace(".", ",");
const dia = (data: string) => data.split("-").reverse().join("/");

function LancamentoSheet({ organizationId, temporadaId, lancamento, divisoesAtuais, linhas, onClose, onSalvou }: {
  organizationId: string; temporadaId: string; lancamento: LancamentoDaTemporada | null; divisoesAtuais: DivisaoDoLancamento[]; linhas: LinhaDisponivel[]; onClose: () => void; onSalvou: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? "");
  const [favorecido, setFavorecido] = useState(lancamento?.favorecido ?? "");
  const [documento, setDocumento] = useState(lancamento?.documento ?? "");
  const [data, setData] = useState(lancamento?.data ?? new Date().toISOString().slice(0, 10));
  const [valor, setValor] = useState(lancamento ? paraCampo(lancamento.valor) : "");
  const [observacao, setObservacao] = useState(lancamento?.observacao ?? "");
  const [partes, setPartes] = useState<LinhaDaDivisao[]>(divisoesAtuais.map((item, indice) => ({ chave: indice, linhaId: item.orcamento_linha_id, valor: paraCampo(item.valor) })));
  const [proximaChave, setProximaChave] = useState(divisoesAtuais.length);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const valorLido = lerValorEmReais(valor);
  const centavosDasPartes = partes.map(parte => { const lido = lerValorEmReais(parte.valor); return lido === null ? 0 : emCentavos(lido); });
  const conta = contaDaDivisao(valorLido === null ? 0 : emCentavos(valorLido), centavosDasPartes);
  const linhasLivres = (atual: string) => linhas.filter(linha => linha.id === atual || !partes.some(parte => parte.linhaId === linha.id));

  function adicionarParte() {
    const livre = linhasLivres("").find(linha => !partes.some(parte => parte.linhaId === linha.id));
    if (!livre) return;
    setPartes(atual => [...atual, { chave: proximaChave, linhaId: livre.id, valor: "" }]);
    setProximaChave(atual => atual + 1);
  }

  function dividirIgual() {
    if (valorLido === null || partes.length === 0) return;
    const partesIguais = dividirIgualmente(emCentavos(valorLido), partes.length);
    setPartes(atual => atual.map((parte, indice) => ({ ...parte, valor: paraCampo(partesIguais[indice] / 100) })));
  }

  async function salvar(fechar: () => void) {
    const leitura = lerLancamento({ descricao, favorecido, documento, data, valor, observacao }, lerValorEmReais);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    const novas: { orcamento_linha_id: string; valor: number }[] = [];
    for (const parte of partes) {
      const lido = parte.valor.trim() === "" ? null : lerValorEmReais(parte.valor);
      if (lido === null || lido <= 0) { setErro("Digite o valor de cada linha da divisão, maior que zero, ou tire a linha."); return; }
      novas.push({ orcamento_linha_id: parte.linhaId, valor: lido });
    }
    if (conta.passaCentavos > 0) { setErro(conta.avisos[0]); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    try {
      let lancamentoId = lancamento?.id ?? "";
      if (lancamento) {
        // Tira a divisão antes de mudar o valor (o banco não deixa o total ficar abaixo do dividido) e a refaz em seguida.
        const { error: erroTira } = await producao.from("producao_lancamento_linhas").delete().eq("lancamento_id", lancamento.id);
        if (erroTira) throw new Error(mensagemDoErroDeLancamento(erroTira));
        const { error } = await producao.from("producao_lancamentos").update(leitura.valor).eq("id", lancamento.id);
        if (error) {
          // Devolve a divisão que existia, para o pagamento não ficar sem ela.
          if (divisoesAtuais.length > 0) await producao.from("producao_lancamento_linhas").insert(divisoesAtuais.map(item => ({ organization_id: organizationId, lancamento_id: lancamento.id, orcamento_linha_id: item.orcamento_linha_id, valor: item.valor })));
          throw new Error(mensagemDoErroDeLancamento(error));
        }
      } else {
        const { data: criado, error } = await producao.from("producao_lancamentos").insert({ organization_id: organizationId, temporada_id: temporadaId, ...leitura.valor }).select("id").single();
        if (error || !criado) throw new Error(mensagemDoErroDeLancamento(error ?? {}));
        lancamentoId = criado.id;
      }
      if (novas.length > 0) {
        const { error } = await producao.from("producao_lancamento_linhas").insert(novas.map(item => ({ organization_id: organizationId, lancamento_id: lancamentoId, ...item })));
        if (error) throw new Error(mensagemDoErroDeLancamento(error));
      }
      onSalvou();
      fechar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar. Tente de novo.");
      onSalvou();
    } finally {
      setSalvando(false);
    }
  }

  function apagar(fechar: () => void) {
    if (!lancamento) return;
    confirmDelete({
      title: "Apagar lançamento?",
      description: `${lancamento.descricao} (${formatarReais(emCentavos(lancamento.valor))}) e a divisão dele saem da temporada. O pago das linhas do orçamento volta ao que foi digitado.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_lancamentos").delete().eq("id", lancamento.id);
        if (error) throw new Error(mensagemDoErroDeLancamento(error));
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={lancamento ? "Editar lançamento" : "Novo lançamento"}
      onClose={onClose}
      footer={fechar => (
        <>
          {lancamento && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className={APAGAR}>Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : lancamento ? "Salvar" : "Lançar pagamento"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <div>
          <label className={ROTULO} htmlFor="lan-descricao">O que foi pago</label>
          <input id="lan-descricao" className={CAMPO} value={descricao} maxLength={120} onChange={event => setDescricao(event.target.value)} disabled={salvando} placeholder="Cachê do elenco" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={ROTULO} htmlFor="lan-favorecido">Quem recebeu</label>
            <input id="lan-favorecido" className={CAMPO} value={favorecido} maxLength={120} onChange={event => setFavorecido(event.target.value)} disabled={salvando} placeholder="Companhia, hotel, pessoa..." />
          </div>
          <div>
            <label className={ROTULO} htmlFor="lan-documento">Nota ou recibo</label>
            <input id="lan-documento" className={CAMPO} value={documento} maxLength={60} onChange={event => setDocumento(event.target.value)} disabled={salvando} placeholder="Número" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={ROTULO} htmlFor="lan-data">Pago em</label>
            <input id="lan-data" type="date" className={CAMPO} value={data} onChange={event => setData(event.target.value)} disabled={salvando} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="lan-valor">Valor (R$)</label>
            <input id="lan-valor" inputMode="decimal" className={CAMPO} value={valor} onChange={event => setValor(event.target.value)} disabled={salvando} placeholder="1.000,00" />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[0.6875rem] font-medium text-black/55">Dividir entre as linhas do orçamento</span>
            <div className="flex gap-1.5">
              {partes.length > 1 && <button type="button" className={BOTAO_PEQUENO} disabled={salvando || valorLido === null} onClick={dividirIgual}>Dividir igualmente</button>}
              <button type="button" className={BOTAO_PEQUENO} disabled={salvando || partes.length >= linhas.length} onClick={adicionarParte}><Plus size={11} aria-hidden="true" className="mr-1 inline" />Linha</button>
            </div>
          </div>
          {linhas.length === 0 ? (
            <p className="rounded border bg-white px-3 py-2 text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.1)" }}>A temporada ainda não tem linhas de orçamento. Crie o orçamento para dividir o pagamento; por enquanto o lançamento fica só registrado.</p>
          ) : partes.length === 0 ? (
            <p className="text-[0.75rem] text-black/45">Sem divisão, o pagamento não entra no pago do orçamento. Acrescente uma linha.</p>
          ) : (
            <ul className="space-y-2">
              {partes.map(parte => (
                <li key={parte.chave} className="grid grid-cols-[1fr_8rem_auto] items-center gap-2">
                  <Dropdown ariaLabel="Linha do orçamento" value={parte.linhaId} onChange={novo => setPartes(atual => atual.map(item => (item.chave === parte.chave ? { ...item, linhaId: novo } : item)))} disabled={salvando}
                    options={linhasLivres(parte.linhaId).map(linha => ({ value: linha.id, label: linha.rotulo }))} />
                  <input aria-label="Valor desta linha" inputMode="decimal" className={CAMPO} value={parte.valor} onChange={event => setPartes(atual => atual.map(item => (item.chave === parte.chave ? { ...item, valor: event.target.value } : item)))} disabled={salvando} placeholder="0,00" />
                  <button type="button" className={BOTAO_PEQUENO} disabled={salvando} onClick={() => setPartes(atual => atual.filter(item => item.chave !== parte.chave))}>Tirar</button>
                </li>
              ))}
            </ul>
          )}
          {partes.length > 0 && (
            <p className={`mt-2 text-[0.6875rem] tabular-nums ${conta.passaCentavos > 0 ? "text-[#B23B3B]" : "text-black/55"}`}>
              Dividido: {formatarReais(conta.divididoCentavos)}{conta.faltaCentavos > 0 ? ` · falta ${formatarReais(conta.faltaCentavos)}` : ""}{conta.passaCentavos > 0 ? ` · passa ${formatarReais(conta.passaCentavos)}` : ""}{conta.completo ? " · tudo dividido" : ""}
            </p>
          )}
        </div>

        <div>
          <label className={ROTULO} htmlFor="lan-observacao">Observação</label>
          <textarea id="lan-observacao" rows={2} className={`${CAMPO} h-auto min-h-[3.5rem] py-2`} value={observacao} maxLength={300} onChange={event => setObservacao(event.target.value)} disabled={salvando} />
        </div>
        <p className="text-[0.6875rem] text-black/45">O Jards só registra o que já foi pago, fora dele. O comprovante em arquivo e a leitura automática da nota vêm depois.</p>
      </div>
    </TopSheet>
  );
}

/** Os lançamentos de uma temporada (PD5.3): pagamentos feitos, divididos entre as linhas do orçamento, que passam a ser o pago delas. Só aparece a quem tem a permissão de dinheiro. */
export function LancamentosDaTemporada({ organizationId, temporadaId, temporadaTitulo, podeEditar }: { organizationId: string; temporadaId: string; temporadaTitulo: string; podeEditar: boolean }) {
  const [comDinheiro, setComDinheiro] = useState<boolean | null>(null);
  const [lancamentos, setLancamentos] = useState<LancamentoDaTemporada[]>([]);
  const [divisoes, setDivisoes] = useState<DivisaoDoLancamento[]>([]);
  const [linhas, setLinhas] = useState<LinhaDisponivel[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [folha, setFolha] = useState<{ lancamento: LancamentoDaTemporada | null } | null>(null);

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
      const [lan, orc] = await Promise.all([
        producao.from("producao_lancamentos").select("id, descricao, favorecido, documento, data, valor, observacao").eq("temporada_id", temporadaId).order("data", { ascending: false }),
        producao.from("producao_orcamentos").select("id, nome").eq("temporada_id", temporadaId).order("created_at"),
      ]);
      const lista = (lan.data ?? []) as LancamentoDaTemporada[];
      const orcamentos = (orc.data ?? []) as { id: string; nome: string }[];
      const [div, lin] = await Promise.all([
        lista.length > 0 ? producao.from("producao_lancamento_linhas").select("id, lancamento_id, orcamento_linha_id, valor").in("lancamento_id", lista.map(item => item.id)) : { data: [], error: null },
        orcamentos.length > 0 ? producao.from("producao_orcamento_linhas").select("id, orcamento_id, categoria, descricao").in("orcamento_id", orcamentos.map(item => item.id)).order("descricao") : { data: [], error: null },
      ]);
      if (!ativo) return;
      const nomeDoOrcamento = new Map(orcamentos.map(item => [item.id, item.nome]));
      setLancamentos(lista);
      setDivisoes((div.data ?? []) as DivisaoDoLancamento[]);
      setLinhas(((lin.data ?? []) as { id: string; orcamento_id: string; categoria: CategoriaDoOrcamento; descricao: string }[]).map(item => ({
        id: item.id, rotulo: `${orcamentos.length > 1 ? `${nomeDoOrcamento.get(item.orcamento_id) ?? ""} · ` : ""}${ROTULO_DA_CATEGORIA_DO_ORCAMENTO[item.categoria]} · ${item.descricao}`,
      })));
      setCarregado(true);
      setErro(lan.error || orc.error || div.error || lin.error ? "Não foi possível carregar os lançamentos. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [comDinheiro, temporadaId, versao]);

  const rotuloDaLinha = useMemo(() => new Map(linhas.map(item => [item.id, item.rotulo])), [linhas]);

  if (!comDinheiro || !carregado) return null;

  const mudou = () => { setVersao(atual => atual + 1); window.dispatchEvent(new Event(EVENTO_LANCAMENTOS_MUDARAM)); };
  const totalCentavos = lancamentos.reduce((soma, item) => soma + emCentavos(item.valor), 0);

  function baixar() {
    const arquivo = new Blob([planilhaDosLancamentos({ temporada: temporadaTitulo, lancamentos, divisoes, rotuloDaLinha: id => rotuloDaLinha.get(id) ?? "Linha apagada" })], { type: "text/csv;charset=utf-8" });
    const endereco = URL.createObjectURL(arquivo);
    const ancora = document.createElement("a");
    ancora.href = endereco;
    ancora.download = "lancamentos.csv";
    ancora.click();
    URL.revokeObjectURL(endereco);
  }

  return (
    <section aria-labelledby="lancamentos-da-temporada" className="mt-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="lancamentos-da-temporada" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Lançamentos</h2>
        <div className="flex flex-wrap items-center gap-2">
          {lancamentos.length > 0 && <button type="button" onClick={baixar} className={BOTAO}><Download size={13} aria-hidden="true" /> Planilha</button>}
          {podeEditar && <button type="button" onClick={() => setFolha({ lancamento: null })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Lançamento</button>}
        </div>
      </div>
      {erro && <div className="mb-2"><Erro texto={erro} /></div>}
      {lancamentos.length === 0 ? (
        <p className="rounded border bg-white px-5 py-6 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Nenhum pagamento lançado. Registre o que já foi pago e divida entre as linhas do orçamento: o pago do orçamento passa a vir daqui.</p>
      ) : (
        <>
          <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {lancamentos.map(item => {
              const partes = divisoes.filter(divisao => divisao.lancamento_id === item.id);
              const conta = contaDaDivisao(emCentavos(item.valor), partes.map(divisao => emCentavos(divisao.valor)));
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{item.descricao}</p>
                    <p className="truncate text-[0.6875rem] text-black/45">{dia(item.data)}{item.favorecido ? ` · ${item.favorecido}` : ""}{item.documento ? ` · ${item.documento}` : ""}</p>
                    <p className={`text-[0.6875rem] ${partes.length === 0 || !conta.completo ? "text-[#B07A14]" : "text-black/45"}`}>
                      {partes.length === 0 ? "Sem divisão: não entra no pago do orçamento" : conta.completo ? `Dividido em ${partes.length} ${partes.length === 1 ? "linha" : "linhas"}` : `Faltam ${formatarReais(conta.faltaCentavos)} para dividir`}
                    </p>
                  </div>
                  <span className="text-[0.8125rem] tabular-nums text-[#282525]">{formatarReais(emCentavos(item.valor))}</span>
                  {podeEditar && <button type="button" className={BOTAO_PEQUENO} onClick={() => setFolha({ lancamento: item })}>Editar</button>}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[0.6875rem] tabular-nums text-black/45">Total lançado: {formatarReais(totalCentavos)}</p>
        </>
      )}
      {folha && <LancamentoSheet organizationId={organizationId} temporadaId={temporadaId} lancamento={folha.lancamento} divisoesAtuais={folha.lancamento ? divisoes.filter(item => item.lancamento_id === folha.lancamento?.id) : []} linhas={linhas} onClose={() => setFolha(null)} onSalvou={mudou} />}
    </section>
  );
}
