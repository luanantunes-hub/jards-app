"use client";

import { EXEMPLO_DE_INVESTIR, EXEMPLO_DOS_CANAIS, EXPLICACAO_DO_SELO, ROTULO_DO_SELO, type RitmoDoEvento, type Selo } from "@/lib/ticketeria/modelo-painel";

// O painel evolutivo da aba Modelo: o selo de precisão de cada número, o que o primeiro evento já mostra (vendas, ritmo, origem) e a prévia com dados de exemplo do que ainda não abre. Só desenho: os
// dados chegam por props. A prévia usa SEMPRE dados de demonstração, nunca números do produtor.

const BORDA = "rgba(13,13,13,.08)";
const CORES: Record<Selo, { cor: string; borda: string; fundo: string }> = {
  medido: { cor: "#2E8932", borda: "rgba(46,137,50,.35)", fundo: "#fff" },
  razoavel: { cor: "#5B8A2E", borda: "rgba(91,138,46,.35)", fundo: "#fff" },
  impreciso: { cor: "#B07A14", borda: "rgba(176,122,20,.4)", fundo: "#fff" },
  muito_impreciso: { cor: "#A24F14", borda: "rgba(162,79,20,.4)", fundo: "#FFF7EF" },
  exemplo: { cor: "#7259B5", borda: "rgba(114,89,181,.4)", fundo: "#FAF8FE" },
};
const numero = (n: number) => n.toLocaleString("pt-BR");
const virgula = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

export function SeloDePrecisao({ selo }: { selo: Selo }) {
  const c = CORES[selo];
  return <span className="inline-flex shrink-0 items-center rounded-xl border px-2 py-0.5 text-[0.625rem]" style={{ color: c.cor, borderColor: c.borda, background: c.fundo }}>{ROTULO_DO_SELO[selo]}</span>;
}

/** O topo do painel: o que ele é, o resumo do que há de dados e como ler os selos. */
export function CabecalhoDoPainel({ resumo, frase }: { resumo: string; frase: string }) {
  return (
    <div className="rounded-xl border px-4 py-3.5" style={{ borderColor: "rgba(114,89,181,.28)", background: "#FAF8FE" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-[0.8125rem] text-black/60"><span className="text-[#282525]">O que os seus dados mostram, e com que precisão.</span> {frase}</p>
        <span className="inline-flex shrink-0 rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal text-[#7259B5]" style={{ borderColor: "rgba(114,89,181,.3)" }}>{resumo}</span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[0.6875rem] text-black/50">
        <span className="text-[#282525]">Como ler os selos:</span>
        {(["medido", "razoavel", "impreciso", "muito_impreciso", "exemplo"] as const).map(s => <span key={s} className="inline-flex items-center gap-1.5"><SeloDePrecisao selo={s} />{(s === "medido" || s === "exemplo") && <span>{EXPLICACAO_DO_SELO[s]}</span>}</span>)}
      </div>
    </div>
  );
}

function Bloco({ titulo, selo, children }: { titulo: string; selo: Selo; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
      <div className="flex items-start justify-between gap-3"><p className="text-[0.875rem] text-[#282525]">{titulo}</p><SeloDePrecisao selo={selo} /></div>
      {children}
    </div>
  );
}

/** O que o primeiro evento já mostra: quanto vendeu, o ritmo (conta simples) e de onde vieram as vendas. */
export function PrimeirosDados({ ritmo, origem, semConta = false }: { ritmo: RitmoDoEvento | null; origem: { rotulo: string; ingressos: number }[]; /** Esconde a conta simples do ritmo quando a comparação com eventos parecidos a substitui. */ semConta?: boolean }) {
  if (!ritmo && origem.length === 0) return null;
  const maximo = ritmo ? Math.max(1, ...ritmo.serie.map(d => d.ingressos)) : 1;
  return (
    <section className="grid gap-3.5 md:grid-cols-2" aria-label="O que os seus dados já mostram">
      {ritmo && (
        <>
          <Bloco titulo={`Quanto já vendeu: ${ritmo.evento}`} selo="medido">
            <p className="mt-2 text-[1.375rem] tabular-nums tracking-[-.02em] text-[#282525]">{numero(ritmo.vendidos)}{ritmo.lugares > 0 ? ` de ${numero(ritmo.lugares)}` : ""} ingressos</p>
            <p className="mt-1 text-[0.75rem] text-black/50">{ritmo.porcento !== null ? `${ritmo.porcento}% da lotação, ` : ""}a {ritmo.diasAteASessao} {ritmo.diasAteASessao === 1 ? "dia" : "dias"} da sessão.</p>
            <div className="mt-3 flex h-[70px] items-end gap-[2px]" role="img" aria-label="Ingressos por dia nos últimos 28 dias">
              {ritmo.serie.map(d => <span key={d.dia} className="block flex-1 rounded-[2px] bg-[#7259B5]" style={{ height: `${Math.max(d.ingressos > 0 ? 6 : 1, (d.ingressos / maximo) * 100)}%`, opacity: d.ingressos > 0 ? 1 : .2 }} />)}
            </div>
            <p className="mt-1 text-[0.6875rem] text-black/40">Ingressos por dia, nos últimos 28 dias.</p>
          </Bloco>
          {!semConta && <Bloco titulo="Se o ritmo continuar" selo="muito_impreciso">
            <p className="mt-2 text-[1.375rem] tabular-nums tracking-[-.02em] text-[#282525]">cerca de {numero(ritmo.projecao)} até a data</p>
            <p className="mt-1 max-w-md text-[0.75rem] leading-relaxed text-black/50">É o ritmo dos últimos 7 dias ({virgula(ritmo.ritmoPorDia)} {ritmo.ritmoPorDia === 1 ? "ingresso" : "ingressos"} por dia) seguido até a sessão. Se o ritmo cair à metade: {numero(ritmo.metade)}. Se dobrar: {ritmo.dobroLota ? "lotaria antes da data" : numero(ritmo.dobro)}.</p>
            <p className="mt-1.5 max-w-md text-[0.75rem] leading-relaxed text-black/50">É uma conta simples, não uma previsão do modelo: as vendas costumam acelerar perto da data, mas não dá para dizer por quanto com os dados de um evento só.</p>
          </Bloco>}
        </>
      )}
      {origem.length > 0 && (
        <Bloco titulo="De onde vieram as vendas" selo="medido">
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-[#282525]">{origem.map(o => `${o.rotulo} ${numero(o.ingressos)}`).join(" · ")}</p>
          <p className="mt-1 text-[0.75rem] text-black/50">Conta só quem clicou no link de divulgação e comprou.</p>
        </Bloco>
      )}
    </section>
  );
}

/** A prévia com exemplo do que ainda não abre: o desenho do bloco com dados de demonstração (esmaecidos, com o selo "exemplo"), o que falta e, se houver, o botão que leva a resolver. */
export function PreviaComExemplo({ tipo, motivo, acao, onAcao }: { tipo: "canais" | "investir"; motivo: string; acao?: string; onAcao?: () => void }) {
  return (
    <div className="relative rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
      <div className="absolute right-4 top-3.5"><SeloDePrecisao selo="exemplo" /></div>
      <div aria-hidden="true" className="opacity-50">
        <p className="text-[0.875rem] text-black/60">{tipo === "canais" ? "Quanto cada canal vendeu" : "Onde vale investir mais"}</p>
        <div className="mt-2.5 space-y-1 text-[0.78rem] text-[#282525]">
          {tipo === "canais"
            ? EXEMPLO_DOS_CANAIS.map(c => <p key={c.rotulo}>{c.rotulo} {c.porcento}% <span className="text-black/35">±{c.margem}</span></p>)
            : EXEMPLO_DE_INVESTIR.map(c => <p key={c.rotulo}>{c.rotulo}: {virgula(c.ingressosPorCem)} ingressos por R$ 100</p>)}
        </div>
      </div>
      <p className="mt-2.5 max-w-3xl text-[0.75rem] leading-relaxed text-black/50">{motivo}{acao && onAcao && <> <button type="button" onClick={onAcao} className="rounded-xl text-[#7259B5] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{acao}</button></>}</p>
    </div>
  );
}
