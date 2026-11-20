"use client";

import { Ticket } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";

// A tela do produtor (passo C3 da T5): as vendas da loja. Só desenho: os dados e as ações chegam por props (a página busca no banco e no servidor).
// Segue o DESIGN.md: rótulos pequenos em caixa alta, valores em tinta e tabulares, etiquetas de borda leve, sem cor fora de estado e de gráfico.

const BORDA = "rgba(13,13,13,.08)";

// A superfície das tabelas e o estado vazio, iguais aos de ListPagePrimitives (que puxa a fonte do título e não roda fora do Next, nem nos testes das telas).
function ListTableSurface({ children }: { children: React.ReactNode }) { return <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>{children}</div>; }
function ListEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-20 text-center">
      <Ticket size={28} className="mb-3 text-black/15" aria-hidden="true" />
      <p className="text-[0.875rem] font-medium text-black/55">{title}</p>
      <p className="mt-1.5 max-w-sm text-[0.75rem] leading-relaxed text-black/35">{description}</p>
    </div>
  );
}
const ROTULO = "text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45";
const CELULA = "px-4 py-3 text-[0.8125rem] text-[#282525]";
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const LINK = "rounded-xl text-[0.8125rem] text-black/55 underline-offset-2 transition hover:text-black/75 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const CANCELAR = "rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

export type ResumoDasVendas = {
  vendido_centavos: number; ingressos: number; compras: number;
  /** O que sobra ao produtor das vendas pagas: o preço menos a taxa do Jards e o custo do Pix. */
  repasse_centavos: number;
  /** O que já pode sacar agora (vendas liberadas, menos o que já sacou). */
  liberado_centavos: number;
  /** O que ainda está retido até depois do evento. */
  retido_centavos: number;
};

export type SituacaoDaSessao = "a_venda" | "esgotada" | "encerrada" | "cancelada";
export type SessaoDeVendas = { id: string; evento: string; quando: string; vendidos: number; lugares: number; receita_centavos: number; situacao: SituacaoDaSessao };

export type SituacaoDaCompra = "pago" | "aguardando_pagamento" | "cancelado";
export type CompraDaLista = { id: string; codigo: string; comprador: string; email: string; evento: string; quando: string; quantidade: number; valor_centavos: number; situacao: SituacaoDaCompra; pago_em: string | null };

const ETIQUETA_DA_SESSAO: Record<SituacaoDaSessao, { texto: string; cor: string }> = {
  a_venda: { texto: "À VENDA", cor: "#2E8932" }, esgotada: { texto: "ESGOTADA", cor: "#B07A14" }, encerrada: { texto: "ENCERRADA", cor: "#6b6767" }, cancelada: { texto: "CANCELADA", cor: "#D94A4A" },
};
const ETIQUETA_DA_COMPRA: Record<SituacaoDaCompra, { texto: string; cor: string }> = {
  pago: { texto: "PAGO", cor: "#2E8932" }, aguardando_pagamento: { texto: "AGUARDANDO", cor: "#B07A14" }, cancelado: { texto: "CANCELADO", cor: "#6b6767" },
};

function Etiqueta({ texto, cor }: { texto: string; cor: string }) {
  return <span className="inline-flex shrink-0 rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal" style={{ borderColor: cor + "47", color: cor }}>{texto}</span>;
}

function Indicador({ rotulo, valor, apoio }: { rotulo: string; valor: number; apoio: string }) {
  return (
    <div className="min-w-0">
      <p className={ROTULO}>{rotulo}</p>
      <p className={`mt-1.5 text-[1.5rem] font-medium tabular-nums tracking-[-.02em] ${valor === 0 ? "text-black/30" : "text-[#282525]"}`}>{formatarMoeda(valor)}</p>
      <p className="mt-1 text-[0.6875rem] leading-snug text-black/45">{apoio}</p>
    </div>
  );
}

const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

export function ResumoDeVendas({ resumo }: { resumo: ResumoDasVendas }) {
  return (
    <section aria-label="Resumo das vendas" className="rounded-xl border bg-white px-5 py-5" style={{ borderColor: BORDA }}>
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador rotulo="Vendido" valor={resumo.vendido_centavos} apoio={`${plural(resumo.ingressos, "ingresso", "ingressos")} em ${plural(resumo.compras, "compra", "compras")}`} />
        <Indicador rotulo="Seu repasse" valor={resumo.repasse_centavos} apoio="Já descontadas a taxa do Jards e o custo do Pix" />
        <Indicador rotulo="Liberado para saque" valor={resumo.liberado_centavos} apoio="Você pode sacar agora" />
        <Indicador rotulo="Retido" valor={resumo.retido_centavos} apoio="Liberado às 18h do dia seguinte ao evento" />
      </div>
    </section>
  );
}

export function SessoesDeVendas({ sessoes }: { sessoes: SessaoDeVendas[] }) {
  return (
    <section aria-label="Vendas por sessão">
      <h2 className={`mb-2 ${ROTULO}`}>Por sessão</h2>
      <ListTableSurface>
        <table className="w-full min-w-[40rem] border-collapse">
          <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Sessão</th><th className={CABECALHO}>Vendidos</th><th className={`${CABECALHO} text-right`}>Receita</th><th className={CABECALHO}><span className="sr-only">Situação</span></th></tr></thead>
          <tbody className="divide-y divide-black/[.08]">
            {sessoes.map(s => {
              const pct = s.lugares > 0 ? Math.min(100, Math.round((s.vendidos / s.lugares) * 100)) : 0;
              const etiqueta = ETIQUETA_DA_SESSAO[s.situacao];
              return (
                <tr key={s.id}>
                  <td className={CELULA}><p className="font-normal">{s.evento}</p><p className="text-[0.6875rem] text-black/45">{s.quando}</p></td>
                  <td className={CELULA}>
                    <p className="tabular-nums">{s.vendidos.toLocaleString("pt-BR")} <span className="text-black/45">de {s.lugares.toLocaleString("pt-BR")}</span></p>
                    <div className="mt-1.5 h-1 w-32 overflow-hidden rounded-full bg-black/[.08]" role="img" aria-label={`${pct}% dos lugares vendidos`}><div className="h-full rounded-full bg-[#3DA86A]" style={{ width: `${pct}%` }} /></div>
                  </td>
                  <td className={`${CELULA} text-right tabular-nums ${s.receita_centavos === 0 ? "text-black/30" : ""}`}>{formatarMoeda(s.receita_centavos)}</td>
                  <td className={`${CELULA} text-right`}><Etiqueta {...etiqueta} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ListTableSurface>
    </section>
  );
}

export type FiltroDasCompras = "todas" | "pagas" | "aguardando";
const FILTROS: [FiltroDasCompras, string][] = [["todas", "Todas"], ["pagas", "Pagas"], ["aguardando", "Aguardando"]];

export function ComprasDeVendas({ compras, filtro, onFiltrar, onAbrir }: { compras: CompraDaLista[]; filtro: FiltroDasCompras; onFiltrar?: (f: FiltroDasCompras) => void; onAbrir?: (id: string) => void }) {
  return (
    <section aria-label="Compras">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className={ROTULO}>Compras</h2>
        <div className="flex gap-2" role="group" aria-label="Filtrar compras">
          {FILTROS.map(([id, rotulo]) => (
            <button key={id} type="button" aria-pressed={filtro === id} onClick={() => onFiltrar?.(id)} className={`h-8 rounded-xl border px-3 text-[0.75rem] font-normal transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${filtro === id ? "border-[#7259B5]/40 text-[#7259B5]" : "border-black/[.12] text-black/55 hover:bg-black/[.04]"}`}>{rotulo}</button>
          ))}
        </div>
      </div>
      <ListTableSurface>
        {compras.length === 0 ? (
          <ListEmptyState title="Nenhuma compra aqui" description="As compras aparecem assim que alguém reservar ou pagar um ingresso." />
        ) : (
          <table className="w-full min-w-[46rem] border-collapse">
            <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Compra</th><th className={CABECALHO}>Comprador</th><th className={CABECALHO}>Sessão</th><th className={`${CABECALHO} text-right`}>Ingressos</th><th className={`${CABECALHO} text-right`}>Valor</th><th className={CABECALHO}><span className="sr-only">Situação</span></th></tr></thead>
            <tbody className="divide-y divide-black/[.08]">
              {compras.map(c => (
                <tr key={c.id} className="transition hover:bg-black/[.02]">
                  <td className={CELULA}><button type="button" onClick={() => onAbrir?.(c.id)} className="rounded-xl font-normal tabular-nums tracking-[.04em] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{c.codigo}</button><p className="text-[0.6875rem] text-black/45">{c.pago_em ?? "Ainda não pago"}</p></td>
                  <td className={CELULA}><p>{c.comprador}</p><p className="text-[0.6875rem] text-black/45">{c.email}</p></td>
                  <td className={CELULA}><p>{c.evento}</p><p className="text-[0.6875rem] text-black/45">{c.quando}</p></td>
                  <td className={`${CELULA} text-right tabular-nums`}>{c.quantidade}</td>
                  <td className={`${CELULA} text-right tabular-nums`}>{formatarMoeda(c.valor_centavos)}</td>
                  <td className={`${CELULA} text-right`}><Etiqueta {...ETIQUETA_DA_COMPRA[c.situacao]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ListTableSurface>
    </section>
  );
}

export type DetalheDaCompra = {
  codigo: string; comprador: string; email: string; evento: string; quando: string; situacao: SituacaoDaCompra; pago_em: string | null;
  ingressos: { codigo: string; nome: string; assento?: string | null; usado: boolean; cancelado: boolean }[];
  total_centavos: number; taxa_centavos: number; custo_do_pix_centavos: number | null; repasse_centavos: number;
  endereco_do_pedido: string;
};

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="flex items-baseline justify-between gap-4 py-1.5 text-[0.8125rem]"><dt className="text-black/55">{rotulo}</dt><dd className="tabular-nums text-[#282525]">{valor}</dd></div>;
}

/** Os detalhes de uma compra, na folha que desce do topo: quem comprou, os ingressos com o código de cada um e de onde vem o valor do repasse. */
export function DetalheDaCompraSheet({ compra, onClose }: { compra: DetalheDaCompra; onClose: () => void }) {
  return (
    <TopSheet titulo={`Compra ${compra.codigo}`} etiqueta={compra.evento} onClose={onClose} footer={fechar => (
      <>
        <a href={compra.endereco_do_pedido} target="_blank" rel="noopener noreferrer" className={`mr-auto ${LINK}`}>Ver a página do pedido</a>
        <button type="button" onClick={fechar} className={CANCELAR}>Fechar</button>
      </>
    )}>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0"><p className="text-[0.9375rem] font-normal text-[#282525]">{compra.comprador}</p><p className="truncate text-[0.75rem] text-black/50">{compra.email}</p><p className="mt-1 text-[0.75rem] text-black/50">{compra.quando}</p></div>
          <Etiqueta {...ETIQUETA_DA_COMPRA[compra.situacao]} />
        </div>
        {compra.ingressos.length > 0 && (
          <div>
            <p className={`mb-1.5 ${ROTULO}`}>Ingressos</p>
            <ul className="divide-y divide-black/[.08] rounded-xl border" style={{ borderColor: BORDA }}>
              {compra.ingressos.map(i => (
                <li key={i.codigo} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[0.8125rem]">
                  <span className="min-w-0">{i.nome}{i.assento && <span className="block text-[0.75rem] text-black/50">{i.assento}</span>}</span>
                  <span className="flex items-center gap-2"><span className="font-normal tabular-nums tracking-[.08em]">{i.codigo}</span>{i.cancelado ? <Etiqueta texto="CANCELADO" cor="#6b6767" /> : i.usado ? <Etiqueta texto="USADO" cor="#6b6767" /> : null}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <p className={`mb-1 ${ROTULO}`}>Valores</p>
          <dl className="divide-y divide-black/[.08]">
            <Linha rotulo="Pago pelo comprador" valor={formatarMoeda(compra.total_centavos)} />
            <Linha rotulo="Taxa do Jards" valor={`− ${formatarMoeda(compra.taxa_centavos)}`} />
            <Linha rotulo="Custo do Pix" valor={compra.custo_do_pix_centavos == null ? "—" : `− ${formatarMoeda(compra.custo_do_pix_centavos)}`} />
            <div className="flex items-baseline justify-between gap-4 border-t py-2 text-[0.9375rem] font-medium" style={{ borderColor: BORDA }}><dt>Seu repasse</dt><dd className="tabular-nums">{formatarMoeda(compra.repasse_centavos)}</dd></div>
          </dl>
          {compra.pago_em && <p className="mt-1 text-[0.6875rem] text-black/45">Pago em {compra.pago_em}.</p>}
        </div>
      </div>
    </TopSheet>
  );
}

export type SituacaoDoReembolso = "estornado" | "estornando" | "falhou" | "fora_do_prazo" | "remetente_diferente" | "nao_elegivel" | "ja_reembolsado";
export type ReembolsoDaLista = { id: string; codigo: string; remetente: string; recebido: string; situacao: SituacaoDoReembolso; motivo: string | null; valor_centavos: number | null };

const ETIQUETA_DO_REEMBOLSO: Record<SituacaoDoReembolso, { texto: string; cor: string }> = {
  estornado: { texto: "REEMBOLSADO", cor: "#2E8932" }, estornando: { texto: "ESTORNANDO", cor: "#B07A14" }, falhou: { texto: "FALHOU", cor: "#D94A4A" },
  fora_do_prazo: { texto: "FORA DO PRAZO", cor: "#6b6767" }, remetente_diferente: { texto: "E-MAIL DIFERENTE", cor: "#6b6767" }, nao_elegivel: { texto: "EM ANÁLISE", cor: "#B07A14" }, ja_reembolsado: { texto: "JÁ REEMBOLSADO", cor: "#6b6767" },
};
const FRASE_DO_REEMBOLSO: Record<SituacaoDoReembolso, string> = {
  estornado: "O Pix foi devolvido ao comprador.", estornando: "O estorno começou e ainda não terminou. Se passar de alguns minutos, fale com o suporte do Jards.", falhou: "O Asaas não conseguiu estornar. Você pode tentar de novo.",
  fora_do_prazo: "Passaram mais de 7 dias da compra. O comprador recebeu a resposta de que não há devolução por desistência.", remetente_diferente: "O e-mail não veio do endereço da compra. O comprador recebeu o pedido de escrever do e-mail certo.",
  nao_elegivel: "Precisa de uma análise do Jards (por exemplo, um ingresso já usado na entrada).", ja_reembolsado: "O pedido já tinha sido reembolsado.",
};

/** Os pedidos de reembolso por e-mail dos pedidos desta loja: o que foi devolvido e o que não foi, com o motivo. O que falhou pode ser tentado de novo (dentro do prazo de 7 dias da compra). */
export function ReembolsosDeVendas({ reembolsos, onTentarDeNovo, tentando }: { reembolsos: ReembolsoDaLista[]; onTentarDeNovo?: (id: string) => void; tentando?: string | null }) {
  return (
    <section aria-label="Reembolsos">
      <h2 className={`mb-2 ${ROTULO}`}>Reembolsos</h2>
      <ListTableSurface>
        <table className="w-full min-w-[40rem] border-collapse">
          <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Pedido</th><th className={CABECALHO}>Pedido de reembolso</th><th className={`${CABECALHO} text-right`}>Valor</th><th className={CABECALHO}><span className="sr-only">Situação</span></th></tr></thead>
          <tbody className="divide-y divide-black/[.08]">
            {reembolsos.map(r => (
              <tr key={r.id}>
                <td className={CELULA}><p className="font-normal tabular-nums tracking-[.04em]">{r.codigo}</p><p className="text-[0.6875rem] text-black/45">{r.recebido}</p></td>
                <td className={CELULA}>
                  <p className="text-[0.8125rem]">{r.remetente}</p>
                  <p className="mt-0.5 max-w-md text-[0.6875rem] leading-snug text-black/50">{FRASE_DO_REEMBOLSO[r.situacao]}</p>
                  {r.situacao === "falhou" && onTentarDeNovo && <button type="button" onClick={() => onTentarDeNovo(r.id)} disabled={tentando === r.id} className={`mt-1.5 ${LINK}`}>{tentando === r.id ? "Tentando…" : "Tentar de novo"}</button>}
                </td>
                <td className={`${CELULA} text-right tabular-nums ${r.valor_centavos == null ? "text-black/30" : ""}`}>{r.valor_centavos == null ? "—" : formatarMoeda(r.valor_centavos)}</td>
                <td className={`${CELULA} text-right`}><Etiqueta {...ETIQUETA_DO_REEMBOLSO[r.situacao]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListTableSurface>
    </section>
  );
}

/** A página inteira, sem o cabeçalho (que é da página): resumo, sessões e compras. Sem venda nenhuma, o convite. */
export function VendasView({ resumo, sessoes, compras, filtro, onFiltrar, onAbrir, reembolsos = [], onTentarDeNovo, tentando }: { resumo: ResumoDasVendas; sessoes: SessaoDeVendas[]; compras: CompraDaLista[]; filtro: FiltroDasCompras; onFiltrar?: (f: FiltroDasCompras) => void; onAbrir?: (id: string) => void; reembolsos?: ReembolsoDaLista[]; onTentarDeNovo?: (id: string) => void; tentando?: string | null }) {
  return (
    <div className="space-y-6">
      <ResumoDeVendas resumo={resumo} />
      {sessoes.length > 0 && <SessoesDeVendas sessoes={sessoes} />}
      {reembolsos.length > 0 && <ReembolsosDeVendas reembolsos={reembolsos} onTentarDeNovo={onTentarDeNovo} tentando={tentando} />}
      <ComprasDeVendas compras={compras} filtro={filtro} onFiltrar={onFiltrar} onAbrir={onAbrir} />
    </div>
  );
}
