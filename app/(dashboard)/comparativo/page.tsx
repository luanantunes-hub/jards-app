"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Lock, Unlock, MoreHorizontal, Briefcase, UsersRound, Globe, ArrowUpRight, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CompanyLogo } from "@/components/CompanyLogo";
import { usePortalPosition, PortalMenu } from "@/components/ui/ComboboxPortalMenu";
import { usePersistedViewMode } from "@/components/ui/EntityViewSwitcher";
import { colorFrom } from "@/lib/colorFrom";
import { NovoProspectModal } from "@/components/modals/NovoProspectModal";
import { NovaCaptacaoModal } from "@/components/modals/NovaCaptacaoModal";
import { NovaInscricaoModal } from "@/components/modals/NovaInscricaoModal";

type EmpresaOption = { id: string; nome: string; site: string | null; logo_url: string | null };
type Lei = "cultura" | "ancine" | "esporte" | "saude";
type Valores = Record<string, Partial<Record<Lei, number>>>;
type Potencial = { valorEfetivo: number; potencial: number; potencialSemCultura?: number };
type Crescimento = { taxaAnual: number; confianca: "individual" | "parcial" | "setor" };

const LEIS: { key: Lei; label: string }[] = [
  { key: "cultura", label: "Cultura" },
  { key: "ancine", label: "Ancine" },
  { key: "esporte", label: "Esporte" },
  { key: "saude", label: "Saúde" },
];

const MAX_EMPRESAS = 5;

// Classes literais (não construídas via template string) pra o Tailwind JIT conseguir
// encontrar cada uma no código-fonte — usado pelo grid de cartões em ComparativoCartoes.
const GRID_COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

// Todos os valores são do ANO CORRENTE (2025), igual à página Patrocinadores — não o acumulado
// histórico. O teto do IRPJ é um limite anual, então comparar contra um acumulado de vários
// anos daria um "potencial" sem sentido.
//
// Teto de dedução do IRPJ por lei (% do imposto devido) — Receita Federal.
// Cultura (Rouanet) e Ancine compartilham o MESMO teto de 4%, não são blocos independentes —
// por isso calcularPotencial soma os dois antes de aplicar o percentual.
// Esporte: 2% pra projeto geral (Decreto 12.861/2026 — sobe pra 3% em 2028) é o único pedaço
// de verdade independente. O bônus de até 4% pra inclusão social NÃO é um teto próprio do
// esporte — é o MESMO teto global de 4% que cultura/ancine já dividem (Solução Cosit nº
// 4/2026). Como não classificamos o projeto, usamos o valor conservador (2%, o geral) em vez
// do teto máximo — evita prometer espaço que só existiria se fosse inclusão social.
// Saúde soma dois programas de 1% cada (Pronon + Pronas/PCD).
const TETO_PCT: Record<Lei, number> = { cultura: 4, ancine: 4, esporte: 2, saude: 2 };

type ViewMode = "tabela" | "cartao";
const VIEW_MODES = ["tabela", "cartao"] as const;
const VIEW_OPTIONS = [
  { value: "tabela", label: "Leis" },
  { value: "cartao", label: "Empresas" },
] as const;

// Crescimento e potencial nunca aparecem juntos — mostrar os dois ao mesmo tempo pra cada
// lei de cada empresa é informação demais pra comparar de relance. O usuário escolhe qual
// camada extra ver; o padrão é nenhuma (só valor + barra).
type MetricaExtra = "nenhuma" | "crescimento" | "potencial";
const METRICA_EXTRA_MODES = ["nenhuma", "crescimento", "potencial"] as const;

const fmt = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
};

// Esporte tem teto incerto pra nós (2% geral ou 4% inclusão social — não classificamos o
// projeto). Pra estimar a capacidade fiscal da empresa (a "base segura" abaixo), ele entra
// SEMPRE pela hipótese de 4%, não pelos 2% que ele mesmo exibe (TETO_PCT.esporte) — dividir
// por um teto maior dá a base implícita MENOR, a única forma de nunca inflar artificialmente
// o potencial mostrado em Cultura/Saúde quando é o Esporte que domina a comparação. Se
// usássemos 2% aqui, um investimento grande em esporte "geral" pareceria provar uma
// capacidade fiscal maior do que a empresa de fato tem — e todo o resto herdaria esse erro.
const TETO_ESPORTE_BASE = 4;

// Estima qual bloco de leis está "no teto" (maior base de IRPJ implícita: valor ÷ teto%) e,
// a partir dele, quanto de espaço em R$ ainda cabe nos demais — sem precisar saber o IRPJ
// real. Cultura e Ancine entram somados, já que compartilham o mesmo teto de 4%.
function calcularPotencial(valoresEmpresa: Partial<Record<Lei, number>>): Record<Lei, Potencial> {
  const ancine = valoresEmpresa.ancine ?? 0;
  const culturaAncine = (valoresEmpresa.cultura ?? 0) + ancine;
  const esporte = valoresEmpresa.esporte ?? 0;
  const saude = valoresEmpresa.saude ?? 0;

  const baseSegura = Math.max(
    culturaAncine / TETO_PCT.cultura,
    saude / TETO_PCT.saude,
    esporte / TETO_ESPORTE_BASE,
    0,
  );

  const valorPorBloco: Record<Lei, number> = { cultura: culturaAncine, ancine: culturaAncine, esporte, saude };
  const resultado = {} as Record<Lei, Potencial>;
  LEIS.forEach(({ key }) => {
    const potencial = Math.max(0, TETO_PCT[key] * baseSegura - valorPorBloco[key]);
    resultado[key] = { valorEfetivo: valorPorBloco[key], potencial };
  });
  // Quanto sobraria só pro Ancine se a Cultura cedesse todo o espaço que ocupa no teto
  // compartilhado (Cultura investimento → 0). Mais útil justamente quando o bloco combinado
  // já está no teto (potencial normal = 0) — sem isso, pareceria que não sobra nada pro
  // Ancine, escondendo o espaço que existiria numa realocação.
  resultado.ancine.potencialSemCultura = Math.max(0, TETO_PCT.ancine * baseSegura - ancine);
  return resultado;
}

// Cada selo é número + legenda curta embaixo (mesmo padrão de "TOTAL 2025"), pra ser lido sem
// precisar decorar ícone ou cor — e cada um fica plantado num canto diferente da linha (ver
// pontos de uso), pra não parecerem duas variações da mesma coisa.
function PotencialTag({ lei, potencial, valorEfetivo, potencialSemCultura }: { lei: Lei; potencial: number; valorEfetivo: number; potencialSemCultura?: number }) {
  if (lei === "ancine") {
    if (!potencialSemCultura || potencialSemCultura <= 0) return null;
    return (
      <div
        className="flex flex-col items-end gap-0.5"
        title="Espaço estimado pro Ancine se a Cultura cedesse todo o espaço que ocupa no teto compartilhado (realocação, não soma com o potencial da Cultura)"
      >
        <div className="flex items-center gap-1 whitespace-nowrap text-[12px] font-semibold" style={{ color: "#2E8932" }}>
          <ArrowRight size={10} strokeWidth={2.5} className="shrink-0" />
          +{fmt(potencialSemCultura)}
        </div>
        <span className="text-[8px] font-bold uppercase tracking-wider text-black/30">Potencial realocado</span>
      </div>
    );
  }
  if (potencial > 0) {
    return (
      <div
        className="flex flex-col items-end gap-0.5"
        title={`Espaço estimado até o teto legal de dedução${lei === "esporte" ? " (considerando o teto de 2% de projeto geral — pode ser maior, até 4%, se for inclusão social)" : ""}`}
      >
        <div className="flex items-center gap-1 whitespace-nowrap text-[12px] font-semibold" style={{ color: "#2E8932" }}>
          <Unlock size={10} strokeWidth={2.5} className="shrink-0" />
          +{fmt(potencial)}
        </div>
        <span className="text-[8px] font-bold uppercase tracking-wider text-black/30">Potencial</span>
      </div>
    );
  }
  if (valorEfetivo > 0) {
    return (
      <div
        className="flex items-center gap-1 whitespace-nowrap text-[12px] font-semibold"
        style={{ color: "#B07A14" }}
        title="Valor já está no teto legal estimado"
      >
        <Lock size={10} strokeWidth={2.5} />
        No teto
      </div>
    );
  }
  return null;
}

// Taxa anual estimada por regressão log-linear sobre o histórico da empresa, ponderada por
// credibilidade com a taxa do setor (empresas com pouco histórico puxam mais pro setor — ver
// função recalcular_expectativa_crescimento no banco). O sufixo "· setor" avisa quando a taxa é
// majoritariamente estimada pelo setor, não pelo histórico próprio da empresa.
function CrescimentoTag({ crescimento, valor }: { crescimento?: Crescimento; valor: number }) {
  if (!crescimento) return null;
  const { taxaAnual, confianca } = crescimento;
  const positivo = taxaAnual >= 0;
  const valorNominal = Math.abs(valor * taxaAnual);
  return (
    <div
      className="flex flex-col items-start gap-0.5"
      title={`Crescimento anual estimado${confianca === "setor" ? " (baseado no setor — empresa tem pouco histórico próprio)" : ""}`}
    >
      <div className="flex items-center gap-1 whitespace-nowrap text-[12px] font-semibold" style={{ color: positivo ? "#1A8B7A" : "rgba(13,13,13,.4)" }}>
        {positivo ? "+" : "-"}
        {Math.round(Math.abs(taxaAnual) * 100)}%
        <ArrowRight size={10} strokeWidth={2.5} className="shrink-0 text-black/25" />
        {positivo ? "+" : "-"}
        {fmt(valorNominal)}
      </div>
      <span className="text-[8px] font-bold uppercase tracking-wider text-black/30">
        Cresc./ano{confianca === "setor" && " · setor"}
      </span>
    </div>
  );
}

function ComparativoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [selecionadas, setSelecionadas] = useState<EmpresaOption[]>([]);
  const [hidratado, setHidratado] = useState(false);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<EmpresaOption[]>([]);
  const [valores, setValores] = useState<Valores>({});
  const [crescimentos, setCrescimentos] = useState<Record<string, Partial<Record<Lei, Crescimento>>>>({});
  const [loadingValores, setLoadingValores] = useState(false);
  const [viewMode, setViewMode] = usePersistedViewMode<ViewMode>("jards:comparativo:view", VIEW_MODES, "tabela");
  const [metricaExtra, setMetricaExtra] = usePersistedViewMode<MetricaExtra>("jards:comparativo:metrica", METRICA_EXTRA_MODES, "nenhuma");

  const buscaBoxRef = useRef<HTMLDivElement>(null);
  const buscaMenuPos = usePortalPosition(buscaBoxRef, resultados.length > 0);

  // Hidrata a seleção a partir da URL (?empresas=id1,id2) uma única vez.
  useEffect(() => {
    const ids = searchParams.get("empresas")?.split(",").filter(Boolean) ?? [];
    if (ids.length === 0) { setHidratado(true); return; }
    supabase.from("empresas").select("id, nome, site, logo_url").in("id", ids).then(({ data }) => {
      const linhas = (data ?? []) as EmpresaOption[];
      const porId = new Map(linhas.map((e) => [e.id, e]));
      setSelecionadas(ids.map((id) => porId.get(id)).filter((e): e is EmpresaOption => !!e));
      setHidratado(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mantém a URL sincronizada com a seleção, pra tornar o comparativo linkável.
  useEffect(() => {
    if (!hidratado) return;
    const qs = selecionadas.length > 0 ? `?empresas=${selecionadas.map((e) => e.id).join(",")}` : "";
    router.replace(`/comparativo${qs}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionadas, hidratado]);

  // Busca de empresas por nome.
  useEffect(() => {
    if (busca.trim().length < 2) { setResultados([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("empresas")
        .select("id, nome, site, logo_url")
        .ilike("nome", `%${busca.trim()}%`)
        .limit(8);
      const jaSelecionadas = new Set(selecionadas.map((e) => e.id));
      setResultados(((data ?? []) as EmpresaOption[]).filter((e) => !jaSelecionadas.has(e.id)));
    }, 300);
    return () => clearTimeout(timer);
  }, [busca, selecionadas, supabase]);

  // Valores do ano corrente (2025) por lei das empresas selecionadas, igual à página
  // Patrocinadores. Cultura foi migrada pra investimentos_por_lei (lei='cultura') — mesma
  // fonte das outras 3 leis, sem mais schema legado separado.
  useEffect(() => {
    if (selecionadas.length === 0) { setValores({}); setCrescimentos({}); return; }
    let cancelled = false;
    setLoadingValores(true);
    const ids = selecionadas.map((e) => e.id);
    Promise.all([
      supabase.from("investimentos_por_lei").select("empresa_id, lei, valor").eq("ano", 2025).in("empresa_id", ids),
      supabase.from("expectativa_crescimento").select("empresa_id, lei, taxa_anual, confianca").in("empresa_id", ids),
    ]).then(([porLei, crescimento]) => {
      if (cancelled) return;
      const mapa: Record<string, Partial<Record<Lei, number>>> = {};
      for (const linha of (porLei.data ?? []) as { empresa_id: string; lei: Lei; valor: number | null }[]) {
        (mapa[linha.empresa_id] ??= {})[linha.lei] = linha.valor ?? 0;
      }
      setValores(mapa);

      const mapaCrescimento: Record<string, Partial<Record<Lei, Crescimento>>> = {};
      for (const linha of (crescimento.data ?? []) as { empresa_id: string; lei: Lei; taxa_anual: number; confianca: Crescimento["confianca"] }[]) {
        (mapaCrescimento[linha.empresa_id] ??= {})[linha.lei] = { taxaAnual: linha.taxa_anual, confianca: linha.confianca };
      }
      setCrescimentos(mapaCrescimento);

      setLoadingValores(false);
    });
    return () => { cancelled = true; };
  }, [selecionadas, supabase]);

  function adicionar(empresa: EmpresaOption) {
    if (selecionadas.length >= MAX_EMPRESAS) return;
    setSelecionadas((prev) => [...prev, empresa]);
    setBusca("");
    setResultados([]);
  }

  function remover(id: string) {
    setSelecionadas((prev) => prev.filter((e) => e.id !== id));
  }

  const totalPorEmpresa = (id: string) => LEIS.reduce((acc, { key }) => acc + (valores[id]?.[key] ?? 0), 0);
  const maxPorLei = (lei: Lei) => Math.max(1, ...selecionadas.map((e) => valores[e.id]?.[lei] ?? 0));
  const potenciais: Record<string, Record<Lei, Potencial>> = {};
  for (const e of selecionadas) potenciais[e.id] = calcularPotencial(valores[e.id] ?? {});

  function renderLeiRows(key: Lei) {
    const max = maxPorLei(key);
    return selecionadas.map((e) => {
      const valor = valores[e.id]?.[key] ?? 0;
      const { valorEfetivo, potencial, potencialSemCultura } = potenciais[e.id]?.[key] ?? { valorEfetivo: 0, potencial: 0 };
      const pct = Math.round((valor / max) * 100);
      return (
        <div key={e.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex w-full shrink-0 items-center gap-3 sm:w-[22%]">
            <CompanyLogo nome={e.nome} site={e.site} logo_url={e.logo_url} size={30} className="rounded border border-black/8" />
            <span className="truncate text-[14px] font-medium text-black/70">{e.nome}</span>
          </div>
          <div className="h-2.5 flex-1 rounded-full bg-black/[.05]">
            <div
              className="h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, background: colorFrom(e.nome) }}
            />
          </div>
          <div className="w-full shrink-0 text-right sm:w-[24%]">
            <div className="text-[20px] font-semibold leading-none tabular-nums text-black/85">
              {loadingValores ? "…" : fmt(valor)}
            </div>
            {!loadingValores && metricaExtra !== "nenhuma" && (
              <div className="mt-1.5 flex justify-end">
                {metricaExtra === "crescimento" && <CrescimentoTag crescimento={crescimentos[e.id]?.[key]} valor={valor} />}
                {metricaExtra === "potencial" && <PotencialTag lei={key} potencial={potencial} valorEfetivo={valorEfetivo} potencialSemCultura={potencialSemCultura} />}
              </div>
            )}
          </div>
        </div>
      );
    });
  }

  return (
    <div className="min-h-full bg-white">
      <div className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <div className="mx-auto max-w-[1280px] px-4 pb-7 pt-8 sm:px-6 lg:px-10 lg:pb-9">
          <h1 className="max-w-2xl text-[32px] font-semibold leading-[1.04] tracking-[-.045em] text-[#0D0D0D] sm:text-[38px]">
            Comparativo de investimento
          </h1>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div ref={buscaBoxRef} className="relative min-w-[220px] max-w-[320px] flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={selecionadas.length >= MAX_EMPRESAS ? `Máximo de ${MAX_EMPRESAS} empresas` : "Buscar empresa para comparar…"}
                disabled={selecionadas.length >= MAX_EMPRESAS}
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border rounded text-black placeholder-black/30 focus:outline-none focus:ring-2 focus:ring-black/15 transition disabled:opacity-50"
                style={{ borderColor: "rgba(13,13,13,.12)" }}
              />
              <PortalMenu position={buscaMenuPos}>
                {resultados.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => adicionar(e)}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] hover:bg-black/[.03] transition"
                  >
                    <CompanyLogo nome={e.nome} site={e.site} logo_url={e.logo_url} size={22} />
                    {e.nome}
                  </button>
                ))}
              </PortalMenu>
            </div>

            {selecionadas.length > 0 && (
              <div className="ml-auto flex items-center overflow-hidden rounded border" style={{ borderColor: "rgba(13,13,13,.12)" }}>
                {VIEW_OPTIONS.map(({ value, label }, i) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setViewMode(value)}
                    className="px-3.5 py-1.5 text-[12px] font-semibold transition"
                    style={{
                      background: viewMode === value ? "#0D0D0D" : "#fff",
                      color: viewMode === value ? "#fff" : "rgba(13,13,13,.45)",
                      borderRight: i === 0 ? "1px solid rgba(13,13,13,.12)" : undefined,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selecionadas.length > 0 && (
            <div className="mt-5">
              <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[.08em] text-black/35">Empresas em comparação</p>
              <div className="flex flex-wrap items-center gap-5">
                {selecionadas.map((e) => (
                  <div key={e.id} className="group relative flex items-center gap-2.5">
                    <CompanyLogo nome={e.nome} site={e.site} logo_url={e.logo_url} size={32} className="rounded border border-black/8" />
                    <span className="max-w-[140px] truncate text-[13px] font-medium text-black/75">{e.nome}</span>
                    <button
                      type="button"
                      onClick={() => remover(e.id)}
                      aria-label={`Remover ${e.nome} do comparativo`}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-black/25 opacity-0 transition hover:bg-black/[.06] hover:text-black/60 group-hover:opacity-100"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10">
        {selecionadas.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-8 rounded border bg-white py-20 text-center"
            style={{ borderColor: "rgba(13,13,13,.08)" }}
          >
            <div className="flex items-end justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/tamandua-esporte-tenis.webp"
                alt="Tamanduá jogando tênis"
                className="-mr-8 h-[190px] w-[190px] rotate-[-6deg] object-contain sm:h-[220px] sm:w-[220px]"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/tamandua-cultura-guitarra.webp"
                alt="Tamanduá de terno tocando guitarra"
                className="relative z-10 h-[230px] w-[230px] object-contain sm:h-[264px] sm:w-[264px]"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/tamandua-saude-medico.webp"
                alt="Tamanduá médico com prancheta"
                className="-ml-8 h-[190px] w-[190px] rotate-[6deg] object-contain sm:h-[220px] sm:w-[220px]"
              />
            </div>
            <div>
              <p className="text-[15px] font-medium text-black/60">Busque e adicione empresas para comparar</p>
              <p className="mt-1 text-[13px] text-black/35">Cultura, Esporte, Ancine e Saúde.</p>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-6 flex items-center" style={{ width: "fit-content" }}>
              <div className="group/crescbtn relative">
                <button
                  type="button"
                  onClick={() => setMetricaExtra(metricaExtra === "crescimento" ? "nenhuma" : "crescimento")}
                  className="flex items-center gap-1.5 rounded-l border px-3.5 py-1.5 text-[12px] font-semibold transition"
                  style={{
                    background: metricaExtra === "crescimento" ? "#1A8B7A" : "#fff",
                    color: metricaExtra === "crescimento" ? "#fff" : "rgba(13,13,13,.45)",
                    borderColor: metricaExtra === "crescimento" ? "#1A8B7A" : "rgba(13,13,13,.12)",
                    zIndex: metricaExtra === "crescimento" ? 10 : undefined,
                    position: "relative",
                  }}
                >
                  <ArrowUpRight size={13} strokeWidth={2.5} />
                  Expectativa de crescimento
                </button>
                <div
                  role="tooltip"
                  className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 w-max max-w-[220px] rounded bg-[#0D0D0D] px-2.5 py-1.5 text-[10px] leading-snug text-white opacity-0 shadow-lg transition group-hover/crescbtn:opacity-100"
                >
                  Tendência anual de investimento de cada empresa, estimada a partir do histórico.
                </div>
              </div>
              <div className="group/potbtn relative -ml-px">
                <button
                  type="button"
                  onClick={() => setMetricaExtra(metricaExtra === "potencial" ? "nenhuma" : "potencial")}
                  className="flex items-center gap-1.5 rounded-r border px-3.5 py-1.5 text-[12px] font-semibold transition"
                  style={{
                    background: metricaExtra === "potencial" ? "#2E8932" : "#fff",
                    color: metricaExtra === "potencial" ? "#fff" : "rgba(13,13,13,.45)",
                    borderColor: metricaExtra === "potencial" ? "#2E8932" : "rgba(13,13,13,.12)",
                    zIndex: metricaExtra === "potencial" ? 10 : undefined,
                    position: "relative",
                  }}
                >
                  <Unlock size={13} strokeWidth={2.5} />
                  Espaço no orçamento
                </button>
                <div
                  role="tooltip"
                  className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 w-max max-w-[220px] rounded bg-[#0D0D0D] px-2.5 py-1.5 text-[10px] leading-snug text-white opacity-0 shadow-lg transition group-hover/potbtn:opacity-100"
                >
                  Quanto ainda cabe no teto legal de dedução de cada empresa.
                </div>
              </div>
            </div>

            {viewMode === "cartao" && (
              <ComparativoCartoes selecionadas={selecionadas} valores={valores} potenciais={potenciais} crescimentos={crescimentos} metricaExtra={metricaExtra} loading={loadingValores} />
            )}

            {viewMode === "tabela" && (
              <div>
                {/* Cultura e Ancine compartilham o mesmo teto de 4% — uma caixa só (só
                    borda, sem fundo) as separa das demais leis, que ficam soltas. */}
                <div className="mb-8 rounded border p-6" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <div>
                    <h2 className="mb-5 text-[11px] font-bold uppercase tracking-[.08em] text-black/35">Cultura</h2>
                    <div className="flex flex-col gap-5">{renderLeiRows("cultura")}</div>
                  </div>
                  <div className="mt-6">
                    <h2 className="mb-5 text-[11px] font-bold uppercase tracking-[.08em] text-black/35">Ancine</h2>
                    <div className="flex flex-col gap-5">{renderLeiRows("ancine")}</div>
                  </div>
                </div>

                <div className="pb-8">
                  <h2 className="mb-5 text-[11px] font-bold uppercase tracking-[.08em] text-black/35">Esporte</h2>
                  <div className="flex flex-col gap-5">{renderLeiRows("esporte")}</div>
                </div>

                <div className="border-t pb-8 pt-8" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                  <h2 className="mb-5 text-[11px] font-bold uppercase tracking-[.08em] text-black/35">Saúde</h2>
                  <div className="flex flex-col gap-5">{renderLeiRows("saude")}</div>
                </div>

                <div className="flex flex-col gap-3 border-t py-6 sm:flex-row sm:items-center sm:gap-6" style={{ borderColor: "rgba(13,13,13,.1)" }}>
                  <div className="w-full shrink-0 text-[11px] font-bold uppercase tracking-[.08em] text-black/45 sm:w-[22%]">
                    Total 2025
                  </div>
                  <div className="flex flex-1 flex-wrap gap-x-8 gap-y-2 sm:justify-end">
                    {selecionadas.map((e) => (
                      <div key={e.id} className="flex items-baseline gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: colorFrom(e.nome) }} />
                        <span className="text-[13px] font-medium text-black/50">{e.nome}</span>
                        <span className="text-[16px] font-bold tabular-nums text-black/90">
                          {loadingValores ? "…" : fmt(totalPorEmpresa(e.id))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ComparativoCartoes({ selecionadas, valores, potenciais, crescimentos, metricaExtra, loading }: { selecionadas: EmpresaOption[]; valores: Valores; potenciais: Record<string, Record<Lei, Potencial>>; crescimentos: Record<string, Partial<Record<Lei, Crescimento>>>; metricaExtra: MetricaExtra; loading: boolean }) {
  const max = Math.max(1, ...selecionadas.flatMap((e) => LEIS.map(({ key }) => valores[e.id]?.[key] ?? 0)));
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [modal, setModal] = useState<{ tipo: "prospect" | "captacao" | "inscricao"; empresa: EmpresaOption } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAberto) return;
    function onClickFora(ev: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) setMenuAberto(null);
    }
    document.addEventListener("mousedown", onClickFora);
    return () => document.removeEventListener("mousedown", onClickFora);
  }, [menuAberto]);

  function abrirAcao(tipo: "prospect" | "captacao" | "inscricao", empresa: EmpresaOption) {
    setModal({ tipo, empresa });
    setMenuAberto(null);
  }

  // Grid com número de colunas = qtd. de empresas (até 4) — cada card encolhe conforme mais
  // são adicionadas, sempre cabendo até 4 por linha (a 5ª quebra pra uma segunda linha).
  const colsClass = GRID_COLS[Math.min(selecionadas.length, 4)] ?? "sm:grid-cols-4";

  return (
    <>
    <div className={`grid grid-cols-1 gap-5 ${colsClass}`}>
      {selecionadas.map((e) => {
        const cor = colorFrom(e.nome);
        const total = LEIS.reduce((acc, { key }) => acc + (valores[e.id]?.[key] ?? 0), 0);
        const linha = (key: Lei, label: string) => {
          const valor = valores[e.id]?.[key] ?? 0;
          const { valorEfetivo, potencial, potencialSemCultura } = potenciais[e.id]?.[key] ?? { valorEfetivo: 0, potencial: 0 };
          return (
            <div key={key}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-black/40">{label}</span>
                <span className="text-[15px] font-semibold tabular-nums text-black/80">{loading ? "…" : fmt(valor)}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-black/[.05]">
                <div
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((valor / max) * 100)}%`, background: cor }}
                />
              </div>
              {!loading && metricaExtra !== "nenhuma" && (
                <div className="mt-1.5 flex justify-end">
                  {metricaExtra === "crescimento" && <CrescimentoTag crescimento={crescimentos[e.id]?.[key]} valor={valor} />}
                  {metricaExtra === "potencial" && <PotencialTag lei={key} potencial={potencial} valorEfetivo={valorEfetivo} potencialSemCultura={potencialSemCultura} />}
                </div>
              )}
            </div>
          );
        };
        return (
          <div
            key={e.id}
            className="relative cursor-default rounded border p-7 transition hover:shadow-md"
            style={{
              borderColor: "rgba(13,13,13,.08)",
              borderTop: `3px solid ${cor}`,
              background: "linear-gradient(145deg, #ffffff 0%, #f7f7f6 100%)",
            }}
          >
            <div ref={menuAberto === e.id ? menuRef : null} className="absolute right-3 top-3">
              <button
                type="button"
                onClick={() => setMenuAberto(menuAberto === e.id ? null : e.id)}
                aria-label={`Mais ações para ${e.nome}`}
                className="flex h-7 w-7 items-center justify-center rounded text-black/30 transition hover:bg-black/[.05] hover:text-black/60"
              >
                <MoreHorizontal size={16} />
              </button>
              {menuAberto === e.id && (
                <div
                  className="absolute right-0 top-8 z-20 w-[190px] rounded border bg-white py-1 shadow-[0_12px_32px_rgba(13,13,13,.12)]"
                  style={{ borderColor: "rgba(13,13,13,.08)" }}
                >
                  <button
                    type="button"
                    onClick={() => abrirAcao("prospect", e)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] font-medium text-black/70 transition hover:bg-black/[.04]"
                  >
                    <Briefcase size={13} className="text-black/40" /> Criar prospect
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirAcao("captacao", e)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] font-medium text-black/70 transition hover:bg-black/[.04]"
                  >
                    <UsersRound size={13} className="text-black/40" /> Nova negociação
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirAcao("inscricao", e)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] font-medium text-black/70 transition hover:bg-black/[.04]"
                  >
                    <Globe size={13} className="text-black/40" /> Nova inscrição
                  </button>
                </div>
              )}
            </div>

            <div className="mb-5 flex flex-col items-center gap-3 text-center">
              <CompanyLogo
                nome={e.nome}
                site={e.site}
                logo_url={e.logo_url}
                size={72}
                className="rounded border border-black/8 p-1"
              />
              <div>
                <span className="text-[16px] font-semibold text-black/85">{e.nome}</span>
                <div className="mt-1 text-[22px] font-semibold leading-none tabular-nums text-black/90">
                  {loading ? "…" : fmt(total)}
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-black/30">Total 2025</span>
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-4 rounded border p-3.5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              {linha("cultura", "Cultura")}
              {linha("ancine", "Ancine")}
            </div>
            <div className="flex flex-col gap-4">
              {linha("esporte", "Esporte")}
              {linha("saude", "Saúde")}
            </div>
          </div>
        );
      })}
    </div>

    {modal?.tipo === "prospect" && (
      <NovoProspectModal
        nomePreEmpresa={modal.empresa.nome}
        dominioPreEmpresa={modal.empresa.site ?? undefined}
        empresaPubId={modal.empresa.id}
        onClose={() => setModal(null)}
        onSaved={() => setModal(null)}
      />
    )}
    {modal?.tipo === "captacao" && (
      <NovaCaptacaoModal
        nomePreEmpresa={modal.empresa.nome}
        empresaPubId={modal.empresa.id}
        onClose={() => setModal(null)}
        onSaved={() => setModal(null)}
      />
    )}
    {modal?.tipo === "inscricao" && (
      <NovaInscricaoModal
        nomePreEmpresa={modal.empresa.nome}
        empresaPubId={modal.empresa.id}
        onClose={() => setModal(null)}
        onSaved={() => setModal(null)}
      />
    )}
    </>
  );
}

export default function ComparativoPage() {
  return (
    <Suspense fallback={<div className="min-h-[360px] animate-pulse bg-black/[.015]" />}>
      <ComparativoContent />
    </Suspense>
  );
}
