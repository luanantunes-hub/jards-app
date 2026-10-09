"use client";

// Grade horária dos recursos humanos (P8.7): os cargos da equipe, com o item
// do orçamento que os paga, a quantidade de contratados, o horário de cada dia,
// a carga semanal e a forma de contratação. Na LIE vai na PCP num modelo
// próprio da DPPIE (Portaria MESP 10/2026, art. 65, VII); a seção só aparece
// quando o regime pede a grade de RH ou quando já há cargos.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Briefcase, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { useRegimesPublicados } from "@/hooks/useRegimesPublicados";
import { CargoModal, type ItemParaCargo } from "@/components/prestacao/grade/CargoModal";
import type { Achado } from "@/lib/prestacao/checagens";
import { checarRecursosHumanos } from "@/lib/prestacao/checagens/checar-rh";
import {
  cargaDivergente, cargaDosHorarios, cargosSugeridos, faltasDoCargo, horasBr, itensDeRh, numeroDaCarga,
  pagosDoCargo, regimePedeGradeRh, resumoDosHorarios, ROTULO_DA_CONTRATACAO,
} from "@/lib/prestacao/grade-rh";
import type { NoOrcamento } from "@/lib/prestacao/orcamento";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { pedirVerificacao } from "@/lib/prestacao/verificar-cliente";
import type { PrestacaoCargo, PrestacaoComprovante, PrestacaoFornecedor } from "@/lib/supabase/types";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const CABECALHO = "px-4 py-2 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40";
const ROTULO = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const VALOR = (n: number) => `font-semibold tabular-nums ${n ? "text-[#282525]" : "text-black/30"}`;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const juntar = (itens: readonly string[]) => (itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}` : itens[0] ?? "");

type DespesaDaGrade = Pick<PrestacaoComprovante, "id" | "tipo" | "no_id" | "fornecedor_id" | "status">;
type FornecedorDaGrade = Pick<PrestacaoFornecedor, "id" | "tipo_pessoa" | "nome" | "razao_social">;

/** Aviso em texto neutro com o ícone âmbar de alerta. */
function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-start gap-1 text-[0.625rem] text-black/50">
      <AlertTriangle size={12} strokeWidth={1.75} aria-label="Alerta" className="mt-px shrink-0 text-[#B07A14]" />
      <span>{children}</span>
    </span>
  );
}

export function GradeRh({ prestacaoId }: { prestacaoId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const podeEditar = usePermissoesPrestacao(prestacaoId).editar;
  const regimes = useRegimesPublicados();
  const { confirmDelete } = useDeleteConfirm();

  const [cargos, setCargos] = useState<PrestacaoCargo[]>([]);
  const [nos, setNos] = useState<NoOrcamento[]>([]);
  const [despesas, setDespesas] = useState<DespesaDaGrade[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorDaGrade[]>([]);
  const [regimeId, setRegimeId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [trazendo, setTrazendo] = useState(false);
  const [editando, setEditando] = useState<{ cargo: PrestacaoCargo | null } | null>(null);

  const buscar = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    const db = supabase as any;
    const [c, n, d, p] = await Promise.all([
      db.from("prestacao_cargos").select("*").eq("prestacao_id", prestacaoId).order("ordem").order("created_at"),
      db.from("prestacao_orcamento_nos").select("*, versao:prestacao_orcamento_versoes!inner(ativa)").eq("prestacao_id", prestacaoId).eq("versao.ativa", true).order("ordem"),
      db.from("prestacao_comprovantes").select("id, tipo, no_id, fornecedor_id, status").eq("prestacao_id", prestacaoId),
      db.from("prestacoes_contas").select("regime_id, organization_id").eq("id", prestacaoId).maybeSingle(),
    ]);
    const ids = [...new Set(((d.data ?? []) as DespesaDaGrade[]).map(x => x.fornecedor_id).filter(Boolean))];
    const f = ids.length && p.data?.organization_id
      ? await db.from("prestacao_fornecedores").select("id, tipo_pessoa, nome, razao_social").eq("organization_id", p.data.organization_id).in("id", ids)
      : { data: [], error: null };
    const falha = c.error ?? n.error ?? d.error ?? p.error ?? f.error;
    return {
      erro: falha ? mensagemErroPrestacao(falha, "Não foi possível carregar a grade de RH") : "",
      cargos: (c.data ?? []) as PrestacaoCargo[],
      nos: (n.data ?? []) as NoOrcamento[],
      despesas: (d.data ?? []) as DespesaDaGrade[],
      fornecedores: (f.data ?? []) as FornecedorDaGrade[],
      regimeId: (p.data?.regime_id ?? null) as string | null,
    };
  }, [prestacaoId, supabase]);

  const aplicar = useCallback((dados: Awaited<ReturnType<typeof buscar>>) => {
    setErro(dados.erro);
    setCargos(dados.cargos);
    setNos(dados.nos);
    setDespesas(dados.despesas);
    setFornecedores(dados.fornecedores);
    setRegimeId(dados.regimeId);
    setCarregando(false);
  }, []);

  useEffect(() => {
    let ativo = true;
    buscar().then(dados => { if (ativo) aplicar(dados); });
    return () => { ativo = false; };
  }, [aplicar, buscar]);

  const recarregar = useCallback(async () => aplicar(await buscar()), [aplicar, buscar]);

  const regime = regimes.find(r => r.id === regimeId)?.regime ?? null;
  const pede = regimePedeGradeRh(regime);
  const nomeDoNo = useMemo(() => new Map(nos.map(n => [n.id, n.nome])), [nos]);
  const itens: ItemParaCargo[] = useMemo(() => {
    const deRh = new Set(itensDeRh(nos, despesas).map(n => n.id));
    return nos.filter(n => n.tipo === "item").map(n => ({ id: n.id, nome: n.nome, deRh: deRh.has(n.id) }));
  }, [nos, despesas]);
  const sugeridos = useMemo(() => cargosSugeridos(nos, despesas, cargos), [nos, despesas, cargos]);
  // Os mesmos achados do motor (P2.7), por cargo.
  const achadosPorCargo = useMemo(() => {
    const achados = checarRecursosHumanos({
      regime, despesas: despesas as never, fornecedores: fornecedores as never, documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
      nos, cargos,
    });
    const mapa = new Map<string, Achado[]>();
    for (const a of achados) {
      const ref = a.chave.split(":")[3]?.split("|")[0];
      if (ref && a.codigo !== "RH_SEM_GRADE") mapa.set(ref, [...(mapa.get(ref) ?? []), a]);
    }
    return mapa;
  }, [regime, despesas, fornecedores, nos, cargos]);
  const contratados = cargos.reduce((s, c) => s + c.quantidade, 0);

  if (carregando || (!pede && cargos.length === 0)) return null;

  function salvou() {
    setEditando(null);
    recarregar();
    pedirVerificacao(prestacaoId);
  }

  async function trazerDoOrcamento() {
    setTrazendo(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
    const { error } = await (supabase as any).from("prestacao_cargos").insert(
      sugeridos.map((s, i) => ({ prestacao_id: prestacaoId, no_id: s.no_id, cargo: s.cargo, quantidade: s.quantidade, ordem: cargos.length + i })),
    );
    setTrazendo(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível trazer os cargos")); return; }
    await recarregar();
    pedirVerificacao(prestacaoId);
  }

  function excluir(c: PrestacaoCargo) {
    confirmDelete({
      title: "Excluir cargo?",
      description: `"${c.cargo}" sai da grade de RH.`,
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
        const { error } = await (supabase as any).from("prestacao_cargos").delete().eq("id", c.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir o cargo"));
        await recarregar();
        pedirVerificacao(prestacaoId);
      },
    });
  }

  const botaoIcone = "rounded p-2 text-black/35 transition hover:bg-black/5 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]";
  const botaoExcluir = "rounded p-2 text-black/25 transition hover:bg-black/[.04] hover:text-[#D94A4A] focus-visible:outline-2 focus-visible:outline-[#D94A4A]";
  const secundario = "flex h-9 shrink-0 items-center gap-1.5 rounded border bg-white px-3 text-[0.75rem] text-black/65 transition hover:border-black/25 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-40";
  const vazio = <span className="text-black/30">—</span>;

  const avisosDoCargo = (c: PrestacaoCargo) => {
    const faltas = faltasDoCargo(c);
    const divergente = cargaDivergente(c);
    const ilegiveis = cargaDosHorarios(c.horarios).ilegiveis;
    return [
      faltas.length ? `${faltas.length > 1 ? "Faltam" : "Falta"} ${juntar(faltas)}.` : null,
      ilegiveis.length ? `Não deu para somar o horário de ${juntar(ilegiveis.map(d => d.toLowerCase()))}.` : null,
      divergente ? `Os horários somam ${horasBr(divergente.somada)}; a carga diz ${horasBr(divergente.escrita)}.` : null,
      ...(achadosPorCargo.get(c.id) ?? []).map(a => a.mensagem),
    ].filter((x): x is string => Boolean(x));
  };

  const acoes = (c: PrestacaoCargo) => podeEditar && (
    <>
      <button type="button" onClick={() => setEditando({ cargo: c })} aria-label={`Editar ${c.cargo}`} className={botaoIcone}><Pencil size={13} /></button>
      <button type="button" onClick={() => excluir(c)} aria-label={`Excluir ${c.cargo}`} className={botaoExcluir}><Trash2 size={13} /></button>
    </>
  );

  const rotuloDoItem = (c: PrestacaoCargo) => {
    if (!c.no_id) return "Sem item do orçamento";
    const item = nomeDoNo.get(c.no_id);
    if (!item) return "Item de outra versão do orçamento";
    return item.trim() === c.cargo.trim() ? "Ligado ao item do orçamento" : `Item: ${item}`;
  };

  const pagos = (c: PrestacaoCargo) => (c.no_id ? pagosDoCargo(c, despesas, fornecedores).length : null);

  return (
    <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby="grade-rh-titulo">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <div className="min-w-0">
          <h3 id="grade-rh-titulo" className="text-[0.75rem] font-semibold text-[#282525]">Grade de RH</h3>
          <p className="max-w-[40rem] text-[0.6875rem] text-black/45">
            Os cargos da equipe, com o horário de cada dia, a carga semanal e a forma de contratação. Vai na PCP no modelo de grade horária dos recursos humanos, baixado na aba Envio, no formulário PCP/PCF.
          </p>
        </div>
        {podeEditar && (
          <div className="flex flex-wrap items-center gap-2">
            {sugeridos.length > 0 && (
              <button type="button" onClick={trazerDoOrcamento} disabled={trazendo} className={secundario} style={{ borderColor: "rgba(13,13,13,.14)" }}>
                <Download size={13} aria-hidden /> Trazer do orçamento ({sugeridos.length})
              </button>
            )}
            <button type="button" onClick={() => setEditando({ cargo: null })} className={secundario} style={{ borderColor: "rgba(13,13,13,.14)" }}>
              <Plus size={13} aria-hidden /> Novo cargo
            </button>
          </div>
        )}
      </div>

      {erro && <p role="alert" className="mx-5 mt-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "rgba(178,59,59,.35)" }}>{erro}</p>}

      {cargos.length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 border-b px-5 py-2.5 text-[0.6875rem]" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Cargos</dt><dd className={VALOR(cargos.length)}>{cargos.length}</dd></div>
          <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Contratados</dt><dd className={VALOR(contratados)}>{contratados}</dd></div>
          {sugeridos.length > 0 && (
            <div className="flex items-center gap-1.5">
              <dt className={`${ROTULO} inline-flex items-center gap-1`}>
                <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />
                Itens de RH sem cargo
              </dt>
              <dd className={VALOR(sugeridos.length)}>{sugeridos.length}</dd>
            </div>
          )}
        </dl>
      )}

      {cargos.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <Briefcase size={22} className="mx-auto text-black/20" aria-hidden />
          <p className="mt-2 text-[0.75rem] text-black/55">Nenhum cargo na grade de RH.</p>
          <p className="mx-auto max-w-[32rem] text-[0.6875rem] text-black/35">
            {sugeridos.length
              ? `O orçamento tem ${plural(sugeridos.length, "item", "itens")} de recursos humanos: traga do orçamento e complete os horários e a forma de contratação.`
              : "Adicione cada cargo da equipe, com o item do orçamento que o paga, os horários e a forma de contratação."}
          </p>
        </div>
      ) : (
        <>
          {/* Computador: tabela */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[56rem] table-fixed text-[0.75rem]">
              <colgroup>
                <col />
                <col className="w-[5.5rem]" />
                <col className="w-[5rem]" />
                <col className="w-[17rem]" />
                <col className="w-[5.5rem]" />
                <col className="w-[5rem]" />
                {podeEditar && <col className="w-[5.5rem]" />}
              </colgroup>
              <thead>
                <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                  <th className={CABECALHO}>Cargo</th>
                  <th className={CABECALHO}>Contratação</th>
                  <th className={`${CABECALHO} text-right`}>Qtde.</th>
                  <th className={CABECALHO}>Horários</th>
                  <th className={`${CABECALHO} text-right`}>Carga</th>
                  <th className={`${CABECALHO} text-right`} title="Pessoas pagas pelo item do orçamento">Pagos</th>
                  {podeEditar && <th className={CABECALHO}><span className="sr-only">Ações</span></th>}
                </tr>
              </thead>
              <tbody>
                {cargos.map(c => {
                  const avisos = avisosDoCargo(c);
                  const carga = numeroDaCarga(c.carga_semanal);
                  const n = pagos(c);
                  return (
                    <tr key={c.id} className="border-b align-top transition last:border-0 hover:bg-black/[.02]" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                      <td className="px-4 py-2.5">
                        <p className="text-black/80">{c.cargo}</p>
                        <p className="text-[0.625rem] text-black/40">{rotuloDoItem(c)}</p>
                        {avisos.length > 0 && <div className="mt-1 space-y-0.5">{avisos.map(a => <Aviso key={a}>{a}</Aviso>)}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-[0.6875rem] text-black/60">{c.contratacao ? ROTULO_DA_CONTRATACAO[c.contratacao] : vazio}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-black/60">{c.quantidade}</td>
                      <td className="px-4 py-2.5 text-[0.6875rem] tabular-nums text-black/60">{resumoDosHorarios(c.horarios) || vazio}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right text-[0.6875rem] tabular-nums text-black/60">{carga === null ? vazio : horasBr(carga)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-black/60">{n === null ? vazio : n}</td>
                      {podeEditar && <td className="whitespace-nowrap px-2 py-1.5 text-right">{acoes(c)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Celular: cartões */}
          <ul className="divide-y divide-black/[.05] md:hidden">
            {cargos.map(c => {
              const avisos = avisosDoCargo(c);
              const carga = numeroDaCarga(c.carga_semanal);
              const n = pagos(c);
              return (
                <li key={c.id} className="space-y-1 px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[0.75rem] text-black/80">{c.cargo}</p>
                      <p className="text-[0.625rem] text-black/45">
                        {[c.contratacao ? ROTULO_DA_CONTRATACAO[c.contratacao] : null, plural(c.quantidade, "contratado", "contratados"), carga !== null ? `${horasBr(carga)} por semana` : null, n !== null ? `${n} pago${n === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {podeEditar && <div className="flex shrink-0 items-center">{acoes(c)}</div>}
                  </div>
                  {resumoDosHorarios(c.horarios) && <p className="text-[0.6875rem] tabular-nums text-black/60">{resumoDosHorarios(c.horarios)}</p>}
                  {avisos.map(a => <Aviso key={a}>{a}</Aviso>)}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {editando && (
        <CargoModal
          prestacaoId={prestacaoId}
          cargo={editando.cargo}
          itens={itens}
          ordem={cargos.length}
          onClose={() => setEditando(null)}
          onSaved={salvou}
        />
      )}
    </section>
  );
}
