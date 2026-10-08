"use client";

// Mudança entre duas versões de uma página vigiada (P6.1): no computador,
// antes e agora lado a lado; no celular, uma coluna com o que saiu e o que
// entrou. Linhas iguais longe de uma mudança ficam recolhidas, e as palavras
// trocadas numa linha aparecem marcadas.

import { useMemo, useState } from "react";
import { diferencaDeLinhas, type TrechoDaDiferenca } from "@/supabase/functions/_shared/vigia-paginas";

const CONTEXTO = 3;
const VERMELHO = "#B23B3B";
const VERDE = "#2E8932";

type Linha = { tipo: "igual" | "novo" | "retirado"; texto: string; par?: string };
type Bloco =
  | { tipo: "linhas"; linhas: Linha[] }
  | { tipo: "recolhido"; linhas: string[]; chave: number };

/** Palavras da linha, marcando as que não estão na outra versão. */
function Palavras({ texto, outra, cor }: { texto: string; outra?: string; cor: string }) {
  const partes = useMemo(() => {
    if (outra === undefined) return null;
    const a = outra.split(/(\s+)/);
    const b = texto.split(/(\s+)/);
    const trechos = diferencaDeLinhas(a, b, 400);
    return trechos.filter(t => t.tipo !== "retirado").map(t => ({ marcada: t.tipo === "novo", texto: t.linhas.join("") }));
  }, [texto, outra]);
  if (!partes) return <>{texto}</>;
  return (
    <>
      {partes.map((p, i) => p.marcada && p.texto.trim()
        ? <strong key={i} className="font-semibold" style={{ color: cor }}>{p.texto}</strong>
        : <span key={i}>{p.texto}</span>)}
    </>
  );
}

/** Junta as linhas retiradas e as novas de uma mesma mudança, para mostrar uma ao lado da outra. */
function linhasDaMudanca(retiradas: string[], novas: string[]): Linha[] {
  const linhas: Linha[] = [];
  retiradas.forEach((texto, i) => linhas.push({ tipo: "retirado", texto, par: novas[i] }));
  novas.forEach((texto, i) => linhas.push({ tipo: "novo", texto, par: retiradas[i] }));
  return linhas;
}

function montarBlocos(trechos: TrechoDaDiferenca[]): Bloco[] {
  const blocos: Bloco[] = [];
  let chave = 0;
  for (let i = 0; i < trechos.length; i++) {
    const t = trechos[i];
    if (t.tipo === "igual") {
      const primeiro = i === 0;
      const ultimo = i === trechos.length - 1;
      const antes = primeiro ? 0 : CONTEXTO;
      const depois = ultimo ? 0 : CONTEXTO;
      // Recolhe só a partir de 5 linhas escondidas.
      if (t.linhas.length < antes + depois + 5) {
        blocos.push({ tipo: "linhas", linhas: t.linhas.map(texto => ({ tipo: "igual", texto })) });
        continue;
      }
      if (antes) blocos.push({ tipo: "linhas", linhas: t.linhas.slice(0, antes).map(texto => ({ tipo: "igual", texto })) });
      blocos.push({ tipo: "recolhido", linhas: t.linhas.slice(antes, t.linhas.length - depois), chave: chave++ });
      if (depois) blocos.push({ tipo: "linhas", linhas: t.linhas.slice(-depois).map(texto => ({ tipo: "igual", texto })) });
    } else if (t.tipo === "retirado" && trechos[i + 1]?.tipo === "novo") {
      blocos.push({ tipo: "linhas", linhas: linhasDaMudanca(t.linhas, trechos[i + 1].linhas) });
      i++;
    } else {
      blocos.push({ tipo: "linhas", linhas: t.linhas.map(texto => ({ tipo: t.tipo, texto })) });
    }
  }
  return blocos;
}

function Celula({ linha, lado }: { linha: Linha | null; lado: "antes" | "agora" | "unica" }) {
  if (!linha) return <div className="min-h-[1.5rem]" />;
  const cor = linha.tipo === "retirado" ? VERMELHO : linha.tipo === "novo" ? VERDE : null;
  const marca = linha.tipo === "retirado" ? "−" : linha.tipo === "novo" ? "+" : "";
  return (
    <div className="flex min-h-[1.5rem] gap-2 border-l-2 bg-white py-0.5 pl-2 pr-2"
      style={{ borderColor: cor ?? "transparent" }}>
      {lado === "unica" && <span aria-hidden className="w-3 shrink-0 select-none font-semibold" style={{ color: cor ?? undefined }}>{marca}</span>}
      <span className="sr-only">{linha.tipo === "retirado" ? "Saiu: " : linha.tipo === "novo" ? "Entrou: " : ""}</span>
      <span className={`min-w-0 whitespace-pre-wrap break-words ${cor ? "text-black/85" : "text-black/55"}`}>
        {cor ? <Palavras texto={linha.texto} outra={linha.par} cor={cor} /> : linha.texto}
      </span>
    </div>
  );
}

export function DiferencaDasVersoes({ antes, agora }: { antes: string; agora: string }) {
  const blocos = useMemo(() => montarBlocos(diferencaDeLinhas(antes ? antes.split("\n") : [], agora ? agora.split("\n") : [])), [antes, agora]);
  const [abertos, setAbertos] = useState<Set<number>>(new Set());
  const mudou = blocos.some(b => b.tipo === "linhas" && b.linhas.some(l => l.tipo !== "igual"));

  if (!mudou) return <p className="text-[0.75rem] text-black/50">O texto lido é o mesmo da versão anterior.</p>;

  const recolhido = (b: Extract<Bloco, { tipo: "recolhido" }>) => abertos.has(b.chave)
    ? b.linhas.map((texto, i) => ({ tipo: "igual" as const, texto, i }))
    : null;

  const botaoRecolhido = (b: Extract<Bloco, { tipo: "recolhido" }>) => (
    <button type="button" onClick={() => setAbertos(atual => new Set(atual).add(b.chave))}
      className="my-1 w-full rounded bg-black/[.04] py-1 text-[0.6875rem] text-black/50 transition hover:bg-black/[.07] hover:text-black/75 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
      {b.linhas.length} linhas iguais
    </button>
  );

  return (
    <div className="text-[0.75rem] leading-relaxed">
      {/* Computador: antes e agora lado a lado. */}
      <div className="hidden md:block">
        <div className="grid grid-cols-2 gap-4 pb-1 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">
          <span>Antes</span>
          <span>Agora</span>
        </div>
        {blocos.map((b, i) => {
          if (b.tipo === "recolhido") {
            const linhas = recolhido(b);
            return linhas
              ? <div key={i}>{linhas.map(l => <div key={l.i} className="grid grid-cols-2 gap-4"><Celula linha={l} lado="antes" /><Celula linha={l} lado="agora" /></div>)}</div>
              : <div key={i}>{botaoRecolhido(b)}</div>;
          }
          const esquerda = b.linhas.filter(l => l.tipo !== "novo");
          const direita = b.linhas.filter(l => l.tipo !== "retirado");
          const iguais = b.linhas.every(l => l.tipo === "igual");
          const total = iguais ? b.linhas.length : Math.max(esquerda.length, direita.length);
          return (
            <div key={i}>
              {Array.from({ length: total }, (_, j) => (
                <div key={j} className="grid grid-cols-2 gap-4">
                  <Celula linha={iguais ? b.linhas[j] : esquerda[j] ?? null} lado="antes" />
                  <Celula linha={iguais ? b.linhas[j] : direita[j] ?? null} lado="agora" />
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Celular: uma coluna, o que saiu e o que entrou. */}
      <div className="md:hidden">
        {blocos.map((b, i) => {
          if (b.tipo === "recolhido") {
            const linhas = recolhido(b);
            return linhas ? <div key={i}>{linhas.map(l => <Celula key={l.i} linha={l} lado="unica" />)}</div> : <div key={i}>{botaoRecolhido(b)}</div>;
          }
          return <div key={i}>{b.linhas.map((l, j) => <Celula key={j} linha={l} lado="unica" />)}</div>;
        })}
      </div>
    </div>
  );
}
