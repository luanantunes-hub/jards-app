"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { APAGAR, BOTAO, BOTAO_PEQUENO, CAMPO, CANCELAR, Erro, ROTULO, SALVAR } from "@/components/producao/estilosDoBordero";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { emCentavos, formatarReais, lerValorEmReais } from "@/lib/producao/bordero";
import {
  calcularFatura, faturaEmitida, gerarParcelas, lerFatura, lerParcela, liquidoDaFaturaEmCentavos, mensagemDoErroDeFatura, planilhaDasFaturas,
  ROTULO_DA_SITUACAO_DA_FATURA, totaisDasFaturas, type FaturaDaTemporada, type ParcelaDaFatura,
} from "@/lib/producao/faturas";

/** Avisa o orçamento da temporada que uma fatura ou uma parcela mudou (o "a receber" do resumo se atualiza). */
export const EVENTO_FATURAS_MUDARAM = "producao-faturas-mudaram";

export type AcordoAReceber = { id: string; contraparte: string };
type LinhaDeParcela = { chave: number; rotulo: string; valor: string; vencimento: string };

const paraCampo = (valor: number) => String(valor).replace(".", ",");
const dia = (data: string) => data.split("-").reverse().join("/");
const hojeISO = () => new Date().toISOString().slice(0, 10);

export function FaturaSheet({ organizationId, temporadaId, fatura, parcelasAtuais, acordos, onClose, onSalvou }: {
  organizationId: string; temporadaId: string; fatura: FaturaDaTemporada | null; parcelasAtuais: ParcelaDaFatura[]; acordos: AcordoAReceber[]; onClose: () => void; onSalvou: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const emitida = fatura !== null && faturaEmitida(fatura.situacao);
  const [contratante, setContratante] = useState(fatura?.contratante ?? "");
  const [descricao, setDescricao] = useState(fatura?.descricao ?? "");
  const [acordoId, setAcordoId] = useState(fatura?.acordo_id ?? "");
  const [valor, setValor] = useState(fatura ? paraCampo(fatura.valor) : "");
  const [retencoes, setRetencoes] = useState(fatura && fatura.retencoes !== 0 ? paraCampo(fatura.retencoes) : "");
  const [notaNumero, setNotaNumero] = useState(fatura?.nota_numero ?? "");
  const [emissao, setEmissao] = useState(fatura?.emissao ?? "");
  const [vencimento, setVencimento] = useState(fatura?.vencimento ?? "");
  const [observacao, setObservacao] = useState(fatura?.observacao ?? "");
  const [linhas, setLinhas] = useState<LinhaDeParcela[]>(parcelasAtuais.map((item, indice) => ({ chave: indice, rotulo: item.rotulo ?? "", valor: paraCampo(item.valor), vencimento: item.vencimento })));
  const [proximaChave, setProximaChave] = useState(parcelasAtuais.length);
  const [quantidade, setQuantidade] = useState("3");
  const [primeiroVencimento, setPrimeiroVencimento] = useState(vencimento);
  const [sinal, setSinal] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const valorLido = lerValorEmReais(valor);
  const retencoesLidas = retencoes.trim() === "" ? 0 : lerValorEmReais(retencoes);
  const liquido = valorLido !== null && retencoesLidas !== null ? emCentavos(valorLido) - emCentavos(retencoesLidas) : 0;
  const somaDasLinhas = linhas.reduce((soma, linha) => { const lido = lerValorEmReais(linha.valor); return soma + (lido === null ? 0 : emCentavos(lido)); }, 0);

  function gerar() {
    const n = Number(quantidade);
    if (!Number.isInteger(n) || n < 1 || n > 36) { setErro("Escolha de 1 a 36 parcelas."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(primeiroVencimento)) { setErro("Escolha o vencimento da primeira parcela."); return; }
    if (liquido <= 0) { setErro("Preencha o valor da fatura (e as retenções) antes de gerar as parcelas."); return; }
    const percentualDoSinal = sinal.trim() === "" ? null : lerValorEmReais(sinal);
    if (sinal.trim() !== "" && (percentualDoSinal === null || percentualDoSinal <= 0 || percentualDoSinal >= 100)) { setErro("O sinal é uma porcentagem entre 0 e 100."); return; }
    setErro(null);
    const geradas = gerarParcelas(liquido, n, primeiroVencimento, percentualDoSinal);
    setLinhas(geradas.map((item, indice) => ({ chave: proximaChave + indice, rotulo: item.rotulo ?? "", valor: paraCampo(item.valorCentavos / 100), vencimento: item.vencimento })));
    setProximaChave(atual => atual + geradas.length);
  }

  async function salvar(fechar: () => void) {
    const leitura = lerFatura({ contratante, descricao, valor, retencoes, notaNumero, emissao, vencimento, observacao }, lerValorEmReais);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    try {
      if (emitida && fatura) {
        const { error } = await producao.from("producao_faturas").update({ nota_numero: leitura.valor.nota_numero, emissao: leitura.valor.emissao, vencimento: leitura.valor.vencimento, observacao: leitura.valor.observacao }).eq("id", fatura.id);
        if (error) throw new Error(mensagemDoErroDeFatura(error));
      } else {
        const novas: { rotulo: string | null; valor: number; vencimento: string }[] = [];
        for (const linha of linhas) {
          const lida = lerParcela({ rotulo: linha.rotulo, valor: linha.valor, vencimento: linha.vencimento }, lerValorEmReais);
          if (!lida.ok) throw new Error(lida.erro);
          novas.push(lida.valor);
        }
        if (novas.reduce((soma, item) => soma + emCentavos(item.valor), 0) > emCentavos(leitura.valor.valor) - emCentavos(leitura.valor.retencoes)) throw new Error("As parcelas passam do valor líquido da fatura (valor menos retenções).");
        const dados = { ...leitura.valor, acordo_id: acordoId || null };
        let faturaId = fatura?.id ?? "";
        if (fatura) {
          // Tira as parcelas antes de mudar o valor (o banco não deixa o líquido ficar abaixo do parcelado) e as refaz em seguida.
          const { error: erroTira } = await producao.from("producao_fatura_parcelas").delete().eq("fatura_id", fatura.id);
          if (erroTira) throw new Error(mensagemDoErroDeFatura(erroTira));
          const { error } = await producao.from("producao_faturas").update(dados).eq("id", fatura.id);
          if (error) {
            if (parcelasAtuais.length > 0) await producao.from("producao_fatura_parcelas").insert(parcelasAtuais.map(item => ({ organization_id: organizationId, fatura_id: fatura.id, rotulo: item.rotulo, valor: item.valor, vencimento: item.vencimento })));
            throw new Error(mensagemDoErroDeFatura(error));
          }
        } else {
          const { data, error } = await producao.from("producao_faturas").insert({ organization_id: organizationId, temporada_id: temporadaId, ...dados }).select("id").single();
          if (error || !data) throw new Error(mensagemDoErroDeFatura(error ?? {}));
          faturaId = data.id;
        }
        if (novas.length > 0) {
          const { error } = await producao.from("producao_fatura_parcelas").insert(novas.map(item => ({ organization_id: organizationId, fatura_id: faturaId, ...item })));
          if (error) throw new Error(mensagemDoErroDeFatura(error));
        }
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
    if (!fatura) return;
    confirmDelete({
      title: "Apagar fatura?",
      description: `A fatura de ${fatura.contratante} (${fatura.descricao}) e as parcelas dela saem da temporada. Isso não pode ser desfeito.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_faturas").delete().eq("id", fatura.id);
        if (error) throw new Error(mensagemDoErroDeFatura(error));
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={fatura ? `Fatura: ${fatura.contratante}` : "Nova fatura"}
      onClose={onClose}
      footer={fechar => (
        <>
          {fatura && !emitida && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className={APAGAR}>Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          {fatura?.situacao !== "quitada" && <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : fatura ? "Salvar" : "Criar fatura"}</button>}
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        {emitida && <p className="rounded border bg-white px-3 py-2 text-[0.6875rem] text-black/55" style={{ borderColor: "rgba(13,13,13,.1)" }}>A fatura está {fatura.situacao === "quitada" ? "quitada: nada muda" : "em aberto: o valor, as retenções, o contratante, o acordo e as parcelas não mudam. Só a nota, a emissão, o vencimento geral e a observação. O vencimento e o recebimento de cada parcela ficam na lista"}.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={ROTULO} htmlFor="fat-contratante">Quem vai pagar</label>
            <input id="fat-contratante" className={CAMPO} value={contratante} maxLength={120} onChange={event => setContratante(event.target.value)} disabled={salvando || emitida} placeholder="Sesc, prefeitura, casa..." />
          </div>
          <div>
            <label className={ROTULO} htmlFor="fat-descricao">O que está sendo cobrado</label>
            <input id="fat-descricao" className={CAMPO} value={descricao} maxLength={120} onChange={event => setDescricao(event.target.value)} disabled={salvando || emitida} placeholder="Cachê da temporada" />
          </div>
        </div>
        {acordos.length > 0 && (
          <div>
            <span className={ROTULO}>Acordo (opcional)</span>
            <Dropdown ariaLabel="Acordo desta fatura" value={acordoId} onChange={setAcordoId} disabled={salvando || emitida} options={[{ value: "", label: "Nenhum" }, ...acordos.map(item => ({ value: item.id, label: item.contraparte }))]} />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={ROTULO} htmlFor="fat-valor">Valor da fatura (R$)</label>
            <input id="fat-valor" inputMode="decimal" className={CAMPO} value={valor} onChange={event => setValor(event.target.value)} disabled={salvando || emitida} placeholder="10.000,00" />
          </div>
          <div>
            <label className={ROTULO} htmlFor="fat-retencoes">Retenções (R$)</label>
            <input id="fat-retencoes" inputMode="decimal" className={CAMPO} value={retencoes} onChange={event => setRetencoes(event.target.value)} disabled={salvando || emitida} placeholder="0,00" />
          </div>
          <div>
            <span className={ROTULO}>Líquido a receber</span>
            <p className="flex h-10 items-center text-[0.8125rem] font-medium tabular-nums text-[#282525]">{formatarReais(Math.max(0, liquido))}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={ROTULO} htmlFor="fat-nota">Nota emitida</label>
            <input id="fat-nota" className={CAMPO} value={notaNumero} maxLength={60} onChange={event => setNotaNumero(event.target.value)} disabled={salvando} placeholder="Número" />
          </div>
          <div>
            <label className={ROTULO} htmlFor="fat-emissao">Emissão</label>
            <input id="fat-emissao" type="date" className={CAMPO} value={emissao} onChange={event => setEmissao(event.target.value)} disabled={salvando} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="fat-vencimento">Vencimento geral</label>
            <input id="fat-vencimento" type="date" className={CAMPO} value={vencimento} onChange={event => { setVencimento(event.target.value); if (primeiroVencimento === "") setPrimeiroVencimento(event.target.value); }} disabled={salvando} />
          </div>
        </div>

        {!emitida && (
          <div>
            <p className="mb-1.5 text-[0.6875rem] font-medium text-black/55">Parcelas (sinal e saldo)</p>
            <div className="mb-2 grid items-end gap-2 sm:grid-cols-[5rem_1fr_6rem_auto]">
              <div><label className={ROTULO} htmlFor="fat-qtd">Quantas</label><input id="fat-qtd" inputMode="numeric" className={CAMPO} value={quantidade} onChange={event => setQuantidade(event.target.value.replace(/\D/g, ""))} disabled={salvando} /></div>
              <div><label className={ROTULO} htmlFor="fat-primeira">Primeiro vencimento</label><input id="fat-primeira" type="date" className={CAMPO} value={primeiroVencimento} onChange={event => setPrimeiroVencimento(event.target.value)} disabled={salvando} /></div>
              <div><label className={ROTULO} htmlFor="fat-sinal">Sinal (%)</label><input id="fat-sinal" inputMode="decimal" className={CAMPO} value={sinal} onChange={event => setSinal(event.target.value)} disabled={salvando} placeholder="30" /></div>
              <button type="button" className={`${BOTAO} h-10`} disabled={salvando} onClick={gerar}>Gerar parcelas</button>
            </div>
            {linhas.length === 0 ? (
              <p className="text-[0.75rem] text-black/45">Sem parcelas. Gere as parcelas ou acrescente uma a uma; a fatura só abre com elas somando o valor líquido.</p>
            ) : (
              <ul className="space-y-2">
                {linhas.map(linha => (
                  <li key={linha.chave} className="grid grid-cols-[1fr_7rem_9rem_auto] items-center gap-2">
                    <input aria-label="Nome da parcela" className={CAMPO} value={linha.rotulo} maxLength={40} onChange={event => setLinhas(atual => atual.map(item => (item.chave === linha.chave ? { ...item, rotulo: event.target.value } : item)))} disabled={salvando} placeholder="Parcela" />
                    <input aria-label="Valor da parcela" inputMode="decimal" className={CAMPO} value={linha.valor} onChange={event => setLinhas(atual => atual.map(item => (item.chave === linha.chave ? { ...item, valor: event.target.value } : item)))} disabled={salvando} placeholder="0,00" />
                    <input aria-label="Vencimento da parcela" type="date" className={CAMPO} value={linha.vencimento} onChange={event => setLinhas(atual => atual.map(item => (item.chave === linha.chave ? { ...item, vencimento: event.target.value } : item)))} disabled={salvando} />
                    <button type="button" className={BOTAO_PEQUENO} disabled={salvando} onClick={() => setLinhas(atual => atual.filter(item => item.chave !== linha.chave))}>Tirar</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <button type="button" className={BOTAO_PEQUENO} disabled={salvando} onClick={() => { setLinhas(atual => [...atual, { chave: proximaChave, rotulo: "", valor: "", vencimento: "" }]); setProximaChave(atual => atual + 1); }}><Plus size={11} aria-hidden="true" className="mr-1 inline" />Parcela</button>
              {linhas.length > 0 && <p className={`text-[0.6875rem] tabular-nums ${somaDasLinhas > liquido ? "text-[#B23B3B]" : "text-black/55"}`}>Parcelado: {formatarReais(somaDasLinhas)} de {formatarReais(Math.max(0, liquido))}{somaDasLinhas === liquido && liquido > 0 ? " · fecha" : ""}</p>}
            </div>
          </div>
        )}

        <div>
          <label className={ROTULO} htmlFor="fat-observacao">Observação</label>
          <textarea id="fat-observacao" rows={2} className={`${CAMPO} h-auto min-h-[3.5rem] py-2`} value={observacao} maxLength={300} onChange={event => setObservacao(event.target.value)} disabled={salvando || fatura?.situacao === "quitada"} />
        </div>
      </div>
    </TopSheet>
  );
}

/** As faturas ao contratante de uma temporada (PD5.5): o que se tem a receber, as retenções, as parcelas e o atraso. Só aparece a quem tem a permissão de dinheiro. */
export function FaturasDaTemporada({ organizationId, temporadaId, temporadaTitulo, podeEditar }: { organizationId: string; temporadaId: string; temporadaTitulo: string; podeEditar: boolean }) {
  const [comDinheiro, setComDinheiro] = useState<boolean | null>(null);
  const [faturas, setFaturas] = useState<FaturaDaTemporada[]>([]);
  const [parcelas, setParcelas] = useState<ParcelaDaFatura[]>([]);
  const [acordos, setAcordos] = useState<AcordoAReceber[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [folha, setFolha] = useState<{ fatura: FaturaDaTemporada | null } | null>(null);
  const [hoje] = useState(hojeISO);

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
      const [fat, aco] = await Promise.all([
        producao.from("producao_faturas").select("id, acordo_id, contratante, descricao, situacao, valor, retencoes, nota_numero, emissao, vencimento, observacao").eq("temporada_id", temporadaId).order("created_at"),
        producao.from("producao_acordos").select("id, contraparte").eq("temporada_id", temporadaId).eq("sentido", "a_receber").order("created_at"),
      ]);
      const lista = (fat.data ?? []) as FaturaDaTemporada[];
      const par = lista.length > 0 ? await producao.from("producao_fatura_parcelas").select("id, fatura_id, rotulo, valor, vencimento, recebido_em").in("fatura_id", lista.map(item => item.id)).order("vencimento") : { data: [], error: null };
      if (!ativo) return;
      setFaturas(lista);
      setParcelas((par.data ?? []) as ParcelaDaFatura[]);
      setAcordos((aco.data ?? []) as AcordoAReceber[]);
      setCarregado(true);
      setErro(fat.error || aco.error || par.error ? "Não foi possível carregar as faturas. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [comDinheiro, temporadaId, versao]);

  const agrupadas = useMemo(() => faturas.map(fatura => ({ fatura, parcelas: parcelas.filter(item => item.fatura_id === fatura.id) })), [faturas, parcelas]);
  const totais = useMemo(() => totaisDasFaturas(agrupadas, hoje), [agrupadas, hoje]);

  if (!comDinheiro || !carregado) return null;

  const mudou = () => { setVersao(atual => atual + 1); window.dispatchEvent(new Event(EVENTO_FATURAS_MUDARAM)); };

  function baixar() {
    const arquivo = new Blob([planilhaDasFaturas({ temporada: temporadaTitulo, hoje, faturas: agrupadas })], { type: "text/csv;charset=utf-8" });
    const endereco = URL.createObjectURL(arquivo);
    const ancora = document.createElement("a");
    ancora.href = endereco;
    ancora.download = "faturas.csv";
    ancora.click();
    URL.revokeObjectURL(endereco);
  }

  const resumo = [
    { rotulo: "A receber", valor: totais.aReceberCentavos, forte: true },
    { rotulo: "Já recebido", valor: totais.recebidoCentavos, forte: false },
    { rotulo: "Atrasado", valor: totais.atrasadoCentavos, forte: false },
    { rotulo: "Retido", valor: totais.retidoCentavos, forte: false },
  ];

  return (
    <section aria-labelledby="faturas-da-temporada" className="mt-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="faturas-da-temporada" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Faturas</h2>
        <div className="flex flex-wrap items-center gap-2">
          {faturas.length > 0 && <button type="button" onClick={baixar} className={BOTAO}><Download size={13} aria-hidden="true" /> Planilha</button>}
          {podeEditar && <button type="button" onClick={() => setFolha({ fatura: null })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Fatura</button>}
        </div>
      </div>
      {erro && <div className="mb-2"><Erro texto={erro} /></div>}
      {faturas.length === 0 ? (
        <p className="rounded border bg-white px-5 py-6 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Nenhuma fatura nesta temporada. Registre o que a companhia cobra de cada contratante, com as retenções e as parcelas, e acompanhe o que falta receber.</p>
      ) : (
        <div className="space-y-3">
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-x-4 gap-y-3 rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {resumo.map(item => (
              <div key={item.rotulo} className="min-w-0">
                <dt className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{item.rotulo}</dt>
                <dd className={`mt-1 whitespace-nowrap text-[1.0625rem] tabular-nums ${item.forte ? "font-semibold" : "font-medium"} ${item.valor === 0 ? "text-black/30" : item.rotulo === "Atrasado" ? "text-[#B23B3B]" : "text-[#282525]"}`} title={formatarReais(item.valor)}>{formatarReais(item.valor)}</dd>
              </div>
            ))}
          </dl>
          <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {agrupadas.map(({ fatura, parcelas: dela }) => {
              const conta = calcularFatura(fatura, dela, hoje);
              const proxima = dela.find(parcela => parcela.recebido_em === null);
              const atrasada = proxima !== undefined && conta.parcelasAtrasadas.includes(proxima.id);
              return (
                <li key={fatura.id}>
                  <Link href={`/producoes/faturas/${fatura.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 transition hover:bg-black/[.03] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5]">
                    <div className="min-w-0 flex-1 basis-64">
                      <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{fatura.contratante} · {fatura.descricao}</p>
                      <p className="truncate text-[0.6875rem] tabular-nums text-black/45">
                        {formatarReais(emCentavos(fatura.valor))}{fatura.retencoes > 0 ? ` − ${formatarReais(emCentavos(fatura.retencoes))} retidos = ${formatarReais(liquidoDaFaturaEmCentavos(fatura))}` : ""}{fatura.nota_numero ? ` · nota ${fatura.nota_numero}` : ""}
                      </p>
                      {faturaEmitida(fatura.situacao) && dela.length > 0 && (
                        <p className={`mt-0.5 truncate text-[0.6875rem] tabular-nums ${atrasada ? "text-[#B23B3B]" : "text-black/55"}`}>
                          {proxima ? `${atrasada ? "Atrasada: " : "Próxima: "}${proxima.rotulo ?? "parcela"} de ${formatarReais(emCentavos(proxima.valor))} em ${dia(proxima.vencimento)}${conta.parcelasAtrasadas.length > 1 ? ` · ${conta.parcelasAtrasadas.length} parcelas atrasadas` : ""}` : "Todas as parcelas recebidas"}
                        </p>
                      )}
                      {!faturaEmitida(fatura.situacao) && conta.avisos.map(aviso => <p key={aviso} className="mt-0.5 truncate text-[0.6875rem] text-[#B07A14]">{aviso}</p>)}
                    </div>
                    <span className="rounded border px-2 py-1 text-[0.6875rem] font-medium text-[#282525]" style={{ borderColor: "rgba(13,13,13,.25)" }}>{ROTULO_DA_SITUACAO_DA_FATURA[fatura.situacao]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {folha && <FaturaSheet organizationId={organizationId} temporadaId={temporadaId} fatura={folha.fatura} parcelasAtuais={folha.fatura ? parcelas.filter(item => item.fatura_id === folha.fatura?.id) : []} acordos={acordos} onClose={() => setFolha(null)} onSalvou={mudou} />}
    </section>
  );
}
