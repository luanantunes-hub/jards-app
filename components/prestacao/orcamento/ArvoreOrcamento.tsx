"use client";

import { AlertTriangle, ChevronRight, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import {
  percentualPago,
  rotuloGrupo,
  rotuloTipoNo,
  type LinhaOrcamento,
  type NoOrcamento,
  type Totais,
} from "@/lib/prestacao/orcamento";
import { formatarCodigoCnae } from "@/lib/prestacao/cnae";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtSinal = (v: number) => (v > 0 ? `+${fmt(v)}` : fmt(v));

const CABECALHO = "px-3 py-2.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35 whitespace-nowrap";
const NUMERO = "px-3 py-2.5 text-right text-[0.75rem] tabular-nums whitespace-nowrap";
// Em telas estreitas ficam vigente, pago, saldo e %; aprovado, remanejado e comprometido aparecem a partir de md.
const SO_MD = "hidden md:table-cell";

function CelulaPercentual({ totais }: { totais: Totais }) {
  const percentual = percentualPago(totais);
  if (percentual === null) return <span className="text-black/25">—</span>;
  const cor = percentual > 100 ? "#D94A4A" : percentual >= 80 ? "#2E8932" : "rgba(13,13,13,.45)";
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-black/[.07] sm:block" aria-hidden>
        <span className="block h-full rounded-full" style={{ width: `${Math.min(percentual, 100)}%`, background: cor }} />
      </span>
      {percentual > 100 && <AlertTriangle size={12} strokeWidth={1.75} role="img" aria-label="Acima do vigente" className="shrink-0 text-[#D94A4A]" />}
      <span className={`text-[0.6875rem] tabular-nums ${percentual === 0 ? "text-black/30" : "text-black/70"}`}>{percentual}%</span>
    </span>
  );
}

function Valores({ totais, forte }: { totais: Totais; forte?: boolean }) {
  const peso = forte ? "font-semibold" : "";
  return (
    <>
      <td className={`${NUMERO} ${SO_MD} text-black/55 ${peso}`}>{fmt(totais.aprovado)}</td>
      <td className={`${NUMERO} ${SO_MD} ${totais.remanejado === 0 ? "text-black/25" : "text-black/55"} ${peso}`}>
        {totais.remanejado === 0 ? "—" : fmtSinal(totais.remanejado)}
      </td>
      <td className={`${NUMERO} text-black/80 ${forte ? "font-semibold" : "font-medium"}`}>{fmt(totais.vigente)}</td>
      <td className={`${NUMERO} ${SO_MD} ${totais.comprometido ? "text-black/55" : "text-black/25"} ${peso}`}>
        {totais.comprometido ? fmt(totais.comprometido) : "—"}
      </td>
      <td className={`${NUMERO} ${totais.pago ? "text-black/70" : "text-black/25"} ${peso}`}>{totais.pago ? fmt(totais.pago) : "—"}</td>
      <td className={`${NUMERO} ${peso}`}>
        {totais.saldo < 0 ? (
          <span className="inline-flex items-center gap-1 text-[#0D0D0D]" title="Comprometido e pago passam do vigente">
            <AlertTriangle size={12} strokeWidth={1.75} role="img" aria-label="Saldo negativo" className="shrink-0 text-[#D94A4A]" />
            {fmt(totais.saldo)}
          </span>
        ) : (
          <span className="text-black/60">{fmt(totais.saldo)}</span>
        )}
      </td>
      <td className={`${NUMERO}`}><CelulaPercentual totais={totais} /></td>
    </>
  );
}

const BOTAO_ICONE = "rounded p-1.5 text-black/30 transition hover:bg-black/5 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]";

/**
 * Árvore do orçamento com as colunas do estudo (aprovado, remanejado,
 * vigente, comprometido, pago, saldo, % pago). Agrupadores mostram a soma do
 * que está dentro e podem ser recolhidos.
 */
export function ArvoreOrcamento({ linhas, fechados, onAlternar, total, podeEditar, onEditar, onAdicionarDentro, onExcluir, regime = null }: {
  linhas: LinhaOrcamento[];
  /** Regime da prestação, para o nome dos grupos de custo. */
  regime?: RegimeNormativo | null;
  fechados: ReadonlySet<string>;
  onAlternar: (id: string) => void;
  total: Totais;
  podeEditar: boolean;
  onEditar: (no: NoOrcamento) => void;
  onAdicionarDentro: (no: NoOrcamento) => void;
  onExcluir: (linha: LinhaOrcamento) => void;
}) {
  return (
    // relative: o rótulo "Ações" (sr-only, posição absoluta) fica preso à rolagem da tabela.
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse md:min-w-[60rem]">
        <thead>
          <tr className="border-b bg-[#F9F9F8]" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <th scope="col" className={`${CABECALHO} text-left`}>Item</th>
            <th scope="col" className={`${CABECALHO} ${SO_MD} text-right`}>Aprovado</th>
            <th scope="col" className={`${CABECALHO} ${SO_MD} text-right`}>Remanejado</th>
            <th scope="col" className={`${CABECALHO} text-right`}>Vigente</th>
            <th scope="col" className={`${CABECALHO} ${SO_MD} text-right`} title="Despesas ainda sem pagamento conciliado com o extrato">Comprometido</th>
            <th scope="col" className={`${CABECALHO} text-right`} title="Pagamentos conciliados com o extrato">Pago</th>
            <th scope="col" className={`${CABECALHO} text-right`}>Saldo</th>
            <th scope="col" className={`${CABECALHO} text-right`}>% pago</th>
            {podeEditar && <th scope="col" className={CABECALHO}><span className="sr-only">Ações</span></th>}
          </tr>
        </thead>
        <tbody>
          {linhas.map(linha => {
            const { no } = linha;
            const agrupador = no.tipo !== "item";
            const aberto = !fechados.has(no.id);
            const recuo = { paddingLeft: `${0.75 + linha.nivel * 1.25}rem` };
            return (
              <tr
                key={no.id}
                className={`border-b transition-colors hover:bg-black/[.015] ${agrupador ? "bg-black/[.012]" : ""}`}
                style={{ borderColor: "rgba(13,13,13,.05)" }}
              >
                <td className="min-w-[14rem] max-w-[26rem] py-2.5 pr-3" style={recuo}>
                  <div className="flex items-start gap-1.5">
                    {agrupador ? (
                      <button
                        type="button"
                        onClick={() => onAlternar(no.id)}
                        aria-expanded={aberto}
                        aria-label={`${aberto ? "Recolher" : "Expandir"} ${no.nome}`}
                        disabled={linha.filhos.length === 0}
                        className="-ml-1 mt-px rounded p-0.5 text-black/35 transition hover:bg-black/5 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-30"
                      >
                        <ChevronRight size={13} className={`transition-transform duration-200 motion-reduce:transition-none ${aberto ? "rotate-90" : ""}`} />
                      </button>
                    ) : (
                      <span className="w-[1.125rem] shrink-0" aria-hidden />
                    )}
                    <div className="min-w-0">
                      {agrupador && (
                        <p className="text-[0.5625rem] font-medium uppercase tracking-[.08em] text-black/35">
                          {rotuloTipoNo(no.tipo)}{no.codigo ? ` · ${no.codigo}` : ""}
                        </p>
                      )}
                      <p className={`text-[0.75rem] ${agrupador ? "font-semibold text-black/80" : "text-black/80"}`}>
                        {!agrupador && no.codigo && <span className="mr-1.5 text-black/35 tabular-nums">{no.codigo}</span>}
                        {no.nome}
                      </p>
                      {!agrupador && (no.descricao || linha.grupo || linha.cnaes.length > 0 || no.uf || no.municipio) && (
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.625rem] text-black/40">
                          {linha.grupo && (
                            <span className={linha.grupoHerdado ? "text-black/35" : "text-black/60"} title={linha.grupoHerdado ? "Grupo herdado do agrupador" : "Grupo de custo do item"}>
                              {rotuloGrupo(linha.grupo, regime)}
                            </span>
                          )}
                          {linha.cnaes.length > 0 && (
                            <span className="tabular-nums" title={linha.cnaesDe && linha.cnaesDe.id !== no.id ? `CNAEs aceitos, herdados de ${linha.cnaesDe.nome}` : "CNAEs aceitos pelo item"}>
                              CNAE {linha.cnaes.map(formatarCodigoCnae).join(", ")}
                            </span>
                          )}
                          {(no.uf || no.municipio) && (
                            <span className="inline-flex items-center gap-0.5"><MapPin size={9} aria-hidden />{[no.municipio, no.uf].filter(Boolean).join("/")}</span>
                          )}
                          {no.descricao && <span className="max-w-[18rem] truncate" title={no.descricao}>{no.descricao}</span>}
                        </div>
                      )}
                      {agrupador && no.grupo_custo && (
                        <p className="mt-0.5 text-[0.625rem] text-black/45">{rotuloGrupo(no.grupo_custo, regime)} para os itens dentro</p>
                      )}
                      {agrupador && linha.cnaesDe?.id === no.id && (
                        <p className="mt-0.5 text-[0.625rem] tabular-nums text-black/45">CNAE {linha.cnaes.map(formatarCodigoCnae).join(", ")} para os itens dentro</p>
                      )}
                    </div>
                  </div>
                </td>
                <Valores totais={linha.totais} forte={agrupador} />
                {podeEditar && (
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    {agrupador && (
                      <button type="button" onClick={() => onAdicionarDentro(no)} aria-label={`Adicionar item em ${no.nome}`} title="Adicionar dentro" className={BOTAO_ICONE}>
                        <Plus size={13} />
                      </button>
                    )}
                    <button type="button" onClick={() => onEditar(no)} aria-label={`Editar ${no.nome}`} title="Editar" className={BOTAO_ICONE}>
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onExcluir(linha)}
                      aria-label={`Excluir ${no.nome}`}
                      title="Excluir"
                      className="rounded p-1.5 text-black/25 transition hover:bg-black/[.04] hover:text-[#D94A4A] focus-visible:outline-2 focus-visible:outline-[#D94A4A]"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 bg-[#F9F9F8]" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <th scope="row" className="px-3 py-2.5 text-left text-[0.6875rem] font-semibold text-black/55">
              Total · {total.itens} {total.itens === 1 ? "item" : "itens"}
            </th>
            <Valores totais={total} forte />
            {podeEditar && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
