"use client";

import { Fragment, useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Aviso, Rodape } from "@/components/ticketeria/FolhasDosEventos";
import { Moldura, type EventoParaComprar } from "@/components/ticketeria/CompraView";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";
import type { AssentoDoMapa, EstadoDoAssento, FileiraDoMapa } from "@/lib/ticketeria/mapa";
import { SELO_DO_TIPO, TIPO_CURTO, TIPO_EM_TEXTO, TIPOS_DE_LUGAR, conferirAcessibilidade, contarTipos, frasesDaAcessibilidade, tiposPresentes, type TipoDeLugar } from "@/lib/ticketeria/mapa-acessibilidade";
import { tiposDoMapa } from "@/lib/ticketeria/mapa";
import { LegendaDeTiposDoMapa, MapaPorLayout, chaveDoLugar } from "@/components/ticketeria/MapaPorLayout";
import type { Layout } from "@/lib/ticketeria/mapa-layout";
import { comporSala, conferirPlanta, lerSalaDoMapa, urlDoFundo } from "@/lib/ticketeria/mapa-sala";
import { EditorDoLayout, type HistoricoDoEditor } from "@/components/ticketeria/EditorDoLayout";
import { comAngulo, comPalcoAcima, empurrarVizinhos, moverBloco } from "@/lib/ticketeria/mapa-layout-editor";
import { ehLugarReservado } from "@/lib/ticketeria/mapa-reserva";

// Os assentos marcados da Ticketeria, desenhados: o produtor monta o mapa de um setor (fileiras, lugares, lugares bloqueados) e quem compra escolhe os lugares
// no mapa. Só desenho: os dados e as ações chegam por props. Um setor "com lugares numerados" tem uma grade de fileiras (A, B, C...) com lugares 1, 2, 3...

export type { AssentoDoMapa, EstadoDoAssento, FileiraDoMapa };

const TAMANHO_FIXO = "h-7 w-7 text-[0.625rem]";
const TAMANHO_AMPLIADO = "h-9 w-9 text-[0.75rem]";
/** Ajustado à largura da tela: os lugares encolhem para a fileira caber, sem rolar para o lado. */
const TAMANHO_AJUSTADO = "aspect-square min-w-0 max-w-8 flex-1 text-[0.625rem]";
const LISTRAS = { backgroundImage: "repeating-linear-gradient(135deg, rgba(13,13,13,.18) 0 2px, transparent 2px 5px)" } as const;

export type ModoDoMapa = "comprador" | "produtor";

/** O selo do tipo de lugar no canto do lugar: uma letra (a cor sozinha não basta). */
function SeloDoTipo({ tipo }: { tipo: TipoDeLugar }) {
  if (tipo === "comum") return null;
  const selo = SELO_DO_TIPO[tipo];
  return <span aria-hidden="true" className="pointer-events-none absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[0.5rem] font-bold leading-none text-white ring-2 ring-white" style={{ background: selo.cor }}>{selo.letra}</span>;
}

function Assento({ fileira, numero, estado, tipo = "comum", modo, tamanho, onAlternar }: { fileira: string; numero: number; estado: EstadoDoAssento; tipo?: TipoDeLugar; modo: ModoDoMapa; tamanho: string; onAlternar?: () => void }) {
  const nome = `Fileira ${fileira}, lugar ${numero}${tipo === "comum" ? "" : `, ${TIPO_CURTO[tipo]}`}`;
  const desligado = modo === "comprador" ? estado === "ocupado" || estado === "bloqueado" || estado === "reservado" : estado === "ocupado";
  const base = `relative flex ${tamanho} items-center justify-center rounded-lg tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525]`;
  if (estado === "selecionado") return <button type="button" aria-pressed="true" aria-label={`${nome}, escolhido`} onClick={onAlternar} className={`${base} bg-[#282525] text-white`}>{numero}<SeloDoTipo tipo={tipo} /></button>;
  if (estado === "reservado") return <button type="button" disabled aria-label={`${nome}, reservado`} className={`${base} cursor-not-allowed border border-dashed border-[#1D4ED8]/45 bg-[#1D4ED8]/[.06] text-[#1D4ED8]/55`}>{numero}<SeloDoTipo tipo={tipo} /></button>;
  if (estado === "ocupado") return <button type="button" disabled aria-label={`${nome}, ocupado`} className={`${base} cursor-not-allowed bg-black/[.09] text-black/25`}>{numero}<SeloDoTipo tipo={tipo} /></button>;
  if (estado === "bloqueado") return <button type="button" aria-pressed="true" aria-label={`${nome}, bloqueado`} disabled={desligado} onClick={onAlternar} className={`${base} border border-dashed border-black/35 text-black/35`} style={LISTRAS}>{numero}<SeloDoTipo tipo={tipo} /></button>;
  return <button type="button" aria-pressed="false" aria-label={`${nome}, livre`} onClick={onAlternar} className={`${base} border border-black/25 bg-white text-[#282525] hover:bg-black/[.05]`}>{numero}<SeloDoTipo tipo={tipo} /></button>;
}

/** O palco. É o desenho de todos os mapas de assentos (compra, editor e prévia do onboarding): redesenhe aqui e vale em todos. */
export function PalcoDoMapa({ nome = "Palco", largura = "max-w-[80%]" }: { nome?: string; largura?: string }) {
  return <div className={`mx-auto mb-4 flex h-7 ${largura} items-center justify-center rounded-xl border border-black/15 bg-black/[.04] text-[0.625rem] uppercase tracking-[.16em] text-black/45`}>{nome}</div>;
}

/**
 * O mapa: o palco no alto e as fileiras abaixo. No modo "produtor" tocar num lugar o bloqueia ou libera; no do comprador, escolhe ou solta.
 * `ampliado` (só do comprador): lugares maiores, com rolagem para o lado; sem ele, os lugares encolhem para a fileira caber na tela.
 */
export function MapaDeAssentos({ fileiras, modo, palco = "Palco", ampliado = false, onAlternar }: { fileiras: FileiraDoMapa[]; modo: ModoDoMapa; palco?: string; ampliado?: boolean; onAlternar?: (fileira: string, numero: number) => void }) {
  const ajustado = modo === "comprador" && !ampliado;
  const tamanho = ajustado ? TAMANHO_AJUSTADO : ampliado ? TAMANHO_AMPLIADO : TAMANHO_FIXO;
  const maisLonga = Math.max(0, ...fileiras.map(f => f.assentos.length));
  // Fileiras mais curtas ganham espaço vazio dos dois lados, para todos os lugares terem o mesmo tamanho.
  const vazios = (f: FileiraDoMapa) => (ajustado ? Math.max(0, maisLonga - f.assentos.length) : 0);
  const folga = (n: number) => Array.from({ length: n }, (_, i) => <span key={i} className="min-w-0 max-w-8 flex-1" aria-hidden="true" />);
  return (
    <div className={ajustado ? "" : "overflow-x-auto pb-1"} role="group" aria-label="Mapa de lugares">
      <div className={ajustado ? "w-full" : "mx-auto w-max min-w-full"}>
        <PalcoDoMapa nome={palco} />
        <div className="space-y-1.5">
          {fileiras.map(f => (
            <div key={f.nome} className={`flex items-center gap-1 ${ajustado ? "" : "justify-center"}`}>
              <span className="w-5 shrink-0 text-center text-[0.6875rem] tabular-nums text-black/45" aria-hidden="true">{f.nome}</span>
              <div className={`flex items-center gap-1 ${ajustado ? "min-w-0 flex-1 justify-center" : ""}`}>
                {folga(Math.floor(vazios(f) / 2))}
                {f.assentos.map(a => (
                  <Fragment key={a.numero}>
                    <Assento fileira={f.nome} numero={a.numero} estado={a.estado} tipo={a.tipo} modo={modo} tamanho={tamanho} onAlternar={() => onAlternar?.(f.nome, a.numero)} />
                    {f.vaos?.includes(a.numero) && <span className="w-3 shrink-0" aria-hidden="true" />}
                  </Fragment>
                ))}
                {folga(Math.ceil(vazios(f) / 2))}
              </div>
              <span className="w-5 shrink-0 text-center text-[0.6875rem] tabular-nums text-black/45" aria-hidden="true">{f.nome}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A legenda do mapa. */
export function LegendaDoMapa({ modo, tipos = [], reservados = false }: { modo: "comprador" | "produtor"; tipos?: readonly Exclude<TipoDeLugar, "comum">[]; /** Há lugar reservado de acessibilidade ainda fechado para quem compra. */ reservados?: boolean }) {
  const item = (rotulo: string, amostra: React.ReactNode) => <li className="flex items-center gap-2 text-[0.75rem] text-black/60">{amostra}{rotulo}</li>;
  const caixa = "h-4 w-4 rounded-md";
  return (
    <>
    <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5" aria-label="Legenda">
      {item("Livre", <span className={`${caixa} border border-black/25 bg-white`} />)}
      {modo === "comprador" && item("Seu lugar", <span className={`${caixa} bg-[#282525]`} />)}
      {modo === "comprador" && item("Ocupado", <span className={`${caixa} bg-black/[.09]`} />)}
      {modo === "comprador" && reservados && item("Reservado", <span className={`${caixa} border border-dashed border-[#1D4ED8]/45 bg-[#1D4ED8]/[.06]`} />)}
      {modo === "produtor" && item("Bloqueado (não vai à venda)", <span className={`${caixa} border border-dashed border-black/35`} style={LISTRAS} />)}
      {modo === "produtor" && item("Já vendido", <span className={`${caixa} bg-black/[.09]`} />)}
    </ul>
    <LegendaDeTiposDoMapa tipos={tipos} />
    </>
  );
}

// ─── Quem compra ────────────────────────────────────────────────────────────

type Site = { titulo: string; cor?: string };
const BOTAO = "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#6450D2] px-5 py-3 text-[0.9375rem] font-normal text-white transition hover:bg-[#5342BA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6450D2] disabled:cursor-not-allowed disabled:bg-black/20";
const BOTAO_SECUNDARIO = "inline-flex min-h-11 items-center justify-center rounded-xl border border-black/15 bg-white px-4 py-2.5 text-[0.875rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525]";

/** O mapa tem lugar de acessibilidade reservado (cadeira de rodas, mobilidade reduzida ou pessoa obesa)? */
function temLugarReservado(fileiras: readonly FileiraDoMapa[]): boolean {
  return fileiras.some(f => f.assentos.some(a => a.estado === "reservado" || ehLugarReservado(a.tipo)));
}

/** O estado de cada lugar (o que não é livre) pela chave que o desenho por layout usa. */
function estadosDoMapa(fileiras: readonly FileiraDoMapa[], setor: string | null = null): Map<string, EstadoDoAssento> {
  const estados = new Map<string, EstadoDoAssento>();
  for (const f of fileiras) for (const a of f.assentos) if (a.estado !== "livre") estados.set(chaveDoLugar(setor, f.nome, a.numero), a.estado);
  return estados;
}

/** A tela de escolher os lugares de um ingresso no mapa do setor. `escolhidos` são os rótulos ("C7") na ordem em que a pessoa os tocou. */
export function TelaEscolherLugares({ site, evento, ingresso, setor, fileiras, escolhidos, max, totalCentavos, ampliado = false, carregando = false, erroDoMapa = null, onTentarDeNovo, layout, sala = null, declarouAcessibilidade = false, onDeclarar, onAmpliar, onAlternar, onVoltar, onConfirmar }: {
  site: Site; evento: EventoParaComprar; ingresso: { nome: string; preco_centavos: number }; setor: string; fileiras: FileiraDoMapa[]; escolhidos: string[]; max: number; totalCentavos: number; ampliado?: boolean; carregando?: boolean; erroDoMapa?: string | null; onTentarDeNovo?: () => void;
  /** O layout do setor (já conferido com `lerLayout`): com ele o mapa é o desenho dos blocos; sem ele, a lista de fileiras de sempre. */
  layout?: Layout | null;
  /** O mapa da sala inteira (lido com `lerSalaDoMapa`): com ele, o comprador vê todos os setores da sala, cada um com a sua cor, e escolhe lugares no setor do ingresso; os outros só situam. */
  sala?: ReturnType<typeof lerSalaDoMapa>;
  /** A pergunta de acessibilidade (art. 23-A): aparece quando o mapa tem lugares reservados; marcar libera os lugares reservados. */
  declarouAcessibilidade?: boolean; onDeclarar?: (v: boolean) => void;
  onAmpliar?: () => void; onAlternar?: (fileira: string, numero: number) => void; onVoltar?: () => void; onConfirmar?: () => void;
}) {
  // O mapa da sala só vale se a planta se desenha sem setor em cima de setor; senão, o mapa do setor, como sempre.
  const daSala = sala && conferirPlanta(sala.planta, sala.setores).length === 0 ? { ...comporSala(sala.planta, sala.setores), atual: sala.atual, setores: sala.setores } : null;
  return (
    <Moldura titulo={site.titulo} cor={site.cor}
      rodape={
        <div className="flex items-center gap-3">
          <button type="button" className={`${BOTAO_SECUNDARIO} shrink-0`} onClick={onVoltar}>Voltar</button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.75rem] text-black/55">{escolhidos.length === 0 ? "Nenhum lugar" : `${escolhidos.length === 1 ? "1 lugar" : `${escolhidos.length} lugares`} · ${escolhidos.join(", ")}`}</p>
            <p className="text-[1.125rem] font-medium tabular-nums tracking-[-.02em]">{formatarMoeda(totalCentavos)}</p>
          </div>
          <button type="button" className={`${BOTAO} !w-auto min-w-32`} disabled={escolhidos.length === 0} onClick={onConfirmar}>Confirmar</button>
        </div>
      }>
      <h1 className="text-[1.5rem] font-medium tracking-[-.025em]">Escolha seus lugares</h1>
      <p className="mt-1 text-[0.875rem] text-black/60">{evento.titulo} · {evento.quando}</p>
      <p className="mt-0.5 text-[0.875rem] text-black/60">{ingresso.nome} · {setor} · {formatarMoeda(ingresso.preco_centavos)} cada</p>
      {carregando ? (
        <p role="status" className="mt-8 text-center text-[0.9375rem] text-black/55">Carregando o mapa…</p>
      ) : erroDoMapa ? (
        <div className="mt-6 text-center">
          <p role="alert" className="text-[0.9375rem] text-[#B23B3B]">{erroDoMapa}</p>
          <button type="button" onClick={onTentarDeNovo} className={`${BOTAO_SECUNDARIO} mt-4`}>Tentar de novo</button>
        </div>
      ) : (
        <>
          {onDeclarar && temLugarReservado(fileiras) && (
            <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.1)" }}>
              <div className="min-w-0">
                <p className="text-[0.875rem] text-[#282525]">Alguém do grupo precisa de lugar para cadeira de rodas ou com mobilidade reduzida?</p>
                <p className="mt-0.5 text-[0.75rem] leading-relaxed text-black/55">Alguns lugares são reservados para essas pessoas e para quem as acompanha. Marque se for o seu caso para poder escolhê-los.</p>
              </div>
              <button type="button" role="switch" aria-checked={declarouAcessibilidade} aria-label="Preciso de lugar acessível" onClick={() => onDeclarar(!declarouAcessibilidade)}
                className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] ${declarouAcessibilidade ? "bg-[#282525]" : "bg-black/20"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${declarouAcessibilidade ? "left-[1.375rem]" : "left-0.5"}`} />
              </button>
            </div>
          )}
          <div className="mt-4 flex justify-end"><button type="button" onClick={onAmpliar} aria-pressed={ampliado} className="rounded-xl text-[0.8125rem] text-black/60 underline underline-offset-2 hover:text-black/80">{ampliado ? "Ver o mapa inteiro" : "Ampliar o mapa"}</button></div>
          <div className="mt-2">
            {daSala
              ? <MapaPorLayout layout={daSala.layout} modo="comprador" ampliado={ampliado} cores={daSala.cores} fundo={daSala.fundo ? { ...daSala.fundo, url: urlDoFundo(daSala.fundo.caminho, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") } : undefined} contexto={new Set(daSala.setores.filter(x => x.id !== daSala.atual).map(x => x.id))} rotulos={new Map(daSala.setores.map(x => [x.id, x.nome]))}
                  rotuloDoMapa="Mapa da sala" estados={estadosDoMapa(fileiras, daSala.atual)} tipos={tiposDoMapa(fileiras, (f, n) => chaveDoLugar(daSala.atual, f, n))} onAlternar={l => { if (l.setor === daSala.atual) onAlternar?.(l.fileira, l.numero); }} />
              : layout
              ? <MapaPorLayout layout={layout} modo="comprador" ampliado={ampliado} estados={estadosDoMapa(fileiras)} tipos={tiposDoMapa(fileiras, (f, n) => chaveDoLugar(null, f, n))} onAlternar={l => onAlternar?.(l.fileira, l.numero)} />
              : <MapaDeAssentos fileiras={fileiras} modo="comprador" ampliado={ampliado} onAlternar={onAlternar} />}
          </div>
          {daSala && (
            <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5" aria-label="Setores da sala">
              {daSala.setores.map(x => (
                <li key={x.id} className="flex items-center gap-2 text-[0.75rem] text-black/60">
                  <span aria-hidden="true" className="h-3.5 w-3.5 rounded-md border" style={{ borderColor: daSala.cores.get(x.id), background: `${daSala.cores.get(x.id)}${x.id === daSala.atual ? "14" : "38"}` }} />
                  {x.nome}{x.id === daSala.atual ? " (o seu)" : ""}
                </li>
              ))}
            </ul>
          )}
          <LegendaDoMapa modo="comprador" tipos={tiposPresentes(tiposDoMapa(fileiras, (f, n) => `${f}|${n}`))} reservados={fileiras.some(f => f.assentos.some(a => a.estado === "reservado"))} />
        </>
      )}
      <p className="mt-4 text-center text-[0.75rem] text-black/50">Até {max} lugares. Os lugares ficam reservados por 15 minutos depois que você continuar.</p>
    </Moldura>
  );
}

// ─── Quem produz ────────────────────────────────────────────────────────────

/** Os controles do editor de mapa: um lugar a mais ou a menos em cada fileira, + Fileira, o corredor e o resumo. As contas estão em lib/ticketeria/mapa.ts. */
type PropsDoEditor = {
  fileiras: FileiraDoMapa[]; lugares: number; bloqueados: number; vendidos: number; corredor?: boolean; onCorredor?: (ligado: boolean) => void;
  onAlternar?: (fileira: string, numero: number) => void; onAdicionarFileira?: () => void; onMaisLugares?: (fileira: string) => void; onMenosLugares?: (fileira: string) => void; erro?: string | null;
  /** Com ele, o editor ganha a ferramenta "Tipo do lugar" (cadeira de rodas, acompanhante, mobilidade reduzida, pessoa obesa) e o painel de acessibilidade; sem ele (o onboarding), fica como era. */
  onMarcarTipo?: (fileira: string, numero: number, tipo: TipoDeLugar) => void;
  /** Com `onLayout`, o editor ganha a ferramenta "Desenho" (modelos, blocos, curva, ângulo, corredores) e, havendo `layout`, mostra o mapa pelo desenho dos blocos. */
  layout?: Layout | null; onLayout?: (l: Layout | null, agrupar?: boolean) => void; blocoEscolhido?: string | null; onEscolherBloco?: (id: string | null) => void;
  /** Desfazer e refazer do desenho (opcional: sem ele, ficam sem os botões e os atalhos). */
  historico?: HistoricoDoEditor;
  /** Só para as imagens e os testes: com qual ferramenta e qual tipo o editor abre. */
  ferramentaInicial?: "bloquear" | "tipo" | "desenho"; tipoInicial?: Exclude<TipoDeLugar, "comum">;
};

const FOCO_DO_EDITOR = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

/** "Bloquear lugares" ou "Tipo do lugar", e, com o tipo, qual tipo se aplica ao tocar. */
function FerramentasDoMapa({ ferramenta, onFerramenta, tipo, onTipo, comTipos, comDesenho }: {
  ferramenta: "bloquear" | "tipo" | "desenho"; onFerramenta: (f: "bloquear" | "tipo" | "desenho") => void; tipo: TipoDeLugar; onTipo: (t: TipoDeLugar) => void; comTipos: boolean; comDesenho: boolean;
}) {
  const aba = (id: "bloquear" | "tipo" | "desenho", rotulo: string) => (
    <button type="button" role="radio" aria-checked={ferramenta === id} onClick={() => onFerramenta(id)}
      className={`h-8 rounded-[10px] px-3.5 text-[0.75rem] transition ${FOCO_DO_EDITOR} ${ferramenta === id ? "bg-white font-medium text-[#282525] shadow-[0_1px_2px_rgba(13,13,13,.12)]" : "text-black/55 hover:text-black/75"}`}>{rotulo}</button>
  );
  const tipos = TIPOS_DE_LUGAR;
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Ferramenta" className="inline-flex rounded-xl bg-black/[.05] p-0.5">
        {aba("bloquear", "Bloquear lugares")}
        {comTipos && aba("tipo", "Tipo do lugar")}
        {comDesenho && aba("desenho", "Desenho")}
      </div>
      {ferramenta === "tipo" && (
        <div role="radiogroup" aria-label="Tipo de lugar" className="flex flex-wrap gap-2">
          {tipos.map(t => {
            const ativo = tipo === t;
            return (
              <button key={t} type="button" role="radio" aria-checked={ativo} onClick={() => onTipo(t)}
                className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[0.75rem] transition ${FOCO_DO_EDITOR} ${ativo ? "border-[#6450D2] bg-[#6450D2]/[.06] text-[#282525]" : "border-black/[.12] bg-white text-black/65 hover:bg-black/[.04]"}`}>
                {t === "comum"
                  ? <span aria-hidden="true" className="h-4 w-4 rounded-md border border-black/25 bg-white" />
                  : <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-full text-[0.5625rem] font-bold text-white" style={{ background: SELO_DO_TIPO[t].cor }}>{SELO_DO_TIPO[t].letra}</span>}
                {t === "comum" ? "Comum" : TIPO_EM_TEXTO[t]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const ITENS_DO_PAINEL = { cadeira_rodas: "Espaços para cadeira de rodas", mobilidade_reduzida: "Assentos para deficiência ou mobilidade reduzida", obesos: "Assentos para pessoa obesa" } as const;

/** O contador de referência da lei, só um aviso: quantos lugares de cada tipo há contra o que o Decreto 9.404/2018 pede para esta lotação. */
export function PainelDeAcessibilidade({ fileiras }: { fileiras: FileiraDoMapa[] }) {
  const chave = (f: string, n: number) => `${f}|${n}`;
  const todos = fileiras.flatMap(f => f.assentos.map(a => chave(f.nome, a.numero)));
  if (todos.length === 0) return null;
  const situacao = conferirAcessibilidade(contarTipos(todos, tiposDoMapa(fileiras, chave)));
  return (
    <div className="rounded-xl border bg-white px-4 py-3.5" style={{ borderColor: "rgba(13,13,13,.08)" }} aria-label="Acessibilidade" role="group">
      <p className="text-[0.8125rem] font-medium text-[#282525]">Acessibilidade</p>
      <ul className="mt-2 space-y-1.5">
        {situacao.map(i => (
          <li key={i.item} className="flex items-center justify-between gap-3 text-[0.8125rem] text-black/65">
            <span>{ITENS_DO_PAINEL[i.item]}</span>
            <span className="flex shrink-0 items-center gap-2 tabular-nums">
              <span>{i.tem} de {i.precisa}</span>
              <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] ${i.ok ? "bg-[#2E8932]/10 text-[#2E8932]" : "bg-[#B45309]/10 text-[#B45309]"}`}>{i.ok ? "Ok" : `Faltam ${i.precisa - i.tem}`}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[0.6875rem] text-black/45">Referência do Decreto 9.404/2018: 2% de cada, no mínimo 1 (acima de mil lugares, 20 mais 1% do que passar de mil). É um aviso: não impede de salvar.</p>
    </div>
  );
}

/**
 * O editor do mapa de um setor, sem moldura: as fileiras com a quantidade de lugares de cada uma, e os lugares que se bloqueiam tocando neles. É o mesmo na
 * folha do setor (MapaEditorSheet) e no onboarding (passo "Monte o auditório"): o que se desenha num vale no outro.
 */
export function EditorDoMapa({ fileiras, lugares, bloqueados, vendidos, corredor = true, onCorredor, onAlternar, onAdicionarFileira, onMaisLugares, onMenosLugares, erro, onMarcarTipo, layout = null, onLayout, blocoEscolhido = null, onEscolherBloco, historico, ferramentaInicial = "bloquear", tipoInicial = "cadeira_rodas" }: PropsDoEditor) {
  const [ferramenta, setFerramenta] = useState<"bloquear" | "tipo" | "desenho">(ferramentaInicial);
  const [tipo, setTipo] = useState<Exclude<TipoDeLugar, "comum"> | "comum">(tipoInicial);
  const comTipos = !!onMarcarTipo;
  const comDesenho = !!onLayout && !!onEscolherBloco;
  const modoTipo = comTipos && ferramenta === "tipo";
  const modoDesenho = comDesenho && ferramenta === "desenho";
  const tipoDoLugar = (f: string, n: number) => fileiras.find(x => x.nome === f)?.assentos.find(a => a.numero === n)?.tipo;
  const botao = "flex h-7 w-7 items-center justify-center rounded-lg border border-black/[.12] bg-white text-[0.875rem] leading-none text-black/60 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
  return (
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        {(comTipos || comDesenho) && <FerramentasDoMapa ferramenta={ferramenta} onFerramenta={setFerramenta} tipo={tipo} onTipo={setTipo} comTipos={comTipos} comDesenho={comDesenho} />}
        <p className="text-[0.8125rem] text-black/60">{modoDesenho
          ? (layout ? "Arraste um bloco no desenho para movê-lo, ou use as setas do painel." : "Escolha um modelo para desenhar o mapa em blocos.")
          : modoTipo
          ? "Escolha o tipo e toque nos lugares para marcá-los. Tocar de novo num lugar do mesmo tipo o devolve a comum."
          : "Toque num lugar para bloqueá-lo: ele não vai à venda (cadeira de som e luz, lugar da produção, visão ruim). Use − e + para mudar quantos lugares tem cada fileira."}</p>
        <div className={`overflow-x-auto rounded-xl border px-4 py-5 ${modoDesenho ? "sticky top-0 z-10 bg-[#fbfbfb] shadow-[0_6px_16px_-8px_rgba(13,13,13,.18)]" : "bg-black/[.015]"}`} style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {layout ? (
            <MapaPorLayout layout={layout} modo="produtor" estados={estadosDoMapa(fileiras)} tipos={tiposDoMapa(fileiras, (f, n) => chaveDoLugar(null, f, n))} rotuloDoMapa="Mapa do setor, por blocos"
              desenho={modoDesenho ? { blocoEscolhido, onEscolher: onEscolherBloco, onMover: (id, x, y) => onLayout(comPalcoAcima(moverBloco(layout, id, x, y)), true),
                onGirar: (id, angulo, fim) => { const girado = comAngulo(layout, id, angulo); onLayout(comPalcoAcima(fim ? empurrarVizinhos(girado, id) : girado), true); } } : undefined}
              onAlternar={l => (modoTipo ? onMarcarTipo?.(l.fileira, l.numero, tipoDoLugar(l.fileira, l.numero) === tipo ? "comum" : tipo) : onAlternar?.(l.fileira, l.numero))} />
          ) : (
            <>
          <PalcoDoMapa largura="max-w-[60%]" />
          <div className="space-y-1.5">
            {fileiras.map(f => (
              <div key={f.nome} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-center text-[0.75rem] font-medium tabular-nums text-black/55">{f.nome}</span>
                <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
                  {f.assentos.map(a => (
                    <Fragment key={a.numero}>
                      <Assento fileira={f.nome} numero={a.numero} estado={a.estado} tipo={a.tipo} modo="produtor" tamanho={TAMANHO_FIXO} onAlternar={() => (modoTipo ? onMarcarTipo?.(f.nome, a.numero, a.tipo === tipo ? "comum" : tipo) : onAlternar?.(f.nome, a.numero))} />
                      {f.vaos?.includes(a.numero) && <span className="w-3 shrink-0" aria-hidden="true" />}
                    </Fragment>
                  ))}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" className={botao} aria-label={`Um lugar a menos na fileira ${f.nome}`} onClick={() => onMenosLugares?.(f.nome)}>−</button>
                  <span className="w-6 text-center text-[0.75rem] tabular-nums text-black/55">{f.assentos.length}</span>
                  <button type="button" className={botao} aria-label={`Um lugar a mais na fileira ${f.nome}`} onClick={() => onMaisLugares?.(f.nome)}>+</button>
                </div>
              </div>
            ))}
          </div>
            </>
          )}
          <LegendaDoMapa modo="produtor" tipos={tiposPresentes(tiposDoMapa(fileiras, (f, n) => `${f}|${n}`))} />
        </div>
        {modoDesenho && <EditorDoLayout layout={layout} onLayout={onLayout} blocoEscolhido={blocoEscolhido} onEscolherBloco={onEscolherBloco} historico={historico} />}
        {comTipos && <PainelDeAcessibilidade fileiras={fileiras} />}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {layout ? <span /> : <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={onAdicionarFileira} className="inline-flex h-9 items-center rounded-xl border border-black/[.12] bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">+ Fileira</button>
            <button type="button" role="switch" aria-checked={corredor} onClick={() => onCorredor?.(!corredor)} className="inline-flex h-9 items-center gap-2 rounded-xl px-2 text-[0.75rem] text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><span className={`relative h-5 w-9 rounded-full transition ${corredor ? "bg-[#7259B5]" : "bg-black/20"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${corredor ? "left-[1.125rem]" : "left-0.5"}`} /></span>Corredor no meio</button>
          </div>}
          <p className="text-[0.8125rem] tabular-nums text-black/60"><strong className="font-medium text-[#282525]">{lugares} lugares</strong> à venda · {bloqueados} bloqueados{vendidos > 0 ? ` · ${vendidos} já vendidos` : ""}</p>
        </div>
      </div>
    
  );
}

/** O editor do mapa numa folha: o mesmo EditorDoMapa, com o botão de salvar. */
export function MapaEditorSheet({ setor, local, onClose, onSalvar, salvando, ...editor }: PropsDoEditor & { setor: string; local: string; onClose: () => void; onSalvar?: () => void; salvando?: boolean }) {
  return (
    <TopSheet titulo={`Mapa de ${setor}`} etiqueta={local} largura="46rem" onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={!!salvando} rotulo="Salvar mapa" onSalvar={() => onSalvar?.()} />}>
      <EditorDoMapa {...editor} />
    </TopSheet>
  );
}

