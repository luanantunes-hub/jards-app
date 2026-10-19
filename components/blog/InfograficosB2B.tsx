// Infográficos do post "O que a captação de recursos pode aprender com as
// vendas B2B?". Tudo sai do próprio texto. O símbolo de cada etapa repete a
// capa: o funil visto de cima, em anéis — o de fora para mapear, o do meio
// para qualificar e o centro aceso para fechar.

import Quadro, { ROTULO } from "./Quadro";

const AZUL = "#4A6385";
const LARANJA = "#E08A3C";

type Anel = 0 | 1 | 2; // 0: fora (mapear) · 1: meio (qualificar) · 2: centro (fechar)

function Funil({ anel, className = "h-8 w-8" }: { anel: Anel; className?: string }) {
  const raios = [13, 8.5, 4];
  return (
    <svg viewBox="0 0 32 32" className={`shrink-0 ${className}`} aria-hidden="true">
      {raios.map((r, i) => {
        const ativo = i === anel;
        if (i === 2) return <circle key={i} cx={16} cy={16} r={r} fill={ativo ? LARANJA : "none"} stroke={ativo ? LARANJA : "#282525"} strokeOpacity={ativo ? 1 : 0.3} strokeWidth={1.25} />;
        return <circle key={i} cx={16} cy={16} r={r} fill="none" stroke={ativo ? AZUL : "#282525"} strokeOpacity={ativo ? 1 : 0.25} strokeWidth={ativo ? 2 : 1} strokeDasharray={ativo ? undefined : "2 2.5"} />;
      })}
    </svg>
  );
}

const ETAPAS: { anel: Anel; momento: string; funcao: string; sigla: string; papel: string; faz: string }[] = [
  {
    anel: 0, momento: "Prospecção", sigla: "LDR", funcao: "Lead Development Representative", papel: "Mapeador",
    faz: "Identifica empresas com afinidade estratégica, orçamento disponível e histórico de investimento em cultura, esporte ou impacto social.",
  },
  {
    anel: 1, momento: "Contato", sigla: "SDR", funcao: "Sales Development Representative", papel: "Captador",
    faz: "Conduz as primeiras conversas, qualifica o fit e constrói pontes de valor entre o projeto e a marca.",
  },
  {
    anel: 2, momento: "Negociação", sigla: "Closer", funcao: "Fechamento", papel: "Gestor de relacionamento",
    faz: "Estrutura o contrato, negocia contrapartidas e garante a execução.",
  },
];

// ─── 1. O funil da captação ─────────────────────────────────────────────────

export function InfograficoFunil() {
  return (
    <Quadro
      id="info-funil-titulo"
      rotulo="Do funil de vendas à captação"
      titulo="O funil da captação"
      nota="Na captação, é raro haver uma pessoa para cada etapa: muitas vezes os três momentos são da mesma pessoa ou de uma equipe reduzida."
      largo
    >
      <ol className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch lg:gap-2">
        {ETAPAS.map((e, i) => (
          <li key={e.momento} className="contents">
            <div className="flex flex-col rounded border border-black/[.08] bg-white p-5">
              <div className="flex items-center gap-3">
                <Funil anel={e.anel} />
                <div>
                  <p className={`${ROTULO} text-black/60`}>{String(i + 1).padStart(2, "0")} · {e.sigla}</p>
                  <p className="text-[1.0625rem] leading-tight font-bold text-[#282525]">{e.momento}</p>
                </div>
              </div>
              <p className="mt-4 text-[0.8125rem] text-black/60">
                <span className="font-medium text-[#282525]">{e.papel}</span>
                <span> · no B2B, {e.sigla === "Closer" ? "o Closer" : `o ${e.sigla} (${e.funcao})`}</span>
              </p>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-black/70">{e.faz}</p>
            </div>
            {i < ETAPAS.length - 1 && (
              <span className="flex items-center justify-center text-black/35 lg:px-0.5" aria-hidden="true">
                <i className="ph ph-arrow-down text-lg lg:hidden" />
                <i className="ph ph-arrow-right hidden text-lg lg:block" />
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-center gap-3 text-[0.8125rem] text-black/60">
        <svg viewBox="0 0 40 16" className="h-4 w-10 shrink-0" aria-hidden="true">
          <path d="M36 4 H8 A4 4 0 0 0 8 12 H14" fill="none" stroke="#282525" strokeOpacity=".45" strokeWidth={1.25} strokeDasharray="3 3" />
          <path d="M11 9 L14.5 12 L11 15" fill="none" stroke="#282525" strokeOpacity=".45" strokeWidth={1.25} />
        </svg>
        O ciclo de decisão raramente é linear: o patrocínio amadurece à medida que a empresa reconhece a aderência entre seu posicionamento e o propósito do projeto.
      </div>
    </Quadro>
  );
}

// ─── 2. Métricas ────────────────────────────────────────────────────────────

const METRICAS_B2B = [
  { sigla: "CAC", nome: "Custo de Aquisição de Cliente" },
  { sigla: "LTV", nome: "Lifetime Value" },
  { sigla: null, nome: "Taxa de conversão" },
];
const METRICAS_CAPTACAO = [
  { sigla: "CAP", nome: "Custo de Aquisição de Patrocinador" },
  { sigla: "VRP", nome: "Valor de Retenção" },
  { sigla: null, nome: "Tempo médio de fechamento" },
];

function ListaMetricas({ titulo, itens }: { titulo: string; itens: { sigla: string | null; nome: string }[] }) {
  return (
    <div className="rounded border border-black/[.08] bg-white p-5">
      <p className={`${ROTULO} text-black/60`}>{titulo}</p>
      <ul className="mt-3 flex flex-col">
        {itens.map((m) => (
          <li key={m.nome} className="flex items-baseline gap-3 border-t border-black/[.06] py-2.5 first:border-t-0">
            <span className="w-10 shrink-0 font-(family-name:--font-mono) text-[0.8125rem] font-medium text-[#282525]">{m.sigla ?? "—"}</span>
            <span className="text-[0.875rem] text-black/70">{m.nome}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InfograficoMetricas() {
  return (
    <Quadro
      id="info-metricas-titulo"
      rotulo="Ciência de pipeline"
      titulo="As métricas das vendas encontram correspondência na captação"
      nota="As duas listas se correspondem como conjunto, não item a item."
    >
      <div className="mt-6 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <ListaMetricas titulo="Vendas B2B" itens={METRICAS_B2B} />
        <span className="flex justify-center text-black/35" aria-hidden="true">
          <i className="ph ph-arrows-left-right hidden text-xl sm:block" />
          <i className="ph ph-arrows-down-up text-xl sm:hidden" />
        </span>
        <ListaMetricas titulo="Captação" itens={METRICAS_CAPTACAO} />
      </div>
    </Quadro>
  );
}

// ─── 3. Do generalista à especialização ─────────────────────────────────────

const TAREFAS = ["Mapeamento de leads", "Contato inicial", "Negociação", "Fechamento", "Pós-venda"];
const FUNCOES: { anel: Anel; sigla: string; faz: string }[] = [
  { anel: 0, sigla: "LDR", faz: "Mapeamento de leads" },
  { anel: 1, sigla: "SDR", faz: "Primeiro contato e qualificação: o “motor de geração de pipeline”" },
  { anel: 2, sigla: "Closer", faz: "Negociação e fechamento" },
];

export function InfograficoEspecializacao() {
  return (
    <Quadro
      id="info-especializacao-titulo"
      rotulo="Funil de vendas"
      titulo="Do vendedor generalista às funções especializadas"
      nota="Marco da passagem: o livro Predictable Revenue (2011), de Aaron Ross, escrito a partir da experiência na Salesforce."
      largo
    >
      <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto_1.3fr] lg:items-center">
        <div className="rounded border border-black/[.08] bg-white p-5">
          <p className={`${ROTULO} text-black/60`}>Antes · uma pessoa</p>
          <p className="mt-1 text-[0.9375rem] font-bold text-[#282525]">O vendedor generalista</p>
          <ol className="mt-3 flex flex-col gap-1.5">
            {TAREFAS.map((t, i) => (
              <li key={t} className="flex items-center gap-2.5 text-[0.875rem] text-black/70">
                <span className="font-(family-name:--font-mono) text-[0.6875rem] text-black/60">{String(i + 1).padStart(2, "0")}</span>{t}
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col items-center gap-1 py-1 text-center lg:px-2" aria-hidden="true">
          <i className="ph ph-arrow-down text-lg text-black/35 lg:hidden" />
          <i className="ph ph-arrow-right hidden text-lg text-black/35 lg:block" />
          <span className={`${ROTULO} text-black/60`}>2011</span>
        </div>
        <div className="rounded border border-black/[.08] bg-white p-5">
          <p className={`${ROTULO} text-black/60`}>Depois · funções separadas</p>
          <ul className="mt-3 flex flex-col">
            {FUNCOES.map((f) => (
              <li key={f.sigla} className="flex items-center gap-3 border-t border-black/[.06] py-2.5 first:border-t-0">
                <Funil anel={f.anel} className="h-7 w-7" />
                <span className="w-14 shrink-0 text-[0.9375rem] font-bold text-[#282525]">{f.sigla}</span>
                <span className="text-[0.875rem] leading-snug text-black/70">{f.faz}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Quadro>
  );
}

// ─── 4. Indicadores por função ──────────────────────────────────────────────

const INDICADORES: { anel: Anel; sigla: string; itens: string[] }[] = [
  { anel: 0, sigla: "LDR", itens: ["Volume de leads mapeados", "Abordagens"] },
  { anel: 1, sigla: "SDR", itens: ["Leads qualificados", "Reuniões agendadas"] },
  { anel: 2, sigla: "Closer", itens: ["Valor de contratos fechados", "Ciclo médio", "Churn", "Lifetime value"] },
];

export function InfograficoIndicadores() {
  return (
    <Quadro
      id="info-indicadores-titulo"
      rotulo="Vendas B2B"
      titulo="Cada função, seus indicadores"
    >
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {INDICADORES.map((f) => (
          <div key={f.sigla} className="rounded border border-black/[.08] bg-white p-5">
            <div className="flex items-center gap-2.5">
              <Funil anel={f.anel} className="h-7 w-7" />
              <p className="text-[0.9375rem] font-bold text-[#282525]">{f.sigla}</p>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {f.itens.map((t) => (
                <li key={t} className="text-[0.875rem] leading-snug text-black/70">{t}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Quadro>
  );
}
