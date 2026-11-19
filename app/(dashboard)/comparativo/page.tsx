"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, Lock, Unlock, MoreHorizontal, Building2, BriefcaseBusiness, FilePenLine, ArrowUpRight, ArrowRight, GitCompareArrows, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ListEmptyState, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { TituloComFrase } from "@/components/list/TituloComFrase";
import { BarrasDeValor } from "@/components/comparativo/BarrasDeValor";
import { BuscarEmpresa } from "@/components/comparativo/BuscarEmpresa";
import { usePersistedViewMode } from "@/components/ui/EntityViewSwitcher";
import { colorFrom } from "@/lib/colorFrom";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";
import { NovoProspectModal } from "@/components/modals/NovoProspectModal";
import { NovaCaptacaoModal } from "@/components/modals/NovaCaptacaoModal";
import { NovaInscricaoModal } from "@/components/modals/NovaInscricaoModal";
import { AcessoContatosModal } from "@/components/modals/AcessoContatosModal";

type EmpresaOption = { id: string; nome: string; site: string | null; logo_url: string | null };
type Lei = "cultura" | "ancine" | "esporte" | "saude";
type Valores = Record<string, Partial<Record<Lei, number>>>;
type Potencial = { valorEfetivo: number; potencial: number; potencialRealocado?: number };
type Crescimento = { taxaAnual: number; confianca: "individual" | "parcial" | "setor" };

// Exemplo do estado vazio: três clássicos brasileiros que já fecharam as portas, com valores inventados e as
// marcas de verdade (Matarazzo, a mesma da landing; Mappin e Varig, em domínio público na Wikimedia Commons).
// Aparece ao fundo, atrás do cartão com o botão, só para mostrar como fica a comparação: em cinza grafite
// pastel (sem cor, contraste reduzido, meio apagado) e o cartão por cima é levemente translúcido.
const EXEMPLO_EMPRESAS: EmpresaOption[] = [
  { id: "exemplo-mappin", nome: "Mappin", site: null, logo_url: "/assets/exemplo-mappin.svg" },
  { id: "exemplo-matarazzo", nome: "Indústrias Reunidas Fábricas Matarazzo", site: null, logo_url: "/assets/matarazzo.svg" },
  { id: "exemplo-varig", nome: "Varig", site: null, logo_url: "/assets/exemplo-varig.svg" },
];
const EXEMPLO_VALORES: Valores = {
  "exemplo-mappin": { cultura: 1_200_000, esporte: 350_000 },
  "exemplo-matarazzo": { cultura: 1_800_000, saude: 240_000 },
  "exemplo-varig": { cultura: 2_400_000, ancine: 600_000 },
};

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
  const culturaValor = valoresEmpresa.cultura ?? 0;
  const ancineValor = valoresEmpresa.ancine ?? 0;
  const culturaAncine = culturaValor + ancineValor;
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
  // Dentro do bloco combinado, quem investe MENOS dos dois ganha o indicador de realocação
  // (quanto teria se o outro cedesse todo o espaço que ocupa) — não é sempre a Cultura: se o
  // Ancine é quem consome o teto compartilhado, é a Cultura que fica com pouco investimento
  // e deveria mostrar o realocado, não o contrário.
  if (culturaValor <= ancineValor) {
    resultado.cultura.potencialRealocado = Math.max(0, TETO_PCT.cultura * baseSegura - culturaValor);
  } else {
    resultado.ancine.potencialRealocado = Math.max(0, TETO_PCT.ancine * baseSegura - ancineValor);
  }
  return resultado;
}

// Cada selo é número + legenda curta embaixo (mesmo padrão de "TOTAL 2025"), pra ser lido sem
// precisar decorar ícone ou cor — e cada um fica plantado num canto diferente da linha (ver
// pontos de uso), pra não parecerem duas variações da mesma coisa.
function PotencialTag({ lei, potencial, valorEfetivo, potencialRealocado }: { lei: Lei; potencial: number; valorEfetivo: number; potencialRealocado?: number }) {
  if (potencialRealocado !== undefined) {
    if (potencialRealocado <= 0) return null;
    const outra = lei === "cultura" ? "Ancine" : "Cultura";
    return (
      <div
        className="flex flex-col items-end gap-0.5"
        title={`+${formatarValorCompleto(potencialRealocado)} · Espaço estimado se ${outra} cedesse todo o espaço que ocupa no teto compartilhado (realocação, não soma com o potencial normal)`}
      >
        <div className="flex items-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold tabular-nums text-[#282525]">
          <ArrowRight size={12} strokeWidth={1.75} className="shrink-0 text-black/40" aria-hidden="true" />
          +{formatarValorCurto(potencialRealocado)}
        </div>
        <span className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Potencial realocado</span>
      </div>
    );
  }
  if (potencial > 0) {
    return (
      <div
        className="flex flex-col items-end gap-0.5"
        title={`+${formatarValorCompleto(potencial)} · Espaço estimado até o teto legal de dedução${lei === "esporte" ? " (considerando o teto de 2% de projeto geral — pode ser maior, até 4%, se for inclusão social)" : ""}`}
      >
        <div className="flex items-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold tabular-nums text-[#282525]">
          <Unlock size={12} strokeWidth={1.75} className="shrink-0 text-black/40" aria-hidden="true" />
          +{formatarValorCurto(potencial)}
        </div>
        <span className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Potencial</span>
      </div>
    );
  }
  if (valorEfetivo > 0) {
    return (
      <div
        className="flex items-center gap-1 whitespace-nowrap text-[0.75rem] font-medium text-black/60"
        title="Valor já está no teto legal estimado"
      >
        <Lock size={12} strokeWidth={1.75} className="shrink-0 text-black/40" aria-hidden="true" />
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
      title={`${positivo ? "+" : "-"}${formatarValorCompleto(valorNominal)} · Crescimento anual estimado${confianca === "setor" ? " (baseado no setor — empresa tem pouco histórico próprio)" : ""}`}
    >
      <div className={`flex items-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold tabular-nums ${positivo ? "text-[#282525]" : "text-black/45"}`}>
        {positivo ? "+" : "-"}
        {Math.round(Math.abs(taxaAnual) * 100)}%
        <ArrowRight size={10} strokeWidth={2.5} className="shrink-0 text-black/25" aria-hidden="true" />
        {positivo ? "+" : "-"}
        {formatarValorCurto(valorNominal)}
      </div>
      <span className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">
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
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [buscandoEmpresas, setBuscandoEmpresas] = useState(false);
  const [resultados, setResultados] = useState<EmpresaOption[]>([]);
  const [valores, setValores] = useState<Valores>({});
  const [crescimentos, setCrescimentos] = useState<Record<string, Partial<Record<Lei, Crescimento>>>>({});
  const [loadingValores, setLoadingValores] = useState(false);
  const [limiteAtingido, setLimiteAtingido] = useState(false);
  const [viewMode, setViewMode] = usePersistedViewMode<ViewMode>("jards:comparativo:view", VIEW_MODES, "tabela");
  const [metricaExtra, setMetricaExtra] = usePersistedViewMode<MetricaExtra>("jards:comparativo:metrica", METRICA_EXTRA_MODES, "nenhuma");


  // Hidrata a seleção a partir da URL (?empresas=id1,id2) uma única vez.
  useEffect(() => {
    const ids = searchParams.get("empresas")?.split(",").filter(Boolean) ?? [];
    if (ids.length === 0) { setHidratado(true); return; }
    supabase.from("empresas").select("id, nome, site, logo_url").in("id", ids).then(async ({ data }) => {
      const linhas = (data ?? []) as EmpresaOption[];
      const porId = new Map(linhas.map((e) => [e.id, e]));
      const doLink = ids.map((id) => porId.get(id)).filter((e): e is EmpresaOption => !!e);
      const bloqueadas = await registrarComparacoes(doLink.map((e) => e.id));
      if (bloqueadas.size > 0) setLimiteAtingido(true);
      setSelecionadas(doLink.filter((e) => !bloqueadas.has(e.id)));
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
    if (busca.trim().length < 2) { setResultados([]); setBuscandoEmpresas(false); return; }
    setBuscandoEmpresas(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("empresas")
        .select("id, nome, site, logo_url")
        .ilike("nome", `%${busca.trim()}%`)
        .limit(8);
      const jaSelecionadas = new Set(selecionadas.map((e) => e.id));
      setResultados(((data ?? []) as EmpresaOption[]).filter((e) => !jaSelecionadas.has(e.id)));
      setBuscandoEmpresas(false);
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

  // Conta cada empresa nova no limite do plano gratuito e devolve as que ficaram de fora.
  // Quem decide é o banco (plano pago nunca é barrado); se a chamada falhar, não travamos
  // o usuário por um problema nosso.
  async function registrarComparacoes(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("fn_registrar_comparacoes", { p_empresa_ids: ids });
    if (error) {
      console.error("Erro ao registrar comparação:", error.message);
      return new Set();
    }
    return new Set<string>(data?.bloqueadas ?? []);
  }

  async function adicionar(empresa: EmpresaOption) {
    if (selecionadas.length >= MAX_EMPRESAS) return;
    const bloqueadas = await registrarComparacoes([empresa.id]);
    if (bloqueadas.has(empresa.id)) {
      setLimiteAtingido(true);
      return;
    }
    // O clique é assíncrono agora: dois cliques seguidos não podem duplicar a empresa nem furar o máximo.
    setSelecionadas((prev) => (prev.length >= MAX_EMPRESAS || prev.some((e) => e.id === empresa.id) ? prev : [...prev, empresa]));
    setBusca("");
    setResultados([]);
    setBuscaAberta(false);
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
      const { valorEfetivo, potencial, potencialRealocado } = potenciais[e.id]?.[key] ?? { valorEfetivo: 0, potencial: 0 };
      return (
        <div key={e.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex w-full shrink-0 items-center gap-3 sm:w-[22%]">
            <CompanyLogo nome={e.nome} site={e.site} logo_url={e.logo_url} size={30} className="rounded border border-black/8" />
            <span className="truncate text-[0.875rem] font-medium text-black/70">{e.nome}</span>
          </div>
          <div className="min-w-0 flex-1">
            <BarrasDeValor valor={valor} max={max} cor={colorFrom(e.nome)} total={32} altura="h-5" />
          </div>
          <div className="w-full shrink-0 text-right sm:w-[24%]">
            <div
              title={loadingValores ? undefined : formatarValorCompleto(valor)}
              className={`text-[1.25rem] font-semibold leading-none tabular-nums ${loadingValores || !valor ? "text-black/30" : "text-[#282525]"}`}
            >
              {loadingValores ? "…" : formatarValorCurto(valor)}
            </div>
            {!loadingValores && metricaExtra !== "nenhuma" && (
              <div className="mt-1.5 flex justify-end">
                {metricaExtra === "crescimento" && <CrescimentoTag crescimento={crescimentos[e.id]?.[key]} valor={valor} />}
                {metricaExtra === "potencial" && <PotencialTag lei={key} potencial={potencial} valorEfetivo={valorEfetivo} potencialRealocado={potencialRealocado} />}
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
        <div className="mx-auto max-w-pagina px-4 pb-7 pt-8 sm:px-6 lg:px-10 lg:pb-9">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <TituloComFrase secao="comparativo" titulo="Comparativo de investimento" />
            {selecionadas.length > 0 && <PrimaryListAction onClick={() => setBuscaAberta(true)} disabled={selecionadas.length >= MAX_EMPRESAS}><Plus size={13} aria-hidden="true" /> Adicionar empresa</PrimaryListAction>}
          </div>

          {selecionadas.length > 0 && (
            <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-2.5 text-[0.625rem] font-bold uppercase tracking-[.08em] text-black/35">Empresas em comparação</p>
                <div className="flex flex-wrap items-center gap-5">
                  {selecionadas.map((e) => (
                    <div key={e.id} className="group relative flex items-center gap-2.5">
                      <CompanyLogo nome={e.nome} site={e.site} logo_url={e.logo_url} size={32} className="rounded border border-black/8" />
                      <span className="max-w-[8.75rem] truncate text-[0.8125rem] font-medium text-black/75">{e.nome}</span>
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
              <div className="flex items-center overflow-hidden rounded border" style={{ borderColor: "rgba(13,13,13,.12)" }}>
                {VIEW_OPTIONS.map(({ value, label }, i) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setViewMode(value)}
                    className="px-3.5 py-1.5 text-[0.75rem] font-semibold transition"
                    style={{
                      background: viewMode === value ? "#684DB0" : "#fff",
                      color: viewMode === value ? "#fff" : "rgba(13,13,13,.45)",
                      borderRight: i === 0 ? "1px solid rgba(13,13,13,.12)" : undefined,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-pagina px-4 py-8 sm:px-6 lg:px-10">
        {selecionadas.length === 0 ? (
          <div className="relative">
            <div aria-hidden="true" inert className="pointer-events-none select-none opacity-50 grayscale contrast-[.8]">
              <ComparativoCartoes
                selecionadas={EXEMPLO_EMPRESAS}
                valores={EXEMPLO_VALORES}
                potenciais={Object.fromEntries(EXEMPLO_EMPRESAS.map((empresa) => [empresa.id, calcularPotencial(EXEMPLO_VALORES[empresa.id] ?? {})]))}
                crescimentos={{}}
                metricaExtra="nenhuma"
                loading={false}
              />
            </div>
            <div className="absolute inset-0 flex items-start justify-center px-2 pt-10 sm:items-center sm:pt-0">
              <div className="w-full max-w-md rounded border bg-white/90 backdrop-blur-[2px] elevacao-2">
                <ListEmptyState
                  icon={GitCompareArrows}
                  title="Busque e adicione empresas para comparar"
                  description="Enquanto isso, três clássicos posam de exemplo."
                  action={<PrimaryListAction onClick={() => setBuscaAberta(true)}><Plus size={13} aria-hidden="true" /> Adicionar empresa</PrimaryListAction>}
                />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-6 flex items-center" style={{ width: "fit-content" }}>
              <div className="group/crescbtn relative">
                <button
                  type="button"
                  onClick={() => setMetricaExtra(metricaExtra === "crescimento" ? "nenhuma" : "crescimento")}
                  className="flex items-center gap-1.5 rounded-l border px-3.5 py-1.5 text-[0.75rem] font-semibold transition"
                  style={{
                    background: metricaExtra === "crescimento" ? "#684DB0" : "#fff",
                    color: metricaExtra === "crescimento" ? "#fff" : "rgba(13,13,13,.45)",
                    borderColor: metricaExtra === "crescimento" ? "#684DB0" : "rgba(13,13,13,.12)",
                    zIndex: metricaExtra === "crescimento" ? 10 : undefined,
                    position: "relative",
                  }}
                >
                  <ArrowUpRight size={13} strokeWidth={2.5} />
                  Expectativa de crescimento
                </button>
                <div
                  role="tooltip"
                  className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 w-max max-w-[13.75rem] rounded bg-[#1C0E33] px-2.5 py-1.5 text-[0.625rem] leading-snug text-white opacity-0 shadow-lg transition group-hover/crescbtn:opacity-100"
                >
                  Tendência anual de investimento de cada empresa, estimada a partir do histórico.
                </div>
              </div>
              <div className="group/potbtn relative -ml-px">
                <button
                  type="button"
                  onClick={() => setMetricaExtra(metricaExtra === "potencial" ? "nenhuma" : "potencial")}
                  className="flex items-center gap-1.5 rounded-r border px-3.5 py-1.5 text-[0.75rem] font-semibold transition"
                  style={{
                    background: metricaExtra === "potencial" ? "#684DB0" : "#fff",
                    color: metricaExtra === "potencial" ? "#fff" : "rgba(13,13,13,.45)",
                    borderColor: metricaExtra === "potencial" ? "#684DB0" : "rgba(13,13,13,.12)",
                    zIndex: metricaExtra === "potencial" ? 10 : undefined,
                    position: "relative",
                  }}
                >
                  <Unlock size={13} strokeWidth={2.5} />
                  Espaço no orçamento
                </button>
                <div
                  role="tooltip"
                  className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 w-max max-w-[13.75rem] rounded bg-[#1C0E33] px-2.5 py-1.5 text-[0.625rem] leading-snug text-white opacity-0 shadow-lg transition group-hover/potbtn:opacity-100"
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
                {LEIS.map(({ key, label }, i) => (
                  <div key={key} className={`py-8 ${i > 0 ? "border-t" : ""}`} style={{ borderColor: "rgba(13,13,13,.07)" }}>
                    <h2 className="mb-5 text-[0.6875rem] font-bold uppercase tracking-[.08em] text-black/35">{label}</h2>
                    <div className="flex flex-col gap-5">{renderLeiRows(key)}</div>
                  </div>
                ))}

                <div className="flex flex-col gap-3 border-t py-6 sm:flex-row sm:items-center sm:gap-6" style={{ borderColor: "rgba(13,13,13,.1)" }}>
                  <div className="w-full shrink-0 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45 sm:w-[22%]">
                    Total 2025
                  </div>
                  <div className="flex flex-1 flex-wrap gap-x-8 gap-y-2 sm:justify-end">
                    {selecionadas.map((e) => (
                      <div key={e.id} className="flex items-baseline gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: colorFrom(e.nome) }} />
                        <span className="text-[0.8125rem] font-medium text-black/50">{e.nome}</span>
                        <span
                          title={loadingValores ? undefined : formatarValorCompleto(totalPorEmpresa(e.id))}
                          className={`text-[1rem] font-semibold tabular-nums ${loadingValores || !totalPorEmpresa(e.id) ? "text-black/30" : "text-[#282525]"}`}
                        >
                          {loadingValores ? "…" : formatarValorCurto(totalPorEmpresa(e.id))}
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

      {buscaAberta && (
        <BuscarEmpresa
          busca={busca}
          onBusca={setBusca}
          resultados={resultados}
          buscando={buscandoEmpresas}
          onAdicionar={adicionar}
          onClose={() => { setBuscaAberta(false); setBusca(""); setResultados([]); }}
        />
      )}

      {limiteAtingido && (
        <AcessoContatosModal
          variant="limite_comparacoes"
          onClose={() => setLimiteAtingido(false)}
          onPrimary={() => {
            setLimiteAtingido(false);
            router.push("/meu-plano?acao=assinar");
          }}
        />
      )}
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
          const { valorEfetivo, potencial, potencialRealocado } = potenciais[e.id]?.[key] ?? { valorEfetivo: 0, potencial: 0 };
          return (
            <div key={key}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{label}</span>
                <span
                  title={loading ? undefined : formatarValorCompleto(valor)}
                  className={`text-[0.9375rem] font-semibold tabular-nums ${loading || !valor ? "text-black/30" : "text-[#282525]"}`}
                >
                  {loading ? "…" : formatarValorCurto(valor)}
                </span>
              </div>
              <BarrasDeValor valor={valor} max={max} cor={cor} total={20} altura="h-3.5" />
              {!loading && metricaExtra !== "nenhuma" && (
                <div className="mt-1.5 flex justify-end">
                  {metricaExtra === "crescimento" && <CrescimentoTag crescimento={crescimentos[e.id]?.[key]} valor={valor} />}
                  {metricaExtra === "potencial" && <PotencialTag lei={key} potencial={potencial} valorEfetivo={valorEfetivo} potencialRealocado={potencialRealocado} />}
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
                  className="absolute right-0 top-8 z-20 w-[11.875rem] rounded bg-white py-1 border elevacao-1"
                  style={{ borderColor: "rgba(13,13,13,.08)" }}
                >
                  <button
                    type="button"
                    onClick={() => abrirAcao("prospect", e)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[0.78125rem] font-medium text-black/70 transition hover:bg-black/[.04]"
                  >
                    <Building2 size={13} className="text-black/40" aria-hidden="true" /> Novo prospect
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirAcao("captacao", e)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[0.78125rem] font-medium text-black/70 transition hover:bg-black/[.04]"
                  >
                    <BriefcaseBusiness size={13} className="text-black/40" aria-hidden="true" /> Nova negociação
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirAcao("inscricao", e)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[0.78125rem] font-medium text-black/70 transition hover:bg-black/[.04]"
                  >
                    <FilePenLine size={13} className="text-black/40" aria-hidden="true" /> Nova inscrição
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
                <span className="text-[1rem] font-semibold text-black/85">{e.nome}</span>
                <div
                  title={loading ? undefined : formatarValorCompleto(total)}
                  className={`mt-1 text-[1.375rem] font-semibold leading-none tabular-nums ${loading || !total ? "text-black/30" : "text-[#282525]"}`}
                >
                  {loading ? "…" : formatarValorCurto(total)}
                </div>
                <span className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Total 2025</span>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {linha("cultura", "Cultura")}
              {linha("ancine", "Ancine")}
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
        sitePreEmpresa={modal.empresa.site ?? undefined}
        empresaPubId={modal.empresa.id}
        onClose={() => setModal(null)}
        onSaved={() => setModal(null)}
      />
    )}
    {modal?.tipo === "inscricao" && (
      <NovaInscricaoModal
        nomePreEmpresa={modal.empresa.nome}
        sitePreEmpresa={modal.empresa.site ?? undefined}
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
    <Suspense fallback={<div className="min-h-[22.5rem] animate-pulse bg-black/[.015]" />}>
      <ComparativoContent />
    </Suspense>
  );
}
