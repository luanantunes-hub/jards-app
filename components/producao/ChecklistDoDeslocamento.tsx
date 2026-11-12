"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Select } from "@/components/ui/Select";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { SITUACOES_DA_CONFERENCIA, type ContratacaoDoVeiculo, type SituacaoDaConferencia, type TipoDeDeslocamento, type TipoDoItemDoChecklist } from "@/lib/producao/estados";
import {
  avisosDeCapacidade, documentosParaPreencher, documentosSugeridos, itensParaPreencher, lerLinhaDoChecklist, resumoDaConferencia, ROTULO_DA_CONFERENCIA, textoDoResumo, totaisDoChecklist,
  type FaseDaConferencia,
} from "@/lib/producao/checklist";

type Linha = { id: string; tipo: TipoDoItemDoChecklist; nome: string; quantidade: number; item_id: string | null; saida: SituacaoDaConferencia; volta: SituacaoDaConferencia };
type Medidas = { comprimento_cm: number | null; largura_cm: number | null; altura_cm: number | null; peso_kg: number | null };
type ItemDaData = { item_id: string; nome: string; quantidade: number };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const BOTAO = "flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";

const COR_DA_SITUACAO: Partial<Record<SituacaoDaConferencia, string>> = { faltou: "#B23B3B", avariado: "#B07A14" };

/** O checklist de transporte de um deslocamento (PD6.3): o que vai e os documentos, conferidos na saída e na volta, com peso e volume contra o veículo. */
export function ChecklistDoDeslocamento({ organizationId, deslocamento, veiculo, podeEditar, onClose, onMudou }: {
  organizationId: string;
  deslocamento: { id: string; data_id: string; tipo: TipoDeDeslocamento; rotulo: string };
  veiculo: { capacidade_carga_kg: number | null; capacidade_volume_m3: number | null; contratacao: ContratacaoDoVeiculo } | null;
  podeEditar: boolean;
  onClose: () => void;
  onMudou: () => void;
}) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [medidas, setMedidas] = useState<Map<string, Medidas>>(new Map());
  const [daData, setDaData] = useState<ItemDaData[]>([]);
  const [nomeNovo, setNomeNovo] = useState("");
  const [quantidadeNova, setQuantidadeNova] = useState("1");
  const [tipoNovo, setTipoNovo] = useState<TipoDoItemDoChecklist>("item");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [lin, lig] = await Promise.all([
        producao.from("producao_checklist_itens").select("id, tipo, nome, quantidade, item_id, saida, volta").eq("deslocamento_id", deslocamento.id).order("tipo").order("nome"),
        producao.from("producao_item_datas").select("item_id, quantidade").eq("data_id", deslocamento.data_id),
      ]);
      const ids = [...new Set([...(lin.data ?? []).map(linha => linha.item_id), ...(lig.data ?? []).map(ligacao => ligacao.item_id)].filter((id): id is string => Boolean(id)))];
      const itens = ids.length > 0
        ? await producao.from("producao_itens").select("id, nome, comprimento_cm, largura_cm, altura_cm, peso_kg").in("id", ids)
        : { data: [] as { id: string; nome: string; comprimento_cm: number | null; largura_cm: number | null; altura_cm: number | null; peso_kg: number | null }[] };
      if (!ativo) return;
      const porId = new Map((itens.data ?? []).map(item => [item.id, item]));
      setLinhas(lin.data ?? []);
      setMedidas(new Map((itens.data ?? []).map(item => [item.id, { comprimento_cm: item.comprimento_cm, largura_cm: item.largura_cm, altura_cm: item.altura_cm, peso_kg: item.peso_kg }])));
      setDaData((lig.data ?? []).map(ligacao => ({ item_id: ligacao.item_id, nome: porId.get(ligacao.item_id)?.nome ?? "Item", quantidade: ligacao.quantidade })));
      setErro(lin.error ? "Não foi possível carregar o checklist. Tente de novo." : null);
    })();
    return () => { ativo = false; };
  }, [deslocamento.id, deslocamento.data_id, versao]);

  const recarregar = useCallback(() => { setVersao(atual => atual + 1); onMudou(); }, [onMudou]);

  async function executar(acao: () => PromiseLike<{ error: { code?: string } | null }>, mensagem: string): Promise<boolean> {
    setOcupado(true);
    setErro(null);
    const { error } = await acao();
    setOcupado(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode mudar o checklist." : mensagem); return false; }
    recarregar();
    return true;
  }

  async function acrescentar() {
    const leitura = lerLinhaDoChecklist({ nome: nomeNovo, quantidade: quantidadeNova });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    const ok = await executar(() => clienteDaProducao(createClient()).from("producao_checklist_itens").insert({
      organization_id: organizationId, deslocamento_id: deslocamento.id, tipo: tipoNovo, nome: leitura.nome, quantidade: tipoNovo === "documento" ? 1 : leitura.quantidade,
    }), "Não foi possível acrescentar a linha. Tente de novo.");
    if (ok) { setNomeNovo(""); setQuantidadeNova("1"); }
  }

  const faltamDaData = useMemo(() => itensParaPreencher(daData, new Set((linhas ?? []).map(linha => linha.item_id).filter((id): id is string => Boolean(id)))), [daData, linhas]);
  const sugestoes = useMemo(() => documentosParaPreencher(documentosSugeridos(deslocamento.tipo, veiculo?.contratacao ?? null), (linhas ?? []).filter(linha => linha.tipo === "documento").map(linha => linha.nome)), [deslocamento.tipo, veiculo, linhas]);
  const totais = useMemo(() => totaisDoChecklist((linhas ?? []).map(linha => ({ tipo: linha.tipo, quantidade: linha.quantidade, medidas: linha.item_id ? medidas.get(linha.item_id) ?? null : null }))), [linhas, medidas]);
  const avisos = useMemo(() => avisosDeCapacidade(totais, veiculo), [totais, veiculo]);

  async function preencherDaData() {
    await executar(() => clienteDaProducao(createClient()).from("producao_checklist_itens").insert(faltamDaData.map(item => ({
      organization_id: organizationId, deslocamento_id: deslocamento.id, tipo: "item" as const, nome: item.nome, quantidade: item.quantidade, item_id: item.item_id,
    }))), "Não foi possível preencher com o que a data leva. Tente de novo.");
  }

  async function sugerirDocumentos() {
    await executar(() => clienteDaProducao(createClient()).from("producao_checklist_itens").insert(sugestoes.map(nome => ({
      organization_id: organizationId, deslocamento_id: deslocamento.id, tipo: "documento" as const, nome, quantidade: 1,
    }))), "Não foi possível sugerir os documentos. Tente de novo.");
  }

  const resumoSaida = resumoDaConferencia(linhas ?? [], "saida");
  const resumoVolta = resumoDaConferencia(linhas ?? [], "volta");

  const conferencia = (linha: Linha, fase: FaseDaConferencia) => (
    <div className="min-w-[7.5rem]">
      <span className="mb-1 block text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{fase === "saida" ? "Saída" : "Volta"}</span>
      {podeEditar ? (
        <Select block={false} aria-label={`${fase === "saida" ? "Saída" : "Volta"} de ${linha.nome}`} value={linha[fase]} disabled={ocupado}
          onChange={event => void executar(() => clienteDaProducao(createClient()).from("producao_checklist_itens").update(fase === "saida" ? { saida: event.target.value as SituacaoDaConferencia } : { volta: event.target.value as SituacaoDaConferencia }).eq("id", linha.id), "Não foi possível salvar a conferência. Tente de novo.")}
          className="h-10 pl-3 pr-8">
          {SITUACOES_DA_CONFERENCIA.map(situacao => <option key={situacao} value={situacao}>{ROTULO_DA_CONFERENCIA[fase][situacao]}</option>)}
        </Select>
      ) : (
        <span className="text-[0.8125rem]" style={{ color: COR_DA_SITUACAO[linha[fase]] ?? "#282525" }}>{ROTULO_DA_CONFERENCIA[fase][linha[fase]]}</span>
      )}
    </div>
  );

  return (
    <TopSheet
      titulo={`Checklist · ${deslocamento.rotulo}`}
      onClose={onClose}
      footer={fechar => <button type="button" onClick={fechar} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Fechar</button>}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {linhas === null ? (
          <div className="h-24 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : (
          <>
            <div className="space-y-1 text-[0.75rem] text-black/55">
              <p>Saída: {textoDoResumo(resumoSaida)} · Volta: {textoDoResumo(resumoVolta)}</p>
              {totais.pesoKg > 0 || totais.volumeM3 > 0 ? <p className="tabular-nums">Carga: {totais.pesoKg.toLocaleString("pt-BR")} kg · {totais.volumeM3.toLocaleString("pt-BR")} m³{totais.semMedidas > 0 ? ` (${totais.semMedidas} ${totais.semMedidas === 1 ? "item sem medida fica fora" : "itens sem medida ficam fora"})` : ""}</p> : null}
              {avisos.map(aviso => <p key={aviso} className="flex items-start gap-1.5" style={{ color: "#B07A14" }}><TriangleAlert size={12} aria-hidden="true" className="mt-px shrink-0" />{aviso}</p>)}
            </div>

            {podeEditar && (faltamDaData.length > 0 || sugestoes.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {faltamDaData.length > 0 && <button type="button" onClick={() => void preencherDaData()} disabled={ocupado} className={BOTAO}><Plus size={13} aria-hidden="true" /> Preencher com o que a data leva ({faltamDaData.length})</button>}
                {sugestoes.length > 0 && <button type="button" onClick={() => void sugerirDocumentos()} disabled={ocupado} className={BOTAO}><Plus size={13} aria-hidden="true" /> Sugerir documentos ({sugestoes.length})</button>}
              </div>
            )}

            {linhas.length === 0 ? (
              <p className="rounded border bg-white px-4 py-5 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Nada no checklist ainda. {podeEditar ? "Preencha com o que a data leva, sugira os documentos ou acrescente uma linha." : ""}</p>
            ) : (
              <ul className="divide-y divide-black/[.06] rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                {linhas.map(linha => (
                  <li key={linha.id} className="flex flex-wrap items-end gap-x-4 gap-y-2 px-3 py-2.5">
                    <span className="min-w-0 flex-1 basis-48">
                      <span className="block text-[0.8125rem] font-medium text-[#282525]">{linha.nome}{linha.tipo === "item" && linha.quantidade > 1 ? ` × ${linha.quantidade}` : ""}</span>
                      <span className="block text-[0.6875rem] text-black/45">{linha.tipo === "documento" ? "documento" : linha.item_id ? "do inventário" : "item"}</span>
                    </span>
                    {conferencia(linha, "saida")}
                    {conferencia(linha, "volta")}
                    {podeEditar && <button type="button" disabled={ocupado} onClick={() => void executar(() => clienteDaProducao(createClient()).from("producao_checklist_itens").delete().eq("id", linha.id), "Não foi possível tirar a linha.")} aria-label={`Tirar ${linha.nome} do checklist`} title="Tirar" className="flex h-10 w-10 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-50"><Trash2 size={14} aria-hidden="true" /></button>}
                  </li>
                ))}
              </ul>
            )}

            {podeEditar && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-32">
                  <label className="mb-1.5 block text-[0.6875rem] font-medium text-black/55" htmlFor="ck-tipo">Tipo</label>
                  <Select id="ck-tipo" block={false} value={tipoNovo} onChange={event => setTipoNovo(event.target.value as TipoDoItemDoChecklist)} className="h-10 pl-3 pr-8">
                    <option value="item">Item</option>
                    <option value="documento">Documento</option>
                  </Select>
                </div>
                <div className="min-w-0 flex-1 basis-48">
                  <label className="mb-1.5 block text-[0.6875rem] font-medium text-black/55" htmlFor="ck-nome">O que vai</label>
                  <input id="ck-nome" className={CAMPO} value={nomeNovo} onChange={event => setNomeNovo(event.target.value)} placeholder={tipoNovo === "documento" ? "CNH do motorista" : "Cabos de energia"} maxLength={200} disabled={ocupado} />
                </div>
                {tipoNovo === "item" && (
                  <div className="w-20">
                    <label className="mb-1.5 block text-[0.6875rem] font-medium text-black/55" htmlFor="ck-quantidade">Qtd.</label>
                    <input id="ck-quantidade" inputMode="numeric" className={CAMPO} value={quantidadeNova} onChange={event => setQuantidadeNova(event.target.value)} disabled={ocupado} />
                  </div>
                )}
                <button type="button" onClick={() => void acrescentar()} disabled={ocupado} className={BOTAO}><Plus size={13} aria-hidden="true" /> Acrescentar</button>
              </div>
            )}
          </>
        )}
      </div>
    </TopSheet>
  );
}
