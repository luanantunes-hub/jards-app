"use client";

import { Fragment } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Aviso, Rodape } from "@/components/ticketeria/FolhasDosEventos";
import { Moldura, type EventoParaComprar } from "@/components/ticketeria/CompraView";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";
import type { AssentoDoMapa, EstadoDoAssento, FileiraDoMapa } from "@/lib/ticketeria/mapa";

// Os assentos marcados da Ticketeria, desenhados: o produtor monta o mapa de um setor (fileiras, lugares, lugares bloqueados) e quem compra escolhe os lugares
// no mapa. Só desenho: os dados e as ações chegam por props. Um setor "com lugares numerados" tem uma grade de fileiras (A, B, C...) com lugares 1, 2, 3...

export type { AssentoDoMapa, EstadoDoAssento, FileiraDoMapa };

const TAMANHO_FIXO = "h-7 w-7 text-[0.625rem]";
const TAMANHO_AMPLIADO = "h-9 w-9 text-[0.75rem]";
/** Ajustado à largura da tela: os lugares encolhem para a fileira caber, sem rolar para o lado. */
const TAMANHO_AJUSTADO = "aspect-square min-w-0 max-w-8 flex-1 text-[0.625rem]";
const LISTRAS = { backgroundImage: "repeating-linear-gradient(135deg, rgba(13,13,13,.18) 0 2px, transparent 2px 5px)" } as const;

function Assento({ fileira, numero, estado, modo, tamanho, onAlternar }: { fileira: string; numero: number; estado: EstadoDoAssento; modo: "comprador" | "produtor"; tamanho: string; onAlternar?: () => void }) {
  const nome = `Fileira ${fileira}, lugar ${numero}`;
  const desligado = modo === "comprador" ? estado === "ocupado" || estado === "bloqueado" : estado === "ocupado";
  const base = `flex ${tamanho} items-center justify-center rounded-lg tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525]`;
  if (estado === "selecionado") return <button type="button" aria-pressed="true" aria-label={`${nome}, escolhido`} onClick={onAlternar} className={`${base} bg-[#282525] text-white`}>{numero}</button>;
  if (estado === "ocupado") return <button type="button" disabled aria-label={`${nome}, ocupado`} className={`${base} cursor-not-allowed bg-black/[.09] text-black/25`}>{numero}</button>;
  if (estado === "bloqueado") return <button type="button" aria-pressed="true" aria-label={`${nome}, bloqueado`} disabled={desligado} onClick={onAlternar} className={`${base} border border-dashed border-black/35 text-black/35`} style={LISTRAS}>{numero}</button>;
  return <button type="button" aria-pressed="false" aria-label={`${nome}, livre`} onClick={onAlternar} className={`${base} border border-black/25 bg-white text-[#282525] hover:bg-black/[.05]`}>{numero}</button>;
}

/**
 * O mapa: o palco no alto e as fileiras abaixo. No modo "produtor" tocar num lugar o bloqueia ou libera; no do comprador, escolhe ou solta.
 * `ampliado` (só do comprador): lugares maiores, com rolagem para o lado; sem ele, os lugares encolhem para a fileira caber na tela.
 */
export function MapaDeAssentos({ fileiras, modo, palco = "Palco", ampliado = false, onAlternar }: { fileiras: FileiraDoMapa[]; modo: "comprador" | "produtor"; palco?: string; ampliado?: boolean; onAlternar?: (fileira: string, numero: number) => void }) {
  const ajustado = modo === "comprador" && !ampliado;
  const tamanho = ajustado ? TAMANHO_AJUSTADO : ampliado ? TAMANHO_AMPLIADO : TAMANHO_FIXO;
  const maisLonga = Math.max(0, ...fileiras.map(f => f.assentos.length));
  // Fileiras mais curtas ganham espaço vazio dos dois lados, para todos os lugares terem o mesmo tamanho.
  const vazios = (f: FileiraDoMapa) => (ajustado ? Math.max(0, maisLonga - f.assentos.length) : 0);
  const folga = (n: number) => Array.from({ length: n }, (_, i) => <span key={i} className="min-w-0 max-w-8 flex-1" aria-hidden="true" />);
  return (
    <div className={ajustado ? "" : "overflow-x-auto pb-1"} role="group" aria-label="Mapa de lugares">
      <div className={ajustado ? "w-full" : "mx-auto w-max min-w-full"}>
        <div className="mx-auto mb-4 flex h-7 max-w-[80%] items-center justify-center rounded-xl border border-black/15 bg-black/[.04] text-[0.625rem] uppercase tracking-[.16em] text-black/45">{palco}</div>
        <div className="space-y-1.5">
          {fileiras.map(f => (
            <div key={f.nome} className={`flex items-center gap-1 ${ajustado ? "" : "justify-center"}`}>
              <span className="w-5 shrink-0 text-center text-[0.6875rem] tabular-nums text-black/45" aria-hidden="true">{f.nome}</span>
              <div className={`flex items-center gap-1 ${ajustado ? "min-w-0 flex-1 justify-center" : ""}`}>
                {folga(Math.floor(vazios(f) / 2))}
                {f.assentos.map(a => (
                  <Fragment key={a.numero}>
                    <Assento fileira={f.nome} numero={a.numero} estado={a.estado} modo={modo} tamanho={tamanho} onAlternar={() => onAlternar?.(f.nome, a.numero)} />
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
export function LegendaDoMapa({ modo }: { modo: "comprador" | "produtor" }) {
  const item = (rotulo: string, amostra: React.ReactNode) => <li className="flex items-center gap-2 text-[0.75rem] text-black/60">{amostra}{rotulo}</li>;
  const caixa = "h-4 w-4 rounded-md";
  return (
    <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5" aria-label="Legenda">
      {item("Livre", <span className={`${caixa} border border-black/25 bg-white`} />)}
      {modo === "comprador" && item("Seu lugar", <span className={`${caixa} bg-[#282525]`} />)}
      {modo === "comprador" && item("Ocupado", <span className={`${caixa} bg-black/[.09]`} />)}
      {modo === "produtor" && item("Bloqueado (não vai à venda)", <span className={`${caixa} border border-dashed border-black/35`} style={LISTRAS} />)}
      {modo === "produtor" && item("Já vendido", <span className={`${caixa} bg-black/[.09]`} />)}
    </ul>
  );
}

// ─── Quem compra ────────────────────────────────────────────────────────────

type Site = { titulo: string; cor?: string };
const BOTAO = "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#282525] px-5 py-3 text-[0.9375rem] font-normal text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] disabled:cursor-not-allowed disabled:bg-black/20";
const BOTAO_SECUNDARIO = "inline-flex min-h-11 items-center justify-center rounded-xl border border-black/15 bg-white px-4 py-2.5 text-[0.875rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525]";

/** A tela de escolher os lugares de um ingresso no mapa do setor. `escolhidos` são os rótulos ("C7") na ordem em que a pessoa os tocou. */
export function TelaEscolherLugares({ site, evento, ingresso, setor, fileiras, escolhidos, max, totalCentavos, ampliado = false, onAmpliar, onAlternar, onVoltar, onConfirmar }: {
  site: Site; evento: EventoParaComprar; ingresso: { nome: string; preco_centavos: number }; setor: string; fileiras: FileiraDoMapa[]; escolhidos: string[]; max: number; totalCentavos: number; ampliado?: boolean;
  onAmpliar?: () => void; onAlternar?: (fileira: string, numero: number) => void; onVoltar?: () => void; onConfirmar?: () => void;
}) {
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
      <div className="mt-4 flex justify-end"><button type="button" onClick={onAmpliar} aria-pressed={ampliado} className="rounded-xl text-[0.8125rem] text-black/60 underline underline-offset-2 hover:text-black/80">{ampliado ? "Ver o mapa inteiro" : "Ampliar o mapa"}</button></div>
      <div className="mt-2"><MapaDeAssentos fileiras={fileiras} modo="comprador" ampliado={ampliado} onAlternar={onAlternar} /></div>
      <LegendaDoMapa modo="comprador" />
      <p className="mt-4 text-center text-[0.75rem] text-black/50">Até {max} lugares. Os lugares ficam reservados por 15 minutos depois que você continuar.</p>
    </Moldura>
  );
}

/** A escolha dos ingressos quando um deles é de setor numerado: no lugar do contador, "Escolher lugares", e os lugares escolhidos aparecem como etiquetas. */
export function IngressoComLugares({ nome, setor, precoCentavos, escolhidos, onEscolher }: { nome: string; setor: string; precoCentavos: number; escolhidos: string[]; onEscolher?: () => void }) {
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-4">
      <div className="min-w-0">
        <p className="text-[1rem] font-normal">{nome}</p>
        <p className="mt-0.5 text-[0.8125rem] text-black/55">{setor} · lugares numerados</p>
        <p className="mt-1 text-[0.9375rem] tabular-nums">{formatarMoeda(precoCentavos)}</p>
        {escolhidos.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Lugares escolhidos">
            {escolhidos.map(l => <li key={l} className="rounded-lg bg-[#282525] px-2 py-1 text-[0.75rem] tabular-nums text-white">{l}</li>)}
          </ul>
        )}
      </div>
      <button type="button" className={`${BOTAO_SECUNDARIO} shrink-0`} onClick={onEscolher}>{escolhidos.length === 0 ? "Escolher lugares" : "Trocar lugares"}</button>
    </li>
  );
}

// ─── Quem produz ────────────────────────────────────────────────────────────

/** O editor do mapa de um setor: as fileiras com a quantidade de lugares de cada uma, e os lugares que se bloqueiam tocando neles. */
export function MapaEditorSheet({ setor, local, fileiras, lugares, bloqueados, vendidos, corredor = true, onCorredor, onAlternar, onAdicionarFileira, onMaisLugares, onMenosLugares, onClose, onSalvar, salvando, erro }: {
  setor: string; local: string; fileiras: FileiraDoMapa[]; lugares: number; bloqueados: number; vendidos: number; corredor?: boolean; onCorredor?: (ligado: boolean) => void;
  onAlternar?: (fileira: string, numero: number) => void; onAdicionarFileira?: () => void; onMaisLugares?: (fileira: string) => void; onMenosLugares?: (fileira: string) => void; onClose: () => void; onSalvar?: () => void; salvando?: boolean; erro?: string | null;
}) {
  const botao = "flex h-7 w-7 items-center justify-center rounded-lg border border-black/[.12] bg-white text-[0.875rem] leading-none text-black/60 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
  return (
    <TopSheet titulo={`Mapa de ${setor}`} etiqueta={local} largura="46rem" onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={!!salvando} rotulo="Salvar mapa" onSalvar={() => onSalvar?.()} />}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <p className="text-[0.8125rem] text-black/60">Toque num lugar para bloqueá-lo: ele não vai à venda (cadeira de som e luz, lugar da produção, visão ruim). Use − e + para mudar quantos lugares tem cada fileira.</p>
        <div className="overflow-x-auto rounded-xl border bg-black/[.015] px-4 py-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="mx-auto mb-4 flex h-7 max-w-[60%] items-center justify-center rounded-xl border border-black/15 bg-black/[.04] text-[0.625rem] uppercase tracking-[.16em] text-black/45">Palco</div>
          <div className="space-y-1.5">
            {fileiras.map(f => (
              <div key={f.nome} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-center text-[0.75rem] font-medium tabular-nums text-black/55">{f.nome}</span>
                <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
                  {f.assentos.map(a => (
                    <Fragment key={a.numero}>
                      <Assento fileira={f.nome} numero={a.numero} estado={a.estado} modo="produtor" tamanho={TAMANHO_FIXO} onAlternar={() => onAlternar?.(f.nome, a.numero)} />
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
          <LegendaDoMapa modo="produtor" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={onAdicionarFileira} className="inline-flex h-9 items-center rounded-xl border border-black/[.12] bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">+ Fileira</button>
            <button type="button" role="switch" aria-checked={corredor} onClick={() => onCorredor?.(!corredor)} className="inline-flex h-9 items-center gap-2 rounded-xl px-2 text-[0.75rem] text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><span className={`relative h-5 w-9 rounded-full transition ${corredor ? "bg-[#7259B5]" : "bg-black/20"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${corredor ? "left-[1.125rem]" : "left-0.5"}`} /></span>Corredor no meio</button>
          </div>
          <p className="text-[0.8125rem] tabular-nums text-black/60"><strong className="font-medium text-[#282525]">{lugares} lugares</strong> à venda · {bloqueados} bloqueados{vendidos > 0 ? ` · ${vendidos} já vendidos` : ""}</p>
        </div>
      </div>
    </TopSheet>
  );
}

