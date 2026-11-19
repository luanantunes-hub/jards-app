"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Plus } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { APAGAR, BOTAO, BOTAO_PEQUENO, CAMPO, CANCELAR, Erro, ROTULO, SALVAR } from "@/components/producao/estilos";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { emCentavos, formatarReais, lerValorEmReais } from "@/lib/producao/dinheiro";
import {
  diasDoPeriodo, lerDiaria, mensagemDoErroDeAdiantamento, planilhaDasDiarias, textoDoReciboDaDiaria, totaisDasDiarias, totalDaDiariaEmCentavos, type DiariaDaTemporada,
} from "@/lib/producao/adiantamentos";

type Pessoa = { id: string; nome: string };

const paraCampo = (valor: number) => String(valor).replace(".", ",");
const dia = (data: string) => data.split("-").reverse().join("/");

function DiariaSheet({ organizationId, temporadaId, diaria, pessoas, sugestoes, somenteLeitura, onClose, onSalvou }: {
  organizationId: string; temporadaId: string; diaria: DiariaDaTemporada | null; pessoas: Pessoa[]; sugestoes: Record<string, number>; somenteLeitura: boolean; onClose: () => void; onSalvou: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  // `paga` trava a folha; quem só lê vê a diária do mesmo jeito travado.
  const paga = diaria?.pago_em != null || somenteLeitura;
  const [pessoaId, setPessoaId] = useState(diaria?.pessoa_id ?? "");
  const [de, setDe] = useState(diaria?.de ?? "");
  const [ate, setAte] = useState(diaria?.ate ?? "");
  const [dias, setDias] = useState(diaria && diaria.dias !== diasDoPeriodo(diaria.de, diaria.ate) ? String(diaria.dias) : "");
  const [valorDia, setValorDia] = useState(diaria ? paraCampo(diaria.valor_dia) : "");
  const [recibo, setRecibo] = useState(diaria?.recibo ?? "");
  const [pagoEm, setPagoEm] = useState(diaria?.pago_em ?? "");
  const [observacao, setObservacao] = useState(diaria?.observacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const periodo = diasDoPeriodo(de, ate);
  const diasLidos = dias.trim() === "" ? periodo : Number(dias);
  const valorLido = lerValorEmReais(valorDia);
  const total = valorLido !== null && Number.isInteger(diasLidos) && diasLidos > 0 ? diasLidos * emCentavos(valorLido) : null;
  const sugestao = pessoaId !== "" ? sugestoes[pessoaId] : undefined;

  function escolherPessoa(id: string) {
    setPessoaId(id);
    if (valorDia.trim() === "" && sugestoes[id] !== undefined) setValorDia(paraCampo(sugestoes[id]));
  }

  async function salvar(fechar: () => void) {
    const leitura = lerDiaria({ pessoaId, de, ate, dias, valorDia, recibo, pagoEm, observacao }, lerValorEmReais);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { pessoa_id: pessoa, ...resto } = leitura.valor;
    const { error } = diaria
      ? await producao.from("producao_diarias").update(resto).eq("id", diaria.id)
      : await producao.from("producao_diarias").insert({ organization_id: organizationId, temporada_id: temporadaId, pessoa_id: pessoa, ...resto });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDeAdiantamento(error)); return; }
    onSalvou();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!diaria) return;
    confirmDelete({
      title: "Apagar diária?",
      description: `A diária de ${dia(diaria.de)} a ${dia(diaria.ate)} sai da temporada. Isso não pode ser desfeito.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_diarias").delete().eq("id", diaria.id);
        if (error) throw new Error(mensagemDoErroDeAdiantamento(error));
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={diaria ? (paga ? "Diária" : "Editar diária") : "Nova diária"}
      onClose={onClose}
      footer={fechar => (
        <>
          {diaria && !paga && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className={APAGAR}>Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          {!paga && <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : diaria ? "Salvar" : "Lançar diária"}</button>}
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        {diaria?.pago_em != null && <p className="rounded border bg-white px-3 py-2 text-[0.6875rem] text-black/55" style={{ borderColor: "rgba(13,13,13,.1)" }}>A diária está paga (recibo {diaria?.recibo}, em {diaria?.pago_em ? dia(diaria.pago_em) : ""}): nada muda e ela não se apaga.</p>}
        <div>
          <span className={ROTULO}>Quem recebe</span>
          <Dropdown ariaLabel="Pessoa que recebe a diária" value={pessoaId} onChange={escolherPessoa} disabled={salvando || diaria !== null} options={[{ value: "", label: "Escolha a pessoa" }, ...pessoas.map(item => ({ value: item.id, label: item.nome }))]} />
          {sugestao !== undefined && !diaria && <p className="mt-1 text-[0.625rem] text-black/45">A diária da função desta pessoa na temporada é {formatarReais(emCentavos(sugestao))}.</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={ROTULO} htmlFor="dia-de">Primeiro dia</label>
            <input id="dia-de" type="date" className={CAMPO} value={de} onChange={event => setDe(event.target.value)} disabled={salvando || paga} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="dia-ate">Último dia</label>
            <input id="dia-ate" type="date" className={CAMPO} value={ate} onChange={event => setAte(event.target.value)} disabled={salvando || paga} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="dia-dias">Dias de estrada</label>
            <input id="dia-dias" inputMode="numeric" className={CAMPO} value={dias} onChange={event => setDias(event.target.value.replace(/\D/g, ""))} disabled={salvando || paga} placeholder={periodo > 0 ? String(periodo) : "do período"} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={ROTULO} htmlFor="dia-valor">Valor de cada dia (R$)</label>
            <input id="dia-valor" inputMode="decimal" className={CAMPO} value={valorDia} onChange={event => setValorDia(event.target.value)} disabled={salvando || paga} placeholder="200,00" />
          </div>
          <div>
            <span className={ROTULO}>Total</span>
            <p className="flex h-10 items-center text-[0.9375rem] font-medium tabular-nums text-[#282525]">{total === null ? "—" : formatarReais(total)}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={ROTULO} htmlFor="dia-recibo">Número do recibo</label>
            <input id="dia-recibo" className={CAMPO} value={recibo} maxLength={60} onChange={event => setRecibo(event.target.value)} disabled={salvando || paga} placeholder="Para marcar como paga" />
          </div>
          <div>
            <label className={ROTULO} htmlFor="dia-pago">Pago em</label>
            <input id="dia-pago" type="date" className={CAMPO} value={pagoEm} onChange={event => setPagoEm(event.target.value)} disabled={salvando || paga} />
          </div>
        </div>
        <div>
          <label className={ROTULO} htmlFor="dia-observacao">Observação</label>
          <textarea id="dia-observacao" rows={2} className={`${CAMPO} h-auto min-h-[3.5rem] py-2`} value={observacao} maxLength={300} onChange={event => setObservacao(event.target.value)} disabled={salvando || paga} />
        </div>
      </div>
    </TopSheet>
  );
}

/** As diárias de uma temporada (PD5.6): o período de cada pessoa, o valor do dia (sugerido pela função dela), o recibo e o pagamento. Só aparece a quem tem a permissão de dinheiro. */
export function DiariasDaTemporada({ organizationId, temporadaId, temporadaTitulo, podeEditar }: { organizationId: string; temporadaId: string; temporadaTitulo: string; podeEditar: boolean }) {
  const [comDinheiro, setComDinheiro] = useState<boolean | null>(null);
  const [diarias, setDiarias] = useState<DiariaDaTemporada[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [sugestoes, setSugestoes] = useState<Record<string, number>>({});
  const [carregado, setCarregado] = useState(false);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState("");
  const [folha, setFolha] = useState<{ diaria: DiariaDaTemporada | null } | null>(null);

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
      const [dia_, pes, vin] = await Promise.all([
        producao.from("producao_diarias").select("id, pessoa_id, de, ate, dias, valor_dia, recibo, pago_em, observacao").eq("temporada_id", temporadaId).order("de"),
        producao.from("producao_pessoas").select("id, nome").eq("organization_id", organizationId).eq("arquivada", false).order("nome"),
        producao.from("producao_vinculos").select("id, pessoa_id").eq("temporada_id", temporadaId).neq("situacao", "cancelada"),
      ]);
      const vinculos = (vin.data ?? []) as { id: string; pessoa_id: string }[];
      const val = vinculos.length > 0 ? await producao.from("producao_vinculos_valores").select("vinculo_id, diaria").in("vinculo_id", vinculos.map(item => item.id)) : { data: [], error: null };
      if (!ativo) return;
      const pessoaDoVinculo = new Map(vinculos.map(item => [item.id, item.pessoa_id]));
      const mapa: Record<string, number> = {};
      for (const linha of (val.data ?? []) as { vinculo_id: string; diaria: number | null }[]) {
        const pessoa = pessoaDoVinculo.get(linha.vinculo_id);
        if (pessoa && linha.diaria !== null) mapa[pessoa] = Math.max(mapa[pessoa] ?? 0, linha.diaria);
      }
      setDiarias((dia_.data ?? []) as DiariaDaTemporada[]);
      setPessoas((pes.data ?? []) as Pessoa[]);
      setSugestoes(mapa);
      setCarregado(true);
      setErro(dia_.error || pes.error || vin.error || val.error ? "Não foi possível carregar as diárias. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [comDinheiro, temporadaId, organizationId, versao]);

  const nomeDaPessoa = useMemo(() => new Map(pessoas.map(item => [item.id, item.nome])), [pessoas]);
  const totais = useMemo(() => totaisDasDiarias(diarias), [diarias]);

  if (!comDinheiro || !carregado) return null;

  const mudou = () => setVersao(atual => atual + 1);
  const nome = (id: string) => nomeDaPessoa.get(id) ?? "Pessoa arquivada";

  async function copiarRecibo(diaria: DiariaDaTemporada) {
    try { await navigator.clipboard.writeText(textoDoReciboDaDiaria({ pessoa: nome(diaria.pessoa_id), diaria, temporada: temporadaTitulo })); setCopiado(diaria.id); setTimeout(() => setCopiado(""), 2000); }
    catch { setErro("Não foi possível copiar. Selecione o texto e copie à mão."); }
  }

  function baixar() {
    const arquivo = new Blob([planilhaDasDiarias({ temporada: temporadaTitulo, itens: diarias.map(diaria => ({ pessoa: nome(diaria.pessoa_id), diaria })) })], { type: "text/csv;charset=utf-8" });
    const endereco = URL.createObjectURL(arquivo);
    const ancora = document.createElement("a");
    ancora.href = endereco;
    ancora.download = "diarias.csv";
    ancora.click();
    URL.revokeObjectURL(endereco);
  }

  return (
    <section aria-labelledby="diarias-da-temporada" className="mt-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="diarias-da-temporada" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Diárias</h2>
        <div className="flex flex-wrap items-center gap-2">
          {diarias.length > 0 && <button type="button" onClick={baixar} className={BOTAO}><Download size={13} aria-hidden="true" /> Planilha</button>}
          {podeEditar && <button type="button" onClick={() => setFolha({ diaria: null })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Diária</button>}
        </div>
      </div>
      {erro && <div className="mb-2"><Erro texto={erro} /></div>}
      {diarias.length === 0 ? (
        <p className="rounded border bg-white px-5 py-6 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Nenhuma diária. Lance o período de estrada de cada pessoa: o valor do dia vem sugerido pela função dela na temporada, e o recibo trava a diária paga. Clique numa diária para ver ou editar.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-[0.75rem] tabular-nums text-black/55">Total {formatarReais(totais.totalCentavos)} em {totais.dias} {totais.dias === 1 ? "dia" : "dias"} · pago {formatarReais(totais.pagoCentavos)} · <span className="font-medium text-[#282525]">a pagar {formatarReais(totais.aPagarCentavos)}</span></p>
          <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {diarias.map(item => (
              <li key={item.id} className="flex items-center">
                <button type="button" onClick={() => setFolha({ diaria: item })} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-left transition hover:bg-black/[.03] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5]">
                  <span className="min-w-0 flex-1 basis-56">
                    <span className="block truncate text-[0.8125rem] font-medium text-[#282525]">{nome(item.pessoa_id)}</span>
                    <span className="block truncate text-[0.6875rem] tabular-nums text-black/45">{dia(item.de)} a {dia(item.ate)} · {item.dias} {item.dias === 1 ? "dia" : "dias"} × {formatarReais(emCentavos(item.valor_dia))}</span>
                    <span className={`block text-[0.6875rem] ${item.pago_em ? "text-black/45" : "text-[#B07A14]"}`}>{item.pago_em ? `Paga em ${dia(item.pago_em)} · recibo ${item.recibo}` : item.recibo ? `Recibo ${item.recibo}, falta o dia do pagamento` : "A pagar"}</span>
                  </span>
                  <span className="text-[0.8125rem] tabular-nums text-[#282525]">{formatarReais(totalDaDiariaEmCentavos(item))}</span>
                </button>
                <button type="button" className={`${BOTAO_PEQUENO} mr-3 shrink-0`} onClick={() => void copiarRecibo(item)}><Copy size={11} aria-hidden="true" className="mr-1 inline" />{copiado === item.id ? "Copiado" : "Recibo"}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {folha && <DiariaSheet organizationId={organizationId} temporadaId={temporadaId} diaria={folha.diaria} pessoas={pessoas} sugestoes={sugestoes} somenteLeitura={!podeEditar} onClose={() => setFolha(null)} onSalvou={mudou} />}
    </section>
  );
}
