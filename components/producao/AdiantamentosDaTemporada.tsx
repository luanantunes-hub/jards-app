"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus, TriangleAlert } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { APAGAR, BOTAO, CAMPO, CANCELAR, Erro, ROTULO, SALVAR } from "@/components/producao/estilosDoBordero";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { emCentavos, formatarReais, lerValorEmReais } from "@/lib/producao/bordero";
import {
  contaDoAdiantamento, lerAdiantamento, lerGasto, mensagemDoErroDeAdiantamento, planilhaDosAdiantamentos, ROTULO_DA_SITUACAO_DO_ADIANTAMENTO, totalEmAberto,
  type AdiantamentoDaTemporada, type GastoDoAdiantamento,
} from "@/lib/producao/adiantamentos";

export type PessoaDoAdiantamento = { id: string; nome: string };
type Pessoa = PessoaDoAdiantamento;

const paraCampo = (valor: number) => String(valor).replace(".", ",");
const dia = (data: string) => data.split("-").reverse().join("/");
const hojeISO = () => new Date().toISOString().slice(0, 10);

export function AdiantamentoSheet({ organizationId, temporadaId, adiantamento, pessoas, saldoMinimo, onClose, onSalvou }: {
  organizationId: string; temporadaId: string; adiantamento: AdiantamentoDaTemporada | null; pessoas: Pessoa[]; saldoMinimo: number; onClose: () => void; onSalvou: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [pessoaId, setPessoaId] = useState(adiantamento?.pessoa_id ?? "");
  const [descricao, setDescricao] = useState(adiantamento?.descricao ?? "");
  const [valor, setValor] = useState(adiantamento ? paraCampo(adiantamento.valor) : "");
  const [data, setData] = useState(adiantamento?.data ?? hojeISO());
  const [devolvido, setDevolvido] = useState(adiantamento && adiantamento.devolvido !== 0 ? paraCampo(adiantamento.devolvido) : "");
  const [observacao, setObservacao] = useState(adiantamento?.observacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerAdiantamento({ pessoaId, descricao, valor, data, devolvido, observacao }, lerValorEmReais);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    if (emCentavos(leitura.valor.valor) < saldoMinimo) { setErro("O valor não pode ficar abaixo do que já foi prestado."); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = adiantamento
      ? await producao.from("producao_adiantamentos").update({ descricao: leitura.valor.descricao, valor: leitura.valor.valor, data: leitura.valor.data, devolvido: leitura.valor.devolvido, observacao: leitura.valor.observacao }).eq("id", adiantamento.id)
      : await producao.from("producao_adiantamentos").insert({ organization_id: organizationId, temporada_id: temporadaId, ...leitura.valor });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDeAdiantamento(error)); return; }
    onSalvou();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!adiantamento) return;
    confirmDelete({
      title: "Apagar adiantamento?",
      description: `O adiantamento "${adiantamento.descricao}" e a prestação de contas dele saem da temporada. Isso não pode ser desfeito.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_adiantamentos").delete().eq("id", adiantamento.id);
        if (error) throw new Error(mensagemDoErroDeAdiantamento(error));
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={adiantamento ? "Editar adiantamento" : "Novo adiantamento"}
      onClose={onClose}
      footer={fechar => (
        <>
          {adiantamento && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className={APAGAR}>Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : adiantamento ? "Salvar" : "Registrar adiantamento"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <div>
          <span className={ROTULO}>Quem recebeu</span>
          <Dropdown ariaLabel="Pessoa que recebeu o adiantamento" value={pessoaId} onChange={setPessoaId} disabled={salvando || adiantamento !== null} options={[{ value: "", label: "Escolha a pessoa" }, ...pessoas.map(item => ({ value: item.id, label: item.nome }))]} />
          {pessoas.length === 0 && <p className="mt-1 text-[0.6875rem] text-black/45">Cadastre a pessoa na equipe da temporada antes.</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <div>
            <label className={ROTULO} htmlFor="adi-descricao">Para quê</label>
            <input id="adi-descricao" className={CAMPO} value={descricao} maxLength={120} onChange={event => setDescricao(event.target.value)} disabled={salvando} placeholder="Verba da estrada" />
          </div>
          <div>
            <label className={ROTULO} htmlFor="adi-valor">Valor (R$)</label>
            <input id="adi-valor" inputMode="decimal" className={CAMPO} value={valor} onChange={event => setValor(event.target.value)} disabled={salvando} placeholder="1.000,00" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={ROTULO} htmlFor="adi-data">Entregue em</label>
            <input id="adi-data" type="date" className={CAMPO} value={data} onChange={event => setData(event.target.value)} disabled={salvando} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="adi-devolvido">Devolvido (R$)</label>
            <input id="adi-devolvido" inputMode="decimal" className={CAMPO} value={devolvido} onChange={event => setDevolvido(event.target.value)} disabled={salvando} placeholder="0,00" />
          </div>
        </div>
        <div>
          <label className={ROTULO} htmlFor="adi-observacao">Observação</label>
          <textarea id="adi-observacao" rows={2} className={`${CAMPO} h-auto min-h-[3.5rem] py-2`} value={observacao} maxLength={300} onChange={event => setObservacao(event.target.value)} disabled={salvando} />
        </div>
      </div>
    </TopSheet>
  );
}

export function GastoSheet({ organizationId, adiantamento, gasto, onClose, onSalvou }: { organizationId: string; adiantamento: AdiantamentoDaTemporada; gasto: GastoDoAdiantamento | null; onClose: () => void; onSalvou: () => void }) {
  const { confirmDelete } = useDeleteConfirm();
  const [descricao, setDescricao] = useState(gasto?.descricao ?? "");
  const [valor, setValor] = useState(gasto ? paraCampo(gasto.valor) : "");
  const [data, setData] = useState(gasto?.data ?? hojeISO());
  const [documento, setDocumento] = useState(gasto?.documento ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerGasto({ descricao, valor, data, documento }, lerValorEmReais);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = gasto
      ? await producao.from("producao_adiantamento_gastos").update(leitura.valor).eq("id", gasto.id)
      : await producao.from("producao_adiantamento_gastos").insert({ organization_id: organizationId, adiantamento_id: adiantamento.id, ...leitura.valor });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDeAdiantamento(error)); return; }
    onSalvou();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!gasto) return;
    confirmDelete({
      title: "Apagar gasto da prestação?",
      description: `${gasto.descricao} (${formatarReais(emCentavos(gasto.valor))}) sai da prestação de contas.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_adiantamento_gastos").delete().eq("id", gasto.id);
        if (error) throw new Error(mensagemDoErroDeAdiantamento(error));
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={gasto ? "Editar gasto" : "Prestar um gasto"}
      onClose={onClose}
      footer={fechar => (
        <>
          {gasto && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className={APAGAR}>Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : gasto ? "Salvar" : "Adicionar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <div>
          <label className={ROTULO} htmlFor="gas-descricao">O que foi gasto</label>
          <input id="gas-descricao" className={CAMPO} value={descricao} maxLength={120} onChange={event => setDescricao(event.target.value)} disabled={salvando} placeholder="Combustível, refeição, pedágio..." />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={ROTULO} htmlFor="gas-valor">Valor (R$)</label>
            <input id="gas-valor" inputMode="decimal" className={CAMPO} value={valor} onChange={event => setValor(event.target.value)} disabled={salvando} placeholder="300,00" />
          </div>
          <div>
            <label className={ROTULO} htmlFor="gas-data">Dia</label>
            <input id="gas-data" type="date" className={CAMPO} value={data} onChange={event => setData(event.target.value)} disabled={salvando} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="gas-documento">Comprovante</label>
            <input id="gas-documento" className={CAMPO} value={documento} maxLength={60} onChange={event => setDocumento(event.target.value)} disabled={salvando} placeholder="Número da nota" />
          </div>
        </div>
      </div>
    </TopSheet>
  );
}

/** Os adiantamentos de uma temporada (PD5.6): o dinheiro entregue a uma pessoa, a prestação de contas gasto a gasto e o saldo. Só aparece a quem tem a permissão de dinheiro. */
export function AdiantamentosDaTemporada({ organizationId, temporadaId, temporadaTitulo, podeEditar }: { organizationId: string; temporadaId: string; temporadaTitulo: string; podeEditar: boolean }) {
  const [comDinheiro, setComDinheiro] = useState<boolean | null>(null);
  const [adiantamentos, setAdiantamentos] = useState<AdiantamentoDaTemporada[]>([]);
  const [gastos, setGastos] = useState<GastoDoAdiantamento[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [folha, setFolha] = useState(false);

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
      const [adi, pes] = await Promise.all([
        producao.from("producao_adiantamentos").select("id, pessoa_id, descricao, valor, data, devolvido, situacao, observacao").eq("temporada_id", temporadaId).order("data", { ascending: false }),
        producao.from("producao_pessoas").select("id, nome").eq("organization_id", organizationId).eq("arquivada", false).order("nome"),
      ]);
      const lista = (adi.data ?? []) as AdiantamentoDaTemporada[];
      const gas = lista.length > 0 ? await producao.from("producao_adiantamento_gastos").select("id, adiantamento_id, descricao, valor, data, documento").in("adiantamento_id", lista.map(item => item.id)).order("data") : { data: [], error: null };
      if (!ativo) return;
      setAdiantamentos(lista);
      setGastos((gas.data ?? []) as GastoDoAdiantamento[]);
      setPessoas((pes.data ?? []) as Pessoa[]);
      setCarregado(true);
      setErro(adi.error || pes.error || gas.error ? "Não foi possível carregar os adiantamentos. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [comDinheiro, temporadaId, organizationId, versao]);

  const nomeDaPessoa = useMemo(() => new Map(pessoas.map(item => [item.id, item.nome])), [pessoas]);
  const agrupados = useMemo(() => adiantamentos.map(adiantamento => ({ adiantamento, gastos: gastos.filter(item => item.adiantamento_id === adiantamento.id) })), [adiantamentos, gastos]);

  if (!comDinheiro || !carregado) return null;

  const mudou = () => setVersao(atual => atual + 1);
  const nome = (id: string) => nomeDaPessoa.get(id) ?? "Pessoa arquivada";

  function baixar() {
    const arquivo = new Blob([planilhaDosAdiantamentos({ temporada: temporadaTitulo, itens: agrupados.map(item => ({ pessoa: nome(item.adiantamento.pessoa_id), ...item })) })], { type: "text/csv;charset=utf-8" });
    const endereco = URL.createObjectURL(arquivo);
    const ancora = document.createElement("a");
    ancora.href = endereco;
    ancora.download = "adiantamentos.csv";
    ancora.click();
    URL.revokeObjectURL(endereco);
  }

  return (
    <section aria-labelledby="adiantamentos-da-temporada" className="mt-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="adiantamentos-da-temporada" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Adiantamentos</h2>
        <div className="flex flex-wrap items-center gap-2">
          {adiantamentos.length > 0 && <button type="button" onClick={baixar} className={BOTAO}><Download size={13} aria-hidden="true" /> Planilha</button>}
          {podeEditar && <button type="button" onClick={() => setFolha(true)} className={BOTAO}><Plus size={13} aria-hidden="true" /> Adiantamento</button>}
        </div>
      </div>
      {erro && <div className="mb-2"><Erro texto={erro} /></div>}
      {adiantamentos.length === 0 ? (
        <p className="rounded border bg-white px-5 py-6 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Nenhum adiantamento. Registre o dinheiro entregue a alguém da equipe e acompanhe a prestação de contas: o saldo é o que ainda falta prestar ou devolver. Clique num adiantamento para prestar os gastos e encerrar.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-[0.75rem] tabular-nums text-black/55">Com as pessoas, em aberto: <span className="font-medium text-[#282525]">{formatarReais(totalEmAberto(agrupados))}</span></p>
          <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {agrupados.map(item => {
              const { adiantamento } = item;
              const conta = contaDoAdiantamento(adiantamento, item.gastos);
              return (
                <li key={adiantamento.id}>
                  <Link href={`/producoes/adiantamentos/${adiantamento.id}`} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-black/[.03] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5]">
                    <div className="min-w-0 flex-1 basis-64">
                      <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{nome(adiantamento.pessoa_id)} · {adiantamento.descricao}</p>
                      <p className="text-[0.6875rem] tabular-nums text-black/45">Entregue em {dia(adiantamento.data)}: {formatarReais(conta.valorCentavos)} · prestado {formatarReais(conta.prestadoCentavos)}{conta.devolvidoCentavos > 0 ? ` · devolvido ${formatarReais(conta.devolvidoCentavos)}` : ""} · <span className={conta.saldoCentavos === 0 ? "" : "font-medium text-[#282525]"}>saldo {formatarReais(conta.saldoCentavos)}</span></p>
                      {conta.avisos.map(aviso => <p key={aviso} className="mt-0.5 flex items-start gap-1 text-[0.6875rem] text-[#B07A14]"><TriangleAlert size={11} aria-hidden="true" className="mt-0.5 shrink-0" /> {aviso}</p>)}
                    </div>
                    <span className="rounded border px-2 py-1 text-[0.6875rem] font-medium text-[#282525]" style={{ borderColor: "rgba(13,13,13,.25)" }}>{ROTULO_DA_SITUACAO_DO_ADIANTAMENTO[adiantamento.situacao]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {folha && <AdiantamentoSheet organizationId={organizationId} temporadaId={temporadaId} adiantamento={null} pessoas={pessoas} saldoMinimo={0} onClose={() => setFolha(false)} onSalvou={mudou} />}
    </section>
  );
}
