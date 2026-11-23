"use client";

import { Check } from "lucide-react";
import { SEMANAS_IDEAIS, rotuloDoCanalDeGasto, type Confianca, type ProntidaoDoModelo, type Verificacao } from "@/lib/ticketeria/modelo";
import type { ResultadoParaATela } from "@/lib/ticketeria/modelo-servidor";
import { SEMANAS_DOS_CONTROLES_EXTRAS, type ControleDaTela } from "@/lib/ticketeria/modelo-controles";
import { FATOR_DE_CAUTELA, margemMostrada, temMargemGrande, type CanalDoResultado, type ChaveDaParte } from "@/lib/ticketeria/modelo-resultado";
import { canaisComCurva, linhasDeInvestimento, recomendar } from "@/lib/ticketeria/modelo-recomendacao";
import { confiancaMostrada, fatoresDaConfianca, oQueAConfiancaPermite } from "@/lib/ticketeria/modelo-confianca";
import { blocoDeInvestir, blocoDoTamanhoDosCanais } from "@/lib/ticketeria/modelo-painel";
import { PreviaComExemplo, SeloDePrecisao } from "@/components/ticketeria/PainelView";
import { PreviaDoCalendario } from "@/components/ticketeria/CalendarioDeDivulgacaoView";
import { faltaAtraso } from "@/lib/ticketeria/modelo-calendario";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";

// A aba Modelo da Divulgação (fatia M-A): se já há dado para o modelo de marketing rodar, e o que falta. Ainda não há o cálculo do modelo (é a fatia seguinte). Só desenho: os dados
// e as ações chegam por props. Segue o DESIGN.md da Ticketeria: rótulos pequenos, cantos de 12px, cor só de estado.

const BORDA = "rgba(13,13,13,.08)";
const VERDE = "#2E8932";
const AMBAR = "#B07A14";
const LINK = "rounded-xl text-[0.75rem] text-[#7259B5] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const ROTULO_CONFIANCA: Record<Confianca, string> = { baixa: "baixa", media: "média", boa: "boa" };

function Marca({ estado }: { estado: Verificacao["estado"] }) {
  if (estado === "ok") return <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: VERDE }} aria-label="Pronto"><Check size={12} aria-hidden="true" /></span>;
  if (estado === "atencao") return <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] text-white" style={{ background: AMBAR }} aria-label="Falta um pouco">!</span>;
  return <span className="mt-0.5 size-5 shrink-0 rounded-full border-[1.5px]" style={{ borderColor: "rgba(13,13,13,.25)" }} aria-label={estado === "falta" ? "Falta" : "Opcional"} />;
}

/** A checklist de prontidão: o aviso (pronto ou não, com o progresso) e cada verificação, com o botão que leva ao que resolve. */
export function ModeloDaLoja({ prontidao, onImportar, onConexoes, onDatas }: { prontidao: ProntidaoDoModelo; onImportar?: () => void; onConexoes?: () => void; onDatas?: () => void }) {
  const { pronto, prontos, total, confianca, semanas, verificacoes, ignoradas } = prontidao;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border px-4 py-3.5" style={{ borderColor: "rgba(176,122,20,.25)", background: "#FFFBF2" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {pronto ? (
            <p className="max-w-3xl text-[0.8125rem] text-black/60"><span className="text-[#282525]">Os dados estão prontos.</span> Com eles o modelo teria confiança {confianca ? ROTULO_CONFIANCA[confianca] : "baixa"} ({semanas} {semanas === 1 ? "semana" : "semanas"} com vendas e gasto; o ideal são {SEMANAS_IDEAIS}). O cálculo do modelo chega na próxima etapa.</p>
          ) : (
            <p className="max-w-3xl text-[0.8125rem] text-black/60"><span className="text-[#282525]">O modelo ainda não pode rodar.</span> Faltam dados em {total - prontos === 1 ? "uma coisa" : `${total - prontos === 2 ? "duas" : "três"} coisas`}. Quando estiver tudo certo, ele roda sozinho toda segunda-feira.</p>
          )}
          <span className="inline-flex shrink-0 rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal" style={{ borderColor: pronto ? `${VERDE}47` : "rgba(176,122,20,.28)", color: pronto ? VERDE : AMBAR }}>{prontos} de {total} prontos</span>
        </div>
      </div>
      <div className="divide-y divide-black/[.08] rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        {verificacoes.map(v => (
          <div key={v.id} className="flex items-start gap-3.5 px-4 py-4">
            <Marca estado={v.estado} />
            <div className="min-w-0">
              <p className="text-[0.8125rem] text-[#282525]">{v.titulo}</p>
              <p className="mt-1 max-w-3xl text-[0.75rem] leading-relaxed text-black/45">{v.detalhe}</p>
              {v.acao === "importar" && <button type="button" onClick={onImportar} className={`mt-1.5 ${LINK}`}>{v.id === "gasto" ? "Importar gastos antigos" : "Importar planilha"}</button>}
              {v.acao === "conexoes" && <button type="button" onClick={onConexoes} className={`mt-1.5 ${LINK}`}>Ir para Conexões</button>}
            </div>
          </div>
        ))}
      </div>
      <ControlesDoModelo controles={prontidao.controles} onDatas={onDatas} onConexoes={onConexoes} />
      {ignoradas.length > 0 && <p className="max-w-3xl text-[0.75rem] leading-relaxed text-black/45">Para não contar o mesmo gasto duas vezes, ficou de fora o gasto {ignoradas.length === 1 ? "da ação" : "das ações"} <span className="text-black/65">{ignoradas.join(", ")}</span>: o gasto de anúncios já vem das conexões.</p>}
    </div>
  );
}


// ─── O que o modelo leva em conta além dos anúncios ─────────────────────────

function PilulaDoControle({ c }: { c: ControleDaTela }) {
  const [texto, cor] = c.estado === "em_uso" ? ["Em uso", VERDE] : c.estado === "entra_depois" ? [`Entra com ${SEMANAS_DOS_CONTROLES_EXTRAS} semanas · ${c.faltam === 1 ? "falta 1" : `faltam ${c.faltam}`}`, AMBAR] : c.estado === "opcional" ? ["Opcional", "rgba(13,13,13,.55)"] : ["Sem dado ainda", "rgba(13,13,13,.55)"];
  return <span className="inline-flex shrink-0 rounded-xl border bg-white px-2 py-0.5 text-[0.625rem] font-normal" style={{ borderColor: c.estado === "em_uso" ? `${VERDE}4D` : c.estado === "entra_depois" ? "rgba(176,122,20,.3)" : BORDA, color: cor }}>{texto}</span>;
}

/** Os controles do modelo (proximidade da sessão, feriados, preço e lotes, cupons, visitas sem anúncio): quais já estão em uso e quando entram os outros. */
export function ControlesDoModelo({ controles, onDatas, onConexoes }: { controles: ControleDaTela[]; onDatas?: () => void; onConexoes?: () => void }) {
  if (controles.length === 0) return null;
  return (
    <section className="space-y-2.5" aria-label="O que o modelo leva em conta além dos anúncios">
      <h3 className="text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45">O que o modelo leva em conta além dos anúncios</h3>
      <div className="divide-y divide-black/[.08] rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        {controles.map(c => (
          <div key={c.grupo} className="flex items-start gap-3.5 px-4 py-4">
            <Marca estado={c.estado === "em_uso" ? "ok" : c.estado === "opcional" ? "opcional" : "falta"} />
            <div className="min-w-0 flex-1">
              <p className="text-[0.8125rem] text-[#282525]">{c.rotulo}</p>
              <p className="mt-1 max-w-3xl text-[0.75rem] leading-relaxed text-black/45">{c.detalhe}</p>
              {c.acao === "datas" && <button type="button" onClick={onDatas} className={`mt-1.5 ${LINK}`}>Adicionar uma data sua</button>}
              {c.acao === "conexoes" && <button type="button" onClick={onConexoes} className={`mt-1.5 ${LINK}`}>Conectar o GA4</button>}
            </div>
            <PilulaDoControle c={c} />
          </div>
        ))}
      </div>
      <p className="max-w-3xl text-[0.75rem] leading-relaxed text-black/45">Com menos de um ano de histórico, o modelo usa só os dois controles mais importantes, para não confundir um efeito com outro. O resto entra sozinho a partir de {SEMANAS_DOS_CONTROLES_EXTRAS} semanas, sem você precisar fazer nada.</p>
    </section>
  );
}

// ─── A confiança por fatores ────────────────────────────────────────────────

const COR_DA_PERMISSAO = { sim: [VERDE, "sim"], cautela: [AMBAR, "com cautela"], nao: ["rgba(13,13,13,.55)", "ainda não"] } as const;

/** A confiança do modelo explicada por fatores (histórico, variação do gasto, sessões, firmeza do ajuste) e o que ela permite fazer com o resultado. */
export function ConfiancaDoModelo({ resultado, sessoes = null, eventos = null }: { resultado: ResultadoParaATela; sessoes?: number | null; eventos?: number | null }) {
  const { execucao: e, canais } = resultado;
  const confianca = confiancaMostrada(e.confianca, sessoes);
  const fatores = fatoresDaConfianca({ semanas: e.semanas, diagnosticos: { r_hat_maximo: e.r_hat_maximo, divergencias: e.divergencias, ess_minimo: e.ess_minimo }, canais, sessoes, eventos });
  const ok = fatores.filter(f => f.estado === "ok").length;
  return (
    <div className="space-y-3">
      <div className="rounded-xl border px-4 py-3.5" style={{ borderColor: "rgba(176,122,20,.25)", background: "#FFFBF2" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-3xl text-[0.8125rem] text-black/60"><span className="text-[#282525]">Confiança {ROTULO_CONFIANCA[confianca]}.</span> Última leitura do modelo: {dataBr(e.created_at)}. A confiança vem de {fatores.length === 4 ? "quatro" : "três"} coisas:</p>
          <span className="inline-flex shrink-0 rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal" style={{ borderColor: "rgba(176,122,20,.28)", color: AMBAR }}>{ok} de {fatores.length} em ordem</span>
        </div>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {fatores.map(f => (
            <div key={f.chave} className="rounded-xl border bg-white px-3 py-2.5" style={{ borderColor: BORDA }}>
              <p className="flex items-center gap-1.5 text-[0.78rem] text-[#282525]"><span className="size-2 rounded-full" style={{ background: f.estado === "ok" ? VERDE : AMBAR }} aria-hidden="true" />{f.titulo}</p>
              <p className="mt-1 text-[0.72rem] leading-snug text-black/50">{f.texto}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
        <p className="text-[0.875rem] text-[#282525]">O que essa confiança permite</p>
        <ul className="mt-2.5 space-y-1.5">
          {oQueAConfiancaPermite(confianca).map(p => (
            <li key={p.texto} className="flex items-start gap-2.5 text-[0.75rem] leading-relaxed text-black/55">
              <span className="mt-0.5 inline-flex shrink-0 rounded-xl border bg-white px-2 py-0.5 text-[0.625rem]" style={{ borderColor: BORDA, color: COR_DA_PERMISSAO[p.estado][0] }}>{COR_DA_PERMISSAO[p.estado][1]}</span>{p.texto}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── O resultado do modelo (M-B) ────────────────────────────────────────────

// `relative`: o texto `sr-only` do cabeçalho (posicionado de forma absoluta) fica dentro da célula; solto, contava como parte da página e criava um segundo scroll, com espaço em branco, em listas compridas.
const CABECALHO = "relative px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-3 text-[0.8125rem] text-[#282525]";
const dataBr = (iso: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const pontos = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
const margem = margemMostrada;


// ─── De onde vale investir mais (previsão) ──────────────────────────────────

/** A recomendação e a tabela "onde vale investir mais": o que R$ 100 a mais por semana trazem em cada canal, o custo do ingresso extra e se o canal está perto do limite. Previsão, não garantia. */
export function RecomendacaoDeInvestimento({ canais, gastoSemanal, confianca = "boa", semanas }: { canais: CanalDoResultado[]; gastoSemanal: Record<string, number>; confianca?: Confianca; semanas?: number }) {
  const comCurva = canaisComCurva(canais);
  const linhas = linhasDeInvestimento(comCurva, gastoSemanal).filter(l => l.gastoCentavos > 0);
  if (linhas.length === 0) return null;
  const r = recomendar(linhas);
  const firme = confianca === "boa";
  const rotulo = (c: string) => rotuloDoCanalDeGasto(c);
  const noLimite = linhas.filter(l => l.estado === "limite");
  const limiteDe = (c: string) => comCurva.find(x => x.canal === c)?.saturacaoCentavos ?? null;
  return (
    <section className="space-y-3" aria-label="De onde vale investir mais">
      {!firme ? (
        <div className="flex items-start gap-3.5 rounded-xl border px-5 py-4" style={{ borderColor: "rgba(176,122,20,.25)", background: "#FFFBF2" }}>
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] text-white" style={{ background: AMBAR }} aria-hidden="true">!</span>
          <div className="min-w-0">
            <p className="text-[0.875rem] text-[#282525]">{semanas ? `Com ${semanas} semanas` : "Com este histórico"} ainda não dá para recomendar um canal com segurança.</p>
            <p className="mt-1 max-w-3xl text-[0.75rem] leading-relaxed text-black/50">A tabela abaixo é um indício. Nos testes com dados inventados, o modelo errou a ordem dos canais com frequência quando tinha menos de 104 semanas de histórico.</p>
          </div>
        </div>
      ) : (
      <div className="flex items-start gap-3.5 rounded-xl border px-5 py-4" style={{ borderColor: "rgba(46,137,50,.28)", background: "#F8FCF8" }}>
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] text-white" style={{ background: VERDE }} aria-hidden="true">↑</span>
        <div className="min-w-0">
          {r.tipo === "sem_espaco" ? (
            <>
              <p className="text-[0.875rem] text-[#282525]">Os canais com anúncio estão perto do limite.</p>
              <p className="mt-1 max-w-3xl text-[0.75rem] leading-relaxed text-black/50">Gastar mais neles rende pouco. Vale testar um canal novo ou melhorar o que já anuncia.</p>
            </>
          ) : (
            <>
              <p className="text-[0.875rem] text-[#282525]">O modelo aponta o {rotulo(r.canal as string)} como o canal em que o próximo real rende mais.</p>
              <p className="mt-1 max-w-3xl text-[0.75rem] leading-relaxed text-black/50">
                Mais R$ 100 por semana no {rotulo(r.canal as string)} trazem cerca de {pontos(r.ingressosPorCem)} ingressos a mais{r.segundo ? `; no ${rotulo(r.segundo)}, cerca de ${pontos(r.ingressosPorCemDoSegundo as number)}` : ""}.
                {noLimite.map(l => limiteDe(l.canal) !== null ? ` O ${rotulo(l.canal)} já está perto do limite: acima de ${formatarMoeda(limiteDe(l.canal) as number)} por semana, cada real a mais rende pouco.` : "").join("")} É um indício: confirme com um pequeno experimento antes de mudar o orçamento.
              </p>
            </>
          )}
        </div>
      </div>
      )}
      <h3 className="text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45">Onde vale investir mais</h3>
      <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        <table className="w-full min-w-[46rem] border-collapse">
          <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Canal</th><th className={`${CABECALHO} text-right`}>Gasto por semana</th><th className={`${CABECALHO} text-right`}>Ingressos por R$ 100 a mais</th><th className={`${CABECALHO} text-right`}>Custo do ingresso extra</th><th className={CABECALHO}>Perto do limite</th><th className={CABECALHO}><span className="sr-only">Situação</span></th></tr></thead>
          <tbody className="divide-y divide-black/[.08]">
            {linhas.map(l => (
              <tr key={l.canal}>
                <td className={CELULA}>{rotulo(l.canal)}</td>
                <td className={`${CELULA} text-right tabular-nums`}>{formatarMoeda(l.gastoCentavos)}</td>
                <td className={`${CELULA} text-right tabular-nums`}>{pontos(l.ingressosPorCem)}</td>
                <td className={`${CELULA} text-right tabular-nums`}>{l.custoDoExtraCentavos === null ? <span className="text-black/30">—</span> : formatarMoeda(l.custoDoExtraCentavos)}</td>
                <td className="px-4 py-3">
                  <div className="relative h-2 w-48 rounded bg-[#EFECF6]" role="img" aria-label={`${l.posicao}% da curva${l.limite !== null ? `; o limite fica em ${l.limite}%` : ""}`}>
                    <div className="h-2 rounded" style={{ width: `${l.posicao}%`, background: l.estado === "limite" ? AMBAR : "#7259B5" }} />
                    {l.limite !== null && <span className="absolute -top-[3px] -bottom-[3px] w-0.5 bg-black/45" style={{ left: `${l.limite}%` }} />}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex rounded-xl border bg-white px-2 py-0.5 text-[0.625rem]" style={l.estado === "limite" ? { borderColor: "rgba(176,122,20,.3)", color: AMBAR } : { borderColor: `${VERDE}4D`, color: VERDE }}>{l.estado === "limite" ? "perto do limite" : "espaço para crescer"}</span>
                  {l.margemGrande && <span className="ml-2 inline-flex rounded-xl border px-2 py-0.5 text-[0.625rem] text-black/50" style={{ borderColor: BORDA }}>margem grande</span>}
                  {l.foraDaFaixa && <span className="ml-2 inline-flex rounded-xl border px-2 py-0.5 text-[0.625rem] text-black/50" style={{ borderColor: BORDA }}>acima do que já testou</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="max-w-3xl text-[0.75rem] leading-relaxed text-black/45">Isto é uma previsão, não uma garantia: vem da curva que o modelo estimou de cada canal e vale perto do que você já gastou (o gasto por semana é o mais comum nas semanas com gasto). Fora dessa faixa, como dobrar o gasto de um canal, a estimativa fica bem menos firme. Nos testes com dados inventados, com 104 semanas o modelo acertou qual canal rende mais em 6 de cada 10 vezes (e com 58 semanas, em 1 de cada 4). Só canais com gasto entram.</p>
    </section>
  );
}

const PARTES: Record<ChaveDaParte, { rotulo: string; dica: string; cor: string }> = {
  nivel: { rotulo: "Nível normal da loja", dica: "o que a loja vende sem nada especial acontecendo", cor: "#1C0E33" },
  tendencia: { rotulo: "Tendência e época do ano", dica: "a loja vem crescendo ou caindo; as estações", cor: "#3A2466" },
  proximidade: { rotulo: "Proximidade da sessão", dica: "vende mais nas semanas antes da data", cor: "#7259B5" },
  feriado: { rotulo: "Feriados e datas de pico", dica: "Natal, Dia das Mães, as datas suas", cor: "#A894D6" },
  lugares: { rotulo: "Tamanho do evento", dica: "semanas com mais lugares à venda vendem mais", cor: "#B8A8DE" },
  preco_e_lotes: { rotulo: "Preço e lotes", dica: "a troca de lote puxa uma corrida de compra", cor: "#C9BCE6" },
  cupom: { rotulo: "Cupons", dica: "semanas com cupom venderam diferente", cor: "#DDD4F0" },
  visitas: { rotulo: "Visitas sem anúncio (GA4)", dica: "busca, direto, e-mail, indicação", cor: "#EAE4F6" },
};
const sinal = (n: number) => (n < 0 ? `−${pontos(Math.abs(n))}` : pontos(n));

/** O que está dentro do "venderia de qualquer jeito": o nível da loja, a tendência e cada controle, com o quanto cada um explica das vendas e a margem de erro. */
export function QuebraDaBase({ base }: { base: ResultadoParaATela["execucao"]["base"] }) {
  const partes = base.partes;
  if (partes.length === 0) return null;
  const positivas = partes.filter(p => p.porcento > 0);
  const soma = positivas.reduce((s, p) => s + p.porcento, 0) || 1;
  return (
    <section className="rounded-xl border bg-white py-4" style={{ borderColor: BORDA }} aria-label="O que está dentro de venderia de qualquer jeito">
      <div className="px-4">
        <p className="text-[0.875rem] text-[#282525]">O que está dentro de “venderia de qualquer jeito”: {pontos(base.porcento)}% das vendas</p>
        <p className="mt-1 text-[0.75rem] text-black/45">Antes de culpar ou elogiar um anúncio, o modelo separa o que já empurrava as vendas.</p>
        <div className="mt-3.5 flex h-[22px] overflow-hidden rounded-md bg-[#F4F2F8]" aria-hidden="true">
          {positivas.map(p => <span key={p.chave} className="block h-full" style={{ width: `${(p.porcento / soma) * 100}%`, background: PARTES[p.chave].cor }} />)}
        </div>
      </div>
      <ul className="mt-3 divide-y divide-black/[.08] border-t" style={{ borderColor: BORDA }}>
        {partes.map(p => (
          <li key={p.chave} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[0.8125rem] text-[#282525]">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: PARTES[p.chave].cor, border: "1px solid rgba(13,13,13,.08)" }} aria-hidden="true" />
            <span>{PARTES[p.chave].rotulo}</span>
            <span className="text-[0.6875rem] text-black/40">{PARTES[p.chave].dica}</span>
            <span className="ml-auto tabular-nums">{sinal(p.porcento)}% <span className="text-black/35">±{margem(p.baixo, p.alto, p.porcento)}</span>
              {temMargemGrande(Math.abs(p.porcento), p.baixo, p.alto) && <span className="ml-2 inline-flex rounded-xl border px-2 py-0.5 text-[0.625rem] text-black/50" style={{ borderColor: BORDA }}>margem grande</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** O que o modelo estimou: o selo de confiança, a tabela canal a canal com o modelo ao lado dos links e, para cada canal, o gasto semanal a partir do qual rende pouco. */
export function ResultadoDoModelo({ resultado, gastoSemanal, sessoes = null, eventos = null, onImportar, onPlanejar }: { resultado: ResultadoParaATela; gastoSemanal?: Record<string, number>; sessoes?: number | null; eventos?: number | null; onImportar?: () => void; /** Abre a folha do calendário de divulgação de um evento. */ onPlanejar?: () => void }) {
  const { execucao: e, comparacao, canais, ultimaFalha } = resultado;
  const mostrada = confiancaMostrada(e.confianca, sessoes);
  const tamanho = blocoDoTamanhoDosCanais(e.semanas, mostrada);
  const investir = blocoDeInvestir(mostrada, e.semanas, canais.some(c => c.gasto_constante));
  const saturacoes = investir.aberto ? canais.filter(c => c.saturacao_gasto_centavos !== null && c.gasto_centavos > 0) : [];
  return (
    <div className="space-y-4">
      <ConfiancaDoModelo resultado={resultado} sessoes={sessoes} eventos={eventos} />
      {investir.aberto
        ? gastoSemanal && <RecomendacaoDeInvestimento canais={canais} gastoSemanal={gastoSemanal} confianca={mostrada} semanas={e.semanas} />
        : <PreviaComExemplo tipo="investir" motivo={investir.motivo ?? ""} acao={e.semanas < SEMANAS_IDEAIS ? "Importar vendas anteriores encurta isso." : undefined} onAcao={onImportar} />}
      {investir.aberto
        ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
            <div>
              <p className="text-[0.875rem] text-[#282525]">Calendário de divulgação do evento</p>
              <p className="mt-0.5 text-[0.75rem] text-black/50">{faltaAtraso(canaisComCurva(canais)) ? "Aparece na próxima rodada do modelo: ela passa a medir quanto tempo o efeito de cada canal dura." : "Quanto pôr em cada canal, semana a semana, até a sessão."}</p>
            </div>
            {!faltaAtraso(canaisComCurva(canais)) && onPlanejar && <button type="button" onClick={onPlanejar} className="rounded-xl border bg-white px-3.5 py-2 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]" style={{ borderColor: BORDA }}>Planejar um evento</button>}
          </div>
        )
        : <PreviaDoCalendario motivo={investir.motivo ?? ""} acao={e.semanas < SEMANAS_IDEAIS ? "Importar vendas anteriores encurta isso." : undefined} onAcao={onImportar} />}
      {ultimaFalha && <p role="alert" className="rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-black/55" style={{ borderColor: "rgba(176,122,20,.25)" }}>A rodada de {dataBr(ultimaFalha.created_at)} não deu: {ultimaFalha.motivo} Esta tela mostra a anterior.</p>}
      {tamanho.aberto && tamanho.selo ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5"><h3 className="text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45">Quanto cada canal vendeu</h3><SeloDePrecisao selo={tamanho.selo} /></div>
      <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        <table className="w-full min-w-[46rem] border-collapse">
          <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Canal</th><th className={`${CABECALHO} text-right`}>Gasto</th><th className={`${CABECALHO} text-right`}>Ingressos, segundo o modelo</th><th className={`${CABECALHO} text-right`}>Ingressos, segundo os links</th><th className={`${CABECALHO} text-right`}>Custo por ingresso</th></tr></thead>
          <tbody className="divide-y divide-black/[.08]">
            <tr>
              <td className={CELULA}>Venderia de qualquer jeito</td><td className={`${CELULA} text-right text-black/30`}>—</td>
              <td className={`${CELULA} text-right tabular-nums`}>{pontos(e.base.porcento)}% <span className="text-black/35">±{margem(e.base.baixo, e.base.alto, e.base.porcento)}</span></td>
              <td className={`${CELULA} text-right text-black/30`}>—</td><td className={`${CELULA} text-right text-black/30`}>—</td>
            </tr>
            {comparacao.linhas.map(l => (
              <tr key={l.canal}>
                <td className={CELULA}>{rotuloDoCanalDeGasto(l.canal)}{l.canal.endsWith("-marca") && <span className="ml-2 inline-flex rounded-xl border px-2 py-0.5 text-[0.625rem]" style={{ color: "#B07A14", borderColor: "rgba(176,122,20,.4)" }}>efeito de até 3 meses · impreciso</span>}{l.gastoConstante && <span className="ml-2 inline-flex rounded-xl border px-2 py-0.5 text-[0.625rem] text-black/50" style={{ borderColor: BORDA }}>gasto quase constante</span>}</td>
                <td className={`${CELULA} text-right tabular-nums`}>{l.gastoCentavos > 0 ? formatarMoeda(l.gastoCentavos) : "—"}</td>
                <td className={`${CELULA} text-right tabular-nums`}>{pontos(l.modelo)}% <span className="text-black/35">±{margem(l.baixo, l.alto, l.modelo)}</span></td>
                <td className={`${CELULA} text-right tabular-nums`}>{l.links === null ? <span className="text-black/30">—</span> : `${l.links}%`}</td>
                <td className={`${CELULA} text-right tabular-nums`}>{l.custoPorIngressoCentavos === null ? <span className="text-black/30">—</span> : formatarMoeda(l.custoPorIngressoCentavos)}{l.margemGrande && <span className="ml-2 inline-flex rounded-xl border px-2 py-0.5 text-[0.625rem] text-black/50" style={{ borderColor: BORDA }}>margem grande</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <QuebraDaBase base={e.base} />
      {comparacao.linhas.some(l => l.canal.endsWith("-marca")) && <MarcaDoModelo nivel={e.base.partes.find(p => p.chave === "nivel")?.porcento ?? null} />}
      {comparacao.anuncios && <p className="text-[0.75rem] text-black/50">Anúncios pagos (Meta e Google juntos, porque os links só dizem “anúncio pago”): modelo {comparacao.anuncios.modelo}%{comparacao.anuncios.links !== null ? ` · links ${comparacao.anuncios.links}%` : ""}.</p>}
      {saturacoes.length > 0 && (
        <ul className="space-y-1 text-[0.75rem] text-black/50">
          {saturacoes.map(c => <li key={c.canal}>{rotuloDoCanalDeGasto(c.canal)}: acima de {formatarMoeda(c.saturacao_gasto_centavos as number)} por semana, cada real a mais rende pouco.</li>)}
        </ul>
      )}
      <p className="max-w-3xl text-[0.75rem] leading-relaxed text-black/45">Os links só contam quem clicou e comprou. O modelo também enxerga quem viu o anúncio e comprou depois por outro caminho. Quando os dois números se parecem, a leitura é mais segura; quando diferem muito, desconfie do modelo até ter mais semanas. É uma estimativa, não uma prova: o ± é o quanto o modelo acha que ainda pode errar, já alargado {FATOR_DE_CAUTELA} vezes: nos testes com dados inventados ele errou até {FATOR_DE_CAUTELA} vezes mais do que dizia. Leia a margem como o mínimo de incerteza.</p>
        </div>
      ) : <PreviaComExemplo tipo="canais" motivo={tamanho.motivo ?? ""} acao="Importar vendas anteriores encurta isso." onAcao={onImportar} />}
    </div>
  );
}

/** Quando o modelo separa a marca dos eventos: por que ela é a parte mais difícil de medir e como saber mais sem mexer no total. */
function MarcaDoModelo({ nivel }: { nivel: number | null }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
        <div className="flex items-start justify-between gap-3"><p className="text-[0.875rem] text-[#282525]">A marca rende devagar</p><SeloDePrecisao selo="impreciso" /></div>
        <p className="mt-1.5 text-[0.75rem] leading-relaxed text-black/50">O anúncio de marca (o nome da casa, a instituição) faz a casa vender mais aos poucos e por meses, em todos os eventos. O modelo dá a ele até 3 meses de efeito; ao anúncio de evento, até 6 semanas.</p>
        <p className="mt-1.5 text-[0.75rem] leading-relaxed text-black/50">Por isso a marca é a parte mais difícil de medir: o efeito se mistura com a casa crescendo sozinha. Com 2 anos de histórico o número fica mais firme.</p>
      </div>
      <div className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
        <p className="text-[0.875rem] text-[#282525]">O que a marca pode estar ajudando a construir</p>
        <p className="mt-1.5 text-[0.75rem] leading-relaxed text-black/50">Parte do “Nível normal da loja”{nivel !== null ? ` (${pontos(nivel)}% das vendas)` : ""} pode ser efeito de marca que já se acumulou e o modelo não consegue separar.</p>
        <p className="mt-1.5 text-[0.75rem] leading-relaxed text-black/50">Para saber, o caminho é um teste pequeno, sem mudar o total: passar 20% da marca para os eventos por 4 semanas, num período sem estreia, e comparar.</p>
      </div>
    </div>
  );
}
