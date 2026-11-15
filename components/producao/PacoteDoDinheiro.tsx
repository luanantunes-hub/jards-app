"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { BOTAO, Erro } from "@/components/producao/estilosDoBordero";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diaEMes } from "@/lib/producao/agenda";
import type { AdiantamentoDaTemporada, DiariaDaTemporada, GastoDoAdiantamento } from "@/lib/producao/adiantamentos";
import type { AcordoDaTemporada } from "@/lib/producao/acordos";
import type { FaturaDaTemporada, ParcelaDaFatura } from "@/lib/producao/faturas";
import type { DivisaoDoLancamento, LancamentoDaTemporada } from "@/lib/producao/lancamentos";
import type { LinhaDoOrcamento } from "@/lib/producao/orcamento";
import type { PedidoDaTemporada } from "@/lib/producao/pedidos";
import type { SituacaoDoOrcamento } from "@/lib/producao/estados";
import { montarPacote, nomeDoPacote } from "@/lib/producao/pacote";
import { montarZip } from "@/lib/producao/zip";

const em = <T,>(resultado: { data: unknown; error: unknown }) => ({ linhas: (resultado.data ?? []) as T[], falhou: resultado.error !== null });

/**
 * O pacote do dinheiro da temporada (PD5.7): um .zip com as planilhas do orçamento, dos acordos, dos pedidos, dos lançamentos, das faturas, dos adiantamentos e das diárias,
 * mais um resumo. Só aparece a quem tem a permissão de dinheiro. Os arquivos de notas e recibos entram quando a produção os guardar.
 */
export function PacoteDoDinheiro({ organizationId, temporadaId, temporadaTitulo }: { organizationId: string; temporadaId: string; temporadaTitulo: string }) {
  const [comDinheiro, setComDinheiro] = useState<boolean | null>(null);
  const [montando, setMontando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data } = await clienteDaProducao(createClient()).rpc("auth_producao_pode", { p_org: organizationId, p_acao: "dinheiro" });
      if (ativo) setComDinheiro(data === true);
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  if (!comDinheiro) return null;

  async function baixar() {
    setMontando(true);
    setErro(null);
    try {
      const producao = clienteDaProducao(createClient());
      const [orc, aco, ped, lan, fat, adi, dia, dat, pes] = await Promise.all([
        producao.from("producao_orcamentos").select("id, nome, situacao").eq("temporada_id", temporadaId).order("created_at"),
        producao.from("producao_acordos").select("id, contraparte, tipo, sentido, situacao, valor_fixo, garantia, percentual_bilheteria, bonus_publico, bonus_valor, despesas_nossas, despesas_da_contraparte, retencoes, observacao, assinado_em").eq("temporada_id", temporadaId).order("created_at"),
        producao.from("producao_pedidos").select("id, orcamento_linha_id, solicitante_id, descricao, favorecido, valor, justificativa, situacao, aprovado_por, aprovado_em, motivo_recusa, pendencia, pendencia_ate").eq("temporada_id", temporadaId).order("created_at"),
        producao.from("producao_lancamentos").select("id, descricao, favorecido, documento, data, valor, observacao, pedido_id").eq("temporada_id", temporadaId).order("data"),
        producao.from("producao_faturas").select("id, acordo_id, contratante, descricao, situacao, valor, retencoes, nota_numero, emissao, vencimento, observacao").eq("temporada_id", temporadaId).order("created_at"),
        producao.from("producao_adiantamentos").select("id, pessoa_id, descricao, valor, data, devolvido, situacao, observacao").eq("temporada_id", temporadaId).order("data"),
        producao.from("producao_diarias").select("id, pessoa_id, de, ate, dias, valor_dia, recibo, pago_em, observacao").eq("temporada_id", temporadaId).order("de"),
        producao.from("producao_datas").select("id, data").eq("temporada_id", temporadaId).order("data"),
        producao.from("producao_pessoas").select("id, nome").eq("organization_id", organizationId),
      ]);
      const orcamentos = em<{ id: string; nome: string; situacao: SituacaoDoOrcamento }>(orc);
      const acordos = em<AcordoDaTemporada>(aco);
      const lancamentos = em<LancamentoDaTemporada>(lan);
      const faturas = em<FaturaDaTemporada>(fat);
      const adiantamentos = em<AdiantamentoDaTemporada>(adi);
      const [lin, coberturas, div, par, gas] = await Promise.all([
        orcamentos.linhas.length > 0 ? producao.from("producao_orcamento_linhas").select("id, orcamento_id, categoria, descricao, estimativa, aprovado, revisado, comprometido, pago, ordem, formula, acordo_id").in("orcamento_id", orcamentos.linhas.map(item => item.id)) : { data: [], error: null },
        acordos.linhas.length > 0 ? producao.from("producao_acordo_datas").select("acordo_id, data_id").in("acordo_id", acordos.linhas.map(item => item.id)) : { data: [], error: null },
        lancamentos.linhas.length > 0 ? producao.from("producao_lancamento_linhas").select("id, lancamento_id, orcamento_linha_id, valor").in("lancamento_id", lancamentos.linhas.map(item => item.id)) : { data: [], error: null },
        faturas.linhas.length > 0 ? producao.from("producao_fatura_parcelas").select("id, fatura_id, rotulo, valor, vencimento, recebido_em").in("fatura_id", faturas.linhas.map(item => item.id)) : { data: [], error: null },
        adiantamentos.linhas.length > 0 ? producao.from("producao_adiantamento_gastos").select("id, adiantamento_id, descricao, valor, data, documento").in("adiantamento_id", adiantamentos.linhas.map(item => item.id)) : { data: [], error: null },
      ]);
      const todos = [orc, aco, ped, lan, fat, adi, dia, dat, pes, lin, coberturas, div, par, gas];
      if (todos.some(item => item.error !== null)) throw new Error("Não foi possível ler tudo o que vai no pacote. Tente de novo.");
      const datas = new Map(em<{ id: string; data: string }>(dat).linhas.map(item => [item.id, diaEMes(item.data)]));
      const cobertas = em<{ acordo_id: string; data_id: string }>(coberturas).linhas;
      const nomes = new Map(em<{ id: string; nome: string }>(pes).linhas.map(item => [item.id, item.nome]));
      const hoje = new Date().toISOString().slice(0, 10);
      const arquivos = montarPacote({
        temporada: temporadaTitulo, hoje, orcamentos: orcamentos.linhas, linhas: em<LinhaDoOrcamento & { orcamento_id: string }>(lin).linhas, acordos: acordos.linhas,
        datasDoAcordo: id => cobertas.filter(item => item.acordo_id === id).map(item => datas.get(item.data_id) ?? "").filter(Boolean),
        pedidos: em<PedidoDaTemporada>(ped).linhas, lancamentos: lancamentos.linhas, divisoes: em<DivisaoDoLancamento>(div).linhas, faturas: faturas.linhas, parcelas: em<ParcelaDaFatura>(par).linhas,
        adiantamentos: adiantamentos.linhas, gastos: em<GastoDoAdiantamento>(gas).linhas, diarias: em<DiariaDaTemporada>(dia).linhas, nomeDaPessoa: id => nomes.get(id) ?? "Pessoa arquivada",
      });
      const arquivo = new Blob([montarZip(arquivos) as BlobPart], { type: "application/zip" });
      const endereco = URL.createObjectURL(arquivo);
      const ancora = document.createElement("a");
      ancora.href = endereco;
      ancora.download = nomeDoPacote(temporadaTitulo, hoje);
      ancora.click();
      URL.revokeObjectURL(endereco);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível montar o pacote. Tente de novo.");
    } finally {
      setMontando(false);
    }
  }

  return (
    <section aria-labelledby="pacote-do-dinheiro" className="mt-8">
      <h2 id="pacote-do-dinheiro" className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Pacote do dinheiro</h2>
      {erro && <div className="mb-2"><Erro texto={erro} /></div>}
      <div className="flex flex-wrap items-center gap-3 rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <button type="button" onClick={() => void baixar()} disabled={montando} className={BOTAO}><Package size={13} aria-hidden="true" /> {montando ? "Montando o pacote…" : "Baixar o pacote (.zip)"}</button>
      </div>
    </section>
  );
}
