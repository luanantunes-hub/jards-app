// Infográficos do post "Crescimento com concentração: base maior, topo mais
// dominante". Todos os números vêm do próprio texto, que usa os dados do
// Ministério da Cultura e do Portal da Transparência (Lei de Incentivo à
// Cultura, incentivadores contados por CNPJ, 2023 e 2025). O que é conta feita
// a partir deles fica sinalizado na nota de cada quadro.

const ROTULO = "font-(family-name:--font-mono) text-[0.6875rem] font-medium uppercase tracking-[.08em]";
const AZUL = "#4A6385"; // empresas, contagens
const LARANJA = "#E08A3C"; // dinheiro e o topo

const pct = (n: number, casas = 1) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
const int = (n: number) => n.toLocaleString("pt-BR");

function Quadro({ id, rotulo, titulo, nota, children }: { id: string; rotulo: string; titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <figure className="my-12" aria-labelledby={id}>
      <div className="rounded bg-[#F7F7F5] px-5 py-7 sm:px-8">
        <p className={`${ROTULO} text-[#684DB0]`}>{rotulo}</p>
        <p id={id} className="mt-2 text-lg leading-snug font-bold tracking-[-0.01em] text-balance text-[#282525]">{titulo}</p>
        {children}
        <figcaption className="mt-5 flex flex-col gap-1.5 text-xs leading-relaxed text-black/50">
          {nota && <span>{nota}</span>}
          <span>Fonte: Ministério da Cultura e Portal da Transparência, Lei de Incentivo à Cultura, 2023 e 2025.</span>
        </figcaption>
      </div>
    </figure>
  );
}

function Barra({ valor, maximo, cor, rotulo, texto }: { valor: number; maximo: number; cor: string; rotulo: string; texto: string }) {
  return (
    <div className="grid grid-cols-[4.75rem_1fr_3.5rem] items-center gap-3">
      <span className={`${ROTULO} text-black/45`}>{rotulo}</span>
      <span className="h-2.5 overflow-hidden rounded-sm bg-black/[.06]">
        <span className="block h-full rounded-sm" style={{ width: `${Math.max(0.6, (valor / maximo) * 100)}%`, background: cor }} />
      </span>
      <span className="text-right text-[0.8125rem] font-medium tabular-nums text-[#282525]">{texto}</span>
    </div>
  );
}

// ─── 1. Quantas empresas, quanto dinheiro (2025) ────────────────────────────

const TOTAL_EMPRESAS_2025 = 6223;
const FAIXAS_2025 = [
  { nome: "Até R$ 100 mil", empresas: 3864, valor: "R$ 114,6 mi", parteValor: 3.48 },
  { nome: "R$ 100 mil a R$ 1 milhão", empresas: 1861, valor: "R$ 599,4 mi", parteValor: 18.21 },
  // 457 empresas: 6.223 − 3.864 − 1.861 − 41. Parte do valor: R$ 1,22 bi ÷ R$ 3,29 bi.
  { nome: "R$ 1 milhão a R$ 10 milhões", empresas: 457, valor: "R$ 1,22 bi", parteValor: 37.1, calculado: true },
  { nome: "Acima de R$ 10 milhões", empresas: 41, valor: "R$ 1,354 bi", parteValor: 41.17 },
];

export function InfograficoFaixas() {
  return (
    <Quadro
      id="info-faixas-titulo"
      rotulo="2025, por faixa de aporte"
      titulo="Quantas empresas, quanto dinheiro"
      nota="A parte das empresas é calculada a partir das contagens do texto (6.223 incentivadores em 2025). * A faixa de R$ 1 milhão a R$ 10 milhões sai por diferença: 457 empresas, e R$ 1,22 bilhão de R$ 3,29 bilhões."
    >
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5">
        <li className="flex items-center gap-2 text-[0.8125rem] text-black/70"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: AZUL }} />Parte das empresas</li>
        <li className="flex items-center gap-2 text-[0.8125rem] text-black/70"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: LARANJA }} />Parte do dinheiro</li>
      </ul>
      <div className="mt-5 flex flex-col">
        {FAIXAS_2025.map((f) => (
          <div key={f.nome} className="border-t border-black/[.08] py-4">
            <p className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-[0.9375rem] font-medium text-[#282525]">{f.nome}</span>
              <span className={`${ROTULO} text-black/45`}>{int(f.empresas)}{f.calculado ? "*" : ""} empresas · {f.valor}</span>
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Barra rotulo="Empresas" valor={f.empresas} maximo={TOTAL_EMPRESAS_2025} cor={AZUL}
                texto={pct((f.empresas / TOTAL_EMPRESAS_2025) * 100) + (f.calculado ? "*" : "")} />
              <Barra rotulo="Dinheiro" valor={f.parteValor} maximo={100} cor={LARANJA}
                texto={pct(f.parteValor, f.calculado ? 1 : 2) + (f.calculado ? "*" : "")} />
            </div>
          </div>
        ))}
      </div>
    </Quadro>
  );
}

// ─── 2. Quem ganhou e quem perdeu participação ──────────────────────────────

function Inclinacao({ de, para, cor }: { de: number; para: number; cor: string }) {
  // Escala de 15% a 45% na altura do desenho.
  const y = (p: number) => 34 - ((p - 15) / 30) * 30;
  return (
    <svg viewBox="0 0 64 36" className="h-9 w-16 shrink-0" aria-hidden="true">
      <line x1={6} y1={y(de)} x2={58} y2={y(para)} stroke={cor} strokeWidth={2} strokeLinecap="round" />
      <circle cx={6} cy={y(de)} r={2.5} fill={cor} />
      <circle cx={58} cy={y(para)} r={3.5} fill={cor} />
    </svg>
  );
}

export function InfograficoParticipacao() {
  const linhas = [
    { nome: "Acima de R$ 10 milhões", de: 35.93, para: 41.17, delta: "+5,24 p.p.", cor: LARANJA },
    { nome: "R$ 1 milhão a R$ 10 milhões", de: 38.5, para: 38.5, delta: "estável", cor: "#282525", faixa: "entre 37% e 40%" },
    { nome: "R$ 100 mil a R$ 1 milhão", de: 21.48, para: 18.21, delta: "−3,27 p.p.", cor: AZUL },
  ];
  return (
    <Quadro
      id="info-participacao-titulo"
      rotulo="Participação no total, 2023 → 2025"
      titulo="O topo cresceu mais rápido que o total"
    >
      <div className="mt-5 flex flex-col">
        {linhas.map((l) => (
          <div key={l.nome} className="flex items-center gap-4 border-t border-black/[.08] py-4">
            <Inclinacao de={l.de} para={l.para} cor={l.cor} />
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-medium text-[#282525]">{l.nome}</p>
              <p className="mt-0.5 text-[0.8125rem] tabular-nums text-black/60">
                {l.faixa ?? `${pct(l.de, 2)} → ${pct(l.para, 2)}`}
              </p>
            </div>
            <span className={`${ROTULO} shrink-0`} style={{ color: l.cor === "#282525" ? "rgba(13,13,13,.45)" : l.cor }}>{l.delta}</span>
          </div>
        ))}
      </div>
    </Quadro>
  );
}

// ─── 3. Uma empresa e uma faixa inteira ─────────────────────────────────────

const APORTES_2025 = [
  { nome: "Petrobras", valor: 318.6 },
  { nome: "Vale", valor: 193.7 },
  { nome: "Itaú", valor: 122.9 },
  { nome: "Nubank", valor: 116.1 },
];
const BASE_2025 = { nome: "3.864 empresas de até R$ 100 mil, somadas", valor: 114.6 };

export function InfograficoUmaEmpresa() {
  const maximo = APORTES_2025[0].valor;
  const mi = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} mi`;
  return (
    <Quadro
      id="info-uma-empresa-titulo"
      rotulo="Aportes de 2025"
      titulo="Uma empresa e uma faixa inteira"
      nota="Os R$ 114,6 milhões da faixa de até R$ 100 mil equivalem a cerca de 36% do que a Petrobras incentivou sozinha e praticamente ao aporte do Nubank."
    >
      <div className="mt-5 flex flex-col gap-3">
        {[...APORTES_2025, BASE_2025].map((a) => {
          const base = a === BASE_2025;
          return (
            <div key={a.nome} className={base ? "mt-2 border-t border-black/[.08] pt-4" : ""}>
              <p className="flex items-baseline justify-between gap-3 text-[0.875rem]">
                <span className={base ? "font-medium text-[#282525]" : "text-black/70"}>{a.nome}</span>
                <span className="font-medium whitespace-nowrap tabular-nums text-[#282525]">{mi(a.valor)}</span>
              </p>
              <span className="mt-1.5 block h-2.5 overflow-hidden rounded-sm bg-black/[.06]">
                <span className="block h-full rounded-sm" style={{ width: `${(a.valor / maximo) * 100}%`, background: base ? LARANJA : AZUL }} />
              </span>
            </div>
          );
        })}
      </div>
    </Quadro>
  );
}

// ─── 4. De onde veio o R$ 1 bilhão a mais ───────────────────────────────────

const CRESCIMENTO = [
  { nome: "Até R$ 100 mil", valor: 28.5, cor: "#B8C3D3" },
  { nome: "R$ 100 mil a R$ 1 milhão", valor: 112.7, cor: "#8295AF" },
  { nome: "R$ 1 milhão a R$ 10 milhões", valor: 343.2, cor: AZUL },
  { nome: "Acima de R$ 10 milhões", valor: 540.6, cor: LARANJA },
];

export function InfograficoCrescimento() {
  const total = CRESCIMENTO.reduce((s, c) => s + c.valor, 0);
  const mi = (v: number) => `+R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} mi`;
  return (
    <Quadro
      id="info-crescimento-titulo"
      rotulo="Crescimento de 2023 a 2025, por faixa"
      titulo="De onde veio o R$ 1 bilhão a mais"
      nota="Mais da metade do crescimento absoluto veio da faixa acima de R$ 10 milhões."
    >
      <div className="mt-5 flex h-9 overflow-hidden rounded-sm" role="img" aria-label="Barra do crescimento total de cerca de R$ 1,02 bilhão dividida por faixa.">
        {CRESCIMENTO.map((c) => (
          <span key={c.nome} className="h-full border-r border-[#F7F7F5] last:border-r-0" style={{ width: `${(c.valor / total) * 100}%`, background: c.cor }} />
        ))}
      </div>
      <ol className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {CRESCIMENTO.map((c) => (
          <li key={c.nome} className="flex items-start gap-2.5">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c.cor }} />
            <span>
              <span className="block text-[0.9375rem] font-medium tabular-nums text-[#282525]">{mi(c.valor)}</span>
              <span className="block text-[0.8125rem] text-black/60">{c.nome}</span>
            </span>
          </li>
        ))}
      </ol>
    </Quadro>
  );
}

// ─── 5. Mais incentivadores, quase a mesma concentração ─────────────────────

export function InfograficoConcentracao() {
  const numeros = [
    { rotulo: "Incentivadores", de: 4602, para: 6223 },
    { rotulo: "Empresas que somam metade do valor", de: 79, para: 80 },
  ];
  return (
    <Quadro
      id="info-concentracao-titulo"
      rotulo="Indicadores de concentração, 2023 → 2025"
      titulo="Mais incentivadores, quase a mesma concentração"
    >
      <div className="mt-5 grid gap-px overflow-hidden rounded bg-black/[.08] sm:grid-cols-2">
        {numeros.map((n) => (
          <div key={n.rotulo} className="bg-white px-5 py-5">
            <p className={`${ROTULO} text-black/45`}>{n.rotulo}</p>
            <p className="mt-3 flex items-baseline gap-2.5 tabular-nums">
              <span className="text-xl font-medium text-black/45">{int(n.de)}</span>
              <span className="text-black/35" aria-hidden="true">→</span>
              <span className="sr-only">para</span>
              <span className="text-[2rem] leading-none font-bold tracking-[-0.02em] text-[#282525]">{int(n.para)}</span>
            </p>
          </div>
        ))}
      </div>
    </Quadro>
  );
}
