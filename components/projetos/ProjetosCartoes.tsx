"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Calendar, TrendingUp, Zap, FileText, Check, MoreHorizontal, ExternalLink, Trash2, UserX } from "lucide-react";
import { ProjectIdentity, corDaIdentidade, type IdentityType } from "@/components/ui/ProjectIdentity";
import { AnchoredPopover, useAnchoredPopover } from "@/components/ui/AnchoredPopover";
import { BarraCaptacao } from "@/components/ui/IndicadoresFinanceiros";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";
import { posicaoNaPasta } from "@/lib/projetos/capa";

export type FaseProjeto = "planejamento" | "captacao" | "execucao" | "prestacao" | "concluido";

/** Fases do projeto: as mesmas na tabela, no filtro e nos cartões. */
export const FASES_PROJETO = [
  { key: "planejamento", label: "Planejamento", color: "#6B7280", Icon: Calendar },
  { key: "captacao", label: "Captação", color: "#7259B5", Icon: TrendingUp },
  { key: "execucao", label: "Execução", color: "#2D72B0", Icon: Zap },
  { key: "prestacao", label: "Prestação", color: "#B07A14", Icon: FileText },
  { key: "concluido", label: "Concluído", color: "#2E8932", Icon: Check },
] as const;

export type ProjetoCartao = {
  id: string;
  nome: string;
  proponente_nome: string | null;
  identidade_tipo: IdentityType;
  identidade_valor: string | null;
  identidade_logo_url: string | null;
  identidade_cor: string | null;
  /** Capa do projeto (imagem); aparece guardada dentro da pasta, atrás da folha da frente. */
  capa_url?: string | null;
  capa_position_y?: number | null;
  valor_alvo: number | null;
  valor_captado: number;
  fase_codigo: FaseProjeto;
  ponto_focal: string | null;
  ultima_atualizacao: string;
};

export function fmtAtualizacao(value: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 30) return `${days} dias atrás`;
  return new Date(value).toLocaleDateString("pt-BR");
}

function iniciais(nome: string) {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  return (palavras.length > 1 ? `${palavras[0][0]}${palavras[1][0]}` : palavras[0]?.slice(0, 2) || "?").toUpperCase();
}

/**
 * Tons da pasta a partir da cor do ícone do projeto: o verso (aba e fundo) no
 * tom claro da cor e a folha da frente quase branca, onde ficam o ícone na cor
 * e o texto em tinta. Com logo, emoji ou sem ícone, cinza neutro.
 */
function tonsDaPasta(cor: string | null): CSSProperties {
  if (!cor) return { "--pasta-verso": "#E4E3DF", "--pasta-frente": "#F5F5F3" } as CSSProperties;
  return {
    "--pasta-verso": `color-mix(in srgb, ${cor} 24%, #fff)`,
    "--pasta-frente": `color-mix(in srgb, ${cor} 4%, #fff)`,
  } as CSSProperties;
}

const ALTURA_ABA = "0.875rem";

function CapaNaPasta({ url, posicaoY }: { url: string; posicaoY: number }) {
  const imagem = useRef<HTMLImageElement>(null);
  const [posicao, setPosicao] = useState(posicaoY);
  const ajustar = () => {
    const img = imagem.current;
    const caixa = img?.getBoundingClientRect();
    if (!img || !img.naturalWidth || !img.naturalHeight || !caixa?.width || !caixa.height) return;
    setPosicao(posicaoNaPasta(posicaoY, img.naturalWidth / img.naturalHeight, caixa.width / caixa.height));
  };
  // a imagem pode já ter carregado antes do React ligar o onLoad (vem embutida)
  useEffect(() => {
    if (imagem.current?.complete) ajustar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, posicaoY]);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a capa é guardada como imagem embutida (data URL)
    <img ref={imagem} src={url} alt="" onLoad={ajustar} className="h-full w-full object-cover" style={{ objectPosition: `center ${posicao}%` }} />
  );
}
const LARGURA_ABA = "44%";

function Pasta({ projeto, faseLabel, onOpen, onMenu }: {
  projeto: ProjetoCartao;
  faseLabel: string;
  onOpen: () => void;
  onMenu: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  const meta = projeto.valor_alvo && projeto.valor_alvo > 0 ? projeto.valor_alvo : null;
  const pct = meta ? Math.round((projeto.valor_captado / meta) * 100) : null;
  const captado = projeto.valor_captado > 0;

  return (
    <article className="group relative h-full" style={tonsDaPasta(projeto.identidade_tipo === "icone" ? corDaIdentidade(projeto.identidade_cor) : null)}>
      {/* a pasta inteira abre o projeto; o conteúdo deixa o clique passar */}
      <button type="button" onClick={onOpen} aria-label={`Abrir ${projeto.nome}`} className="peer absolute inset-0 z-0 cursor-pointer rounded outline-none" />

      {/* silhueta da pasta (aba + verso + folha); o contorno de foco segue a forma toda */}
      <div className="pointer-events-none relative flex h-full flex-col transition-[filter] peer-focus-visible:[filter:drop-shadow(2px_0_0_#7259B5)_drop-shadow(-2px_0_0_#7259B5)_drop-shadow(0_2px_0_#7259B5)_drop-shadow(0_-2px_0_#7259B5)]" style={{ paddingTop: ALTURA_ABA }}>
      {/* aba e o canto interno arredondado que a liga ao verso */}
      <span aria-hidden className="pointer-events-none absolute left-0 top-0 rounded-t bg-[var(--pasta-verso)]" style={{ height: ALTURA_ABA, width: LARGURA_ABA }} />
      <span aria-hidden className="pointer-events-none absolute h-1 w-1" style={{ left: LARGURA_ABA, top: `calc(${ALTURA_ABA} - 4px)`, background: "radial-gradient(circle at 100% 0, transparent 4px, var(--pasta-verso) 4.5px)" }} />

      <div className="relative flex flex-1 flex-col rounded rounded-tl-none bg-[var(--pasta-verso)] pt-[0.375rem]">
        {/* capa: foto guardada dentro da pasta, aparecendo por cima da folha da frente; sobe um pouco ao passar o mouse */}
        {projeto.capa_url && (
          <div aria-hidden className="relative mx-1.5 h-[5.5rem] overflow-hidden rounded-t transition-transform duration-200 ease-out group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
            <CapaNaPasta url={projeto.capa_url} posicaoY={projeto.capa_position_y ?? 50} />
          </div>
        )}
        {/* folha da frente: sobe um pouco ao passar o mouse, como papel saindo da pasta */}
        <div className={`relative flex flex-1 flex-col rounded bg-[var(--pasta-frente)] ${projeto.capa_url ? "-mt-3" : ""} px-4 pb-3.5 pt-3.5 shadow-[0_1px_2px_rgba(13,13,13,.05)] transition-transform duration-200 ease-out group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0`}>
          <div className="flex items-start justify-between gap-3">
            <ProjectIdentity nome={projeto.nome} tipo={projeto.identidade_tipo} valor={projeto.identidade_valor} logoUrl={projeto.identidade_logo_url} cor={projeto.identidade_cor} size="sm" />
            <button
              type="button"
              onClick={onMenu}
              aria-label={`Ações de ${projeto.nome}`}
              aria-haspopup="menu"
              title="Ações"
              className="pointer-events-auto relative z-10 -mr-1.5 -mt-1 flex h-7 w-7 items-center justify-center rounded text-black/40 transition hover:bg-black/[.05] hover:text-[#282525] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5]"
            >
              <MoreHorizontal size={15} />
            </button>
          </div>

          <h3 className="mt-3 line-clamp-2 text-[0.9375rem] font-semibold leading-[1.3] tracking-[-.01em] text-[#282525] [text-wrap:balance]">{projeto.nome}</h3>
          <p className="mt-1 truncate text-[0.6875rem] text-black/45">{projeto.proponente_nome ?? "Sem proponente"}</p>

          <div className="mt-auto pt-4">
            {meta ? (
              <div title={`${formatarValorCompleto(projeto.valor_captado)} captados de ${formatarValorCompleto(meta)}`}>
                <BarraCaptacao confirmado={projeto.valor_captado} meta={meta} className="h-1.5" />
                <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[0.6875rem] tabular-nums">
                  <span className={`font-semibold ${captado ? "text-[#282525]" : "text-black/30"}`}>{formatarValorCurto(projeto.valor_captado)}</span>
                  <span className="truncate text-black/45">{pct}% de {formatarValorCurto(meta)}</span>
                </div>
              </div>
            ) : (
              <p className="flex h-[1.875rem] items-end text-[0.6875rem] text-black/35">Sem objetivo financeiro</p>
            )}

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/[.07] pt-3">
              <div className="flex min-w-0 items-center gap-2">
                {projeto.ponto_focal ? (
                  <span className="flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full bg-white text-[0.5625rem] font-semibold text-black/55 ring-1 ring-black/[.08]" aria-hidden>{iniciais(projeto.ponto_focal)}</span>
                ) : (
                  <span className="flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full border border-dashed border-black/20 text-black/30" aria-hidden><UserX size={11} /></span>
                )}
                <span className={`truncate text-[0.6875rem] ${projeto.ponto_focal ? "text-black/55" : "text-black/35"}`}>{projeto.ponto_focal ?? "Sem ponto focal"}</span>
              </div>
              <span className="shrink-0 text-[0.6875rem] text-black/45" title={`Atualizado: ${fmtAtualizacao(projeto.ultima_atualizacao)}`}>{faseLabel}</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </article>
  );
}

function PastaEsqueleto() {
  return (
    <div className="relative" style={{ paddingTop: ALTURA_ABA }} aria-hidden>
      <span className="absolute left-0 top-0 rounded-t bg-black/[.05]" style={{ height: ALTURA_ABA, width: LARGURA_ABA }} />
      <div className="h-[12.5rem] animate-pulse rounded rounded-tl-none bg-black/[.05] motion-reduce:animate-none" />
    </div>
  );
}

export function ProjetosCartoes({ projetos, carregando, onOpen, onDelete }: {
  projetos: ProjetoCartao[];
  carregando: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string, nome: string) => void;
}) {
  const { pos, abrir, fechar } = useAnchoredPopover();
  const [menu, setMenu] = useState<ProjetoCartao | null>(null);
  const rotuloFase = (codigo: FaseProjeto) => FASES_PROJETO.find(item => item.key === codigo)?.label ?? "";
  const fecharMenu = () => { fechar(); setMenu(null); };

  return (
    <div className="pb-8 pr-4 pt-1 md:pr-6">
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {carregando
          ? Array.from({ length: 6 }, (_, i) => <PastaEsqueleto key={i} />)
          : projetos.map(projeto => (
            <Pasta
              key={projeto.id}
              projeto={projeto}
              faseLabel={rotuloFase(projeto.fase_codigo)}
              onOpen={() => onOpen(projeto.id)}
              onMenu={event => { event.stopPropagation(); setMenu(projeto); abrir(event, 200); }}
            />
          ))}
      </div>

      <AnchoredPopover pos={menu ? pos : null} onClose={fecharMenu}>
        {menu && (
          <div className="-m-2 flex flex-col" role="menu" aria-label={`Ações de ${menu.nome}`}>
            <button type="button" role="menuitem" autoFocus onClick={() => { const id = menu.id; fecharMenu(); onOpen(id); }} className="flex h-9 items-center gap-2 rounded px-2 text-left text-[0.8125rem] text-[#282525] outline-none transition hover:bg-black/[.04] focus-visible:bg-black/[.04]">
              <ExternalLink size={13} className="text-black/40" aria-hidden />Abrir projeto
            </button>
            <button type="button" role="menuitem" onClick={() => { const { id, nome } = menu; fecharMenu(); onDelete(id, nome); }} className="flex h-9 items-center gap-2 rounded px-2 text-left text-[0.8125rem] text-[#D94E4E] outline-none transition hover:bg-black/[.04] focus-visible:bg-black/[.04]">
              <Trash2 size={13} aria-hidden />Excluir projeto
            </button>
          </div>
        )}
      </AnchoredPopover>
    </div>
  );
}
