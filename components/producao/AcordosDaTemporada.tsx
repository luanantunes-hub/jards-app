"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { APAGAR, BOTAO, CAMPO, CANCELAR, Erro, ROTULO, SALVAR } from "@/components/producao/estilosDoBordero";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { SENTIDOS_DO_ACORDO, TIPOS_DE_ACORDO, type SentidoDoAcordo, type TipoDeAcordo } from "@/lib/producao/estados";
import { diaEMes } from "@/lib/producao/agenda";
import { lerValorEmReais } from "@/lib/producao/bordero";
import {
  acordoTravado, lerAcordo, mensagemDoErroDeAcordo, resumoDasCondicoes, ROTULO_DA_SITUACAO_DO_ACORDO, ROTULO_DO_SENTIDO_DO_ACORDO, ROTULO_DO_TIPO_DE_ACORDO,
  type AcordoDaTemporada,
} from "@/lib/producao/acordos";

/** Aviso entre os blocos da página da temporada: o orçamento escuta para recalcular o comprometido quando um acordo muda. */
export const EVENTO_ACORDOS_MUDARAM = "producao-acordos-mudaram";

export type DataDaTemporada = { id: string; data: string };
type Cobertura = { acordo_id: string; data_id: string };

const paraCampo = (valor: number | null) => (valor === null ? "" : String(valor).replace(".", ","));

export function AcordoSheet({ organizationId, temporadaId, acordo, datas, cobertas, onClose, onSalvou }: {
  organizationId: string; temporadaId: string; acordo: AcordoDaTemporada | null; datas: DataDaTemporada[]; cobertas: string[]; onClose: () => void; onSalvou: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const travado = acordo !== null && acordoTravado(acordo.situacao);
  const [contraparte, setContraparte] = useState(acordo?.contraparte ?? "");
  const [tipo, setTipo] = useState<TipoDeAcordo>(acordo?.tipo ?? "cache");
  const [sentido, setSentido] = useState<SentidoDoAcordo>(acordo?.sentido ?? "a_pagar");
  const [valorFixo, setValorFixo] = useState(paraCampo(acordo?.valor_fixo ?? null));
  const [garantia, setGarantia] = useState(paraCampo(acordo?.garantia ?? null));
  const [percentual, setPercentual] = useState(paraCampo(acordo?.percentual_bilheteria ?? null));
  const [bonusPublico, setBonusPublico] = useState(acordo?.bonus_publico === null || acordo === null ? "" : String(acordo.bonus_publico));
  const [bonusValor, setBonusValor] = useState(paraCampo(acordo?.bonus_valor ?? null));
  const [despesasNossas, setDespesasNossas] = useState(acordo?.despesas_nossas ?? "");
  const [despesasDaContraparte, setDespesasDaContraparte] = useState(acordo?.despesas_da_contraparte ?? "");
  const [retencoes, setRetencoes] = useState(acordo?.retencoes ?? "");
  const [observacao, setObservacao] = useState(acordo?.observacao ?? "");
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set(cobertas));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerAcordo({ contraparte, tipo, sentido, valorFixo, garantia, percentual, bonusPublico, bonusValor, despesasNossas, despesasDaContraparte, retencoes, observacao }, lerValorEmReais);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    try {
      const producao = clienteDaProducao(createClient());
      let acordoId = acordo?.id ?? "";
      if (acordo) {
        const { error } = await producao.from("producao_acordos").update(travado ? { observacao: leitura.valor.observacao } : leitura.valor).eq("id", acordo.id);
        if (error) throw new Error(mensagemDoErroDeAcordo(error));
      } else {
        const { data, error } = await producao.from("producao_acordos").insert({ organization_id: organizationId, temporada_id: temporadaId, ...leitura.valor }).select("id").single();
        if (error || !data) throw new Error(mensagemDoErroDeAcordo(error ?? {}));
        acordoId = data.id;
      }
      if (!travado) {
        const atuais = new Set(cobertas);
        const sair = [...atuais].filter(id => !escolhidas.has(id));
        const entrar = [...escolhidas].filter(id => !atuais.has(id));
        if (sair.length > 0) {
          const { error } = await producao.from("producao_acordo_datas").delete().eq("acordo_id", acordoId).in("data_id", sair);
          if (error) throw new Error(mensagemDoErroDeAcordo(error));
        }
        if (entrar.length > 0) {
          const { error } = await producao.from("producao_acordo_datas").insert(entrar.map(dataId => ({ organization_id: organizationId, acordo_id: acordoId, data_id: dataId })));
          if (error) throw new Error(mensagemDoErroDeAcordo(error));
        }
      }
      onSalvou();
      fechar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  function apagar(fechar: () => void) {
    if (!acordo) return;
    confirmDelete({
      title: "Apagar acordo?",
      description: `O acordo com ${acordo.contraparte} sai da temporada. Isso não pode ser desfeito.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_acordos").delete().eq("id", acordo.id);
        if (error) throw new Error(mensagemDoErroDeAcordo(error));
        onSalvou();
        fechar();
      },
    });
  }

  const valor = (id: string, rotulo: string, texto: string, mudar: (novo: string) => void, placeholder: string, modo: "decimal" | "numeric" = "decimal") => (
    <div>
      <label className={ROTULO} htmlFor={id}>{rotulo}</label>
      <input id={id} inputMode={modo} className={CAMPO} value={texto} onChange={event => mudar(event.target.value)} disabled={salvando || travado} placeholder={placeholder} />
    </div>
  );
  const texto = (id: string, rotulo: string, conteudo: string, mudar: (novo: string) => void, limite: number, livre = false) => (
    <div>
      <label className={ROTULO} htmlFor={id}>{rotulo}</label>
      <textarea id={id} rows={2} className={`${CAMPO} h-auto min-h-[3.5rem] py-2`} value={conteudo} maxLength={limite} onChange={event => mudar(event.target.value)} disabled={salvando || (travado && !(livre && acordo?.situacao === "assinado"))} />
    </div>
  );

  return (
    <TopSheet
      titulo={acordo ? `Acordo: ${acordo.contraparte}` : "Novo acordo"}
      onClose={onClose}
      footer={fechar => (
        <>
          {acordo && !travado && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className={APAGAR}>Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : acordo ? "Salvar" : "Criar acordo"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        {travado && <p className="rounded border bg-white px-3 py-2 text-[0.6875rem] text-black/55" style={{ borderColor: "rgba(13,13,13,.1)" }}>O acordo está {acordo.situacao === "assinado" ? "assinado" : "encerrado"}: as condições e as datas não mudam. Só a observação pode ser ajustada{acordo.situacao === "encerrado" ? " — e, encerrado, nem ela" : ""}.</p>}
        <div>
          <label className={ROTULO} htmlFor="aco-contraparte">Com quem</label>
          <input id="aco-contraparte" className={CAMPO} value={contraparte} maxLength={120} onChange={event => setContraparte(event.target.value)} disabled={salvando || travado} placeholder="Teatro Central" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={ROTULO}>Tipo</span>
            <Dropdown ariaLabel="Tipo de acordo" value={tipo} onChange={novo => setTipo(novo as TipoDeAcordo)} disabled={salvando || travado} options={TIPOS_DE_ACORDO.map(item => ({ value: item, label: ROTULO_DO_TIPO_DE_ACORDO[item] }))} />
          </div>
          <div>
            <span className={ROTULO}>Quem paga</span>
            <Dropdown ariaLabel="Sentido do acordo" value={sentido} onChange={novo => setSentido(novo as SentidoDoAcordo)} disabled={salvando || travado} options={SENTIDOS_DO_ACORDO.map(item => ({ value: item, label: item === "a_pagar" ? "Nós pagamos" : "Nós recebemos" }))} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {valor("aco-fixo", "Valor fixo (R$)", valorFixo, setValorFixo, "8.000,00")}
          {valor("aco-garantia", "Garantia (R$)", garantia, setGarantia, "10.000,00")}
          {valor("aco-percentual", "% da bilheteria", percentual, setPercentual, "20")}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {valor("aco-bonus-publico", "Bônus a partir de (pessoas)", bonusPublico, novo => setBonusPublico(novo.replace(/\D/g, "")), "300", "numeric")}
          {valor("aco-bonus-valor", "Valor do bônus (R$)", bonusValor, setBonusValor, "500,00")}
        </div>
        {texto("aco-nossas", "Despesas por nossa conta", despesasNossas, setDespesasNossas, 400)}
        {texto("aco-deles", "Despesas por conta da contraparte", despesasDaContraparte, setDespesasDaContraparte, 400)}
        {texto("aco-retencoes", "Retenções", retencoes, setRetencoes, 400)}
        <div>
          <span className={ROTULO}>Datas cobertas</span>
          {datas.length === 0 ? (
            <p className="text-[0.75rem] text-black/45">A temporada ainda não tem datas.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {datas.map(data => (
                <li key={data.id}>
                  <label className={`flex h-9 cursor-pointer items-center gap-2 rounded border px-3 text-[0.75rem] ${escolhidas.has(data.id) ? "border-[#282525] text-[#282525]" : "border-black/12 text-black/65"} ${salvando || travado ? "opacity-60" : "hover:bg-black/[.04]"}`}>
                    <input type="checkbox" className="accent-[#282525]" checked={escolhidas.has(data.id)} disabled={salvando || travado}
                      onChange={() => setEscolhidas(atual => { const novo = new Set(atual); if (novo.has(data.id)) novo.delete(data.id); else novo.add(data.id); return novo; })} />
                    {diaEMes(data.data)}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        {texto("aco-observacao", "Observação", observacao, setObservacao, 500, true)}
      </div>
    </TopSheet>
  );
}

/** Os acordos de uma temporada (PD4.5): condições, situação, datas cobertas. Só aparece a quem tem a permissão de dinheiro. Um acordo a pagar assinado vira o comprometido da linha do orçamento a que está ligado. */
export function AcordosDaTemporada({ organizationId, temporadaId, podeEditar }: { organizationId: string; temporadaId: string; podeEditar: boolean }) {
  const [comDinheiro, setComDinheiro] = useState<boolean | null>(null);
  const [acordos, setAcordos] = useState<AcordoDaTemporada[]>([]);
  const [datas, setDatas] = useState<DataDaTemporada[]>([]);
  const [coberturas, setCoberturas] = useState<Cobertura[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [folha, setFolha] = useState<{ acordo: AcordoDaTemporada | null } | null>(null);

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
      const [aco, dat] = await Promise.all([
        producao.from("producao_acordos").select("id, contraparte, tipo, sentido, situacao, valor_fixo, garantia, percentual_bilheteria, bonus_publico, bonus_valor, despesas_nossas, despesas_da_contraparte, retencoes, observacao, assinado_em").eq("temporada_id", temporadaId).order("created_at"),
        producao.from("producao_datas").select("id, data").eq("temporada_id", temporadaId).order("data"),
      ]);
      const lista = (aco.data ?? []) as AcordoDaTemporada[];
      const cob = lista.length > 0 ? await producao.from("producao_acordo_datas").select("acordo_id, data_id").in("acordo_id", lista.map(item => item.id)) : { data: [], error: null };
      if (!ativo) return;
      setAcordos(lista);
      setDatas((dat.data ?? []) as DataDaTemporada[]);
      setCoberturas((cob.data ?? []) as Cobertura[]);
      setCarregado(true);
      setErro(aco.error || dat.error || cob.error ? "Não foi possível carregar os acordos. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [comDinheiro, temporadaId, versao]);

  if (!comDinheiro || !carregado) return null;

  const mudou = () => { setVersao(atual => atual + 1); window.dispatchEvent(new Event(EVENTO_ACORDOS_MUDARAM)); };
  const datasDoAcordo = (id: string) => coberturas.filter(item => item.acordo_id === id).map(item => item.data_id);

  return (
    <section aria-labelledby="acordos-da-temporada" className="mt-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="acordos-da-temporada" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Acordos</h2>
        {podeEditar && <button type="button" onClick={() => setFolha({ acordo: null })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Acordo</button>}
      </div>
      {erro && <div className="mb-2"><Erro texto={erro} /></div>}
      {acordos.length === 0 ? (
        <p className="rounded border bg-white px-5 py-6 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Nenhum acordo nesta temporada. Registre o que foi combinado com a casa, o contratante ou o elenco: valor, garantia, percentual da bilheteria, bônus e quem arca com cada despesa. Clique num acordo para ver onde ele está e dar o próximo passo.</p>
      ) : (
        <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {acordos.map(acordo => {
            const cobertas = datasDoAcordo(acordo.id);
            return (
              <li key={acordo.id}>
                <Link href={`/producoes/acordos/${acordo.id}`} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-black/[.03] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5]">
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{acordo.contraparte}</p>
                    <p className="text-[0.6875rem] text-black/45">{ROTULO_DO_TIPO_DE_ACORDO[acordo.tipo]} · {ROTULO_DO_SENTIDO_DO_ACORDO[acordo.sentido]}{cobertas.length > 0 ? ` · ${cobertas.length} ${cobertas.length === 1 ? "data" : "datas"}` : ""}</p>
                    <p className="mt-1 text-[0.75rem] tabular-nums text-black/65">{resumoDasCondicoes(acordo)}</p>
                  </div>
                  <span className="rounded border px-2 py-1 text-[0.6875rem] font-medium text-[#282525]" style={{ borderColor: "rgba(13,13,13,.25)" }}>
                    {ROTULO_DA_SITUACAO_DO_ACORDO[acordo.situacao]}{acordo.assinado_em ? ` em ${acordo.assinado_em.split("-").reverse().join("/")}` : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {folha && <AcordoSheet organizationId={organizationId} temporadaId={temporadaId} acordo={folha.acordo} datas={datas} cobertas={folha.acordo ? datasDoAcordo(folha.acordo.id) : []} onClose={() => setFolha(null)} onSalvou={mudou} />}
    </section>
  );
}
