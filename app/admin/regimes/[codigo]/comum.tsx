"use client";

// Peças comuns da revisão de regimes (P6.3): chamada à rota, etiqueta e o
// campo que edita um valor do regime no tipo dele.

import { Dropdown } from "@/components/ui/Dropdown";

export const BORDA = { borderColor: "rgba(13,13,13,.08)" };
export const AMBAR = "#B07A14";
export const VERDE = "#2E8932";
export const VERMELHO = "#B23B3B";
export const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
export const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
export const BOTAO_VERDE = "h-10 rounded bg-[#2E8932] px-4 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50";
export const BOTAO_TEXTO = "h-10 rounded px-3 text-[0.75rem] text-black/55 transition hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-40";

export const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
export const horaBr = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function Etiqueta({ texto, cor = "rgba(13,13,13,.6)" }: { texto: string; cor?: string }) {
  return (
    <span className="whitespace-nowrap rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium" style={{ borderColor: cor.startsWith("#") ? `${cor}47` : "rgba(13,13,13,.12)", color: cor }}>
      {texto}
    </span>
  );
}

export function Alerta({ erro, erros }: { erro: string; erros?: string[] }) {
  if (!erro) return null;
  return (
    <div role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem]" style={{ borderColor: `${VERMELHO}40`, color: VERMELHO }}>
      <p>{erro}</p>
      {erros && erros.length > 0 && <ul className="mt-1 list-disc pl-4 text-[0.6875rem]">{erros.slice(0, 8).map(e => <li key={e}>{e}</li>)}</ul>}
    </div>
  );
}

export type RespostaDaRota = { ok: boolean; dados: Record<string, unknown>; erro: string; erros: string[] };

export async function chamarRota(codigo: string, corpo: Record<string, unknown>): Promise<RespostaDaRota> {
  try {
    const resposta = await fetch(`/api/admin/regimes/${codigo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const dados = await resposta.json().catch(() => ({})) as Record<string, unknown>;
    return {
      ok: resposta.ok,
      dados,
      erro: resposta.ok ? "" : String(dados.error ?? "Não foi possível concluir a operação."),
      erros: Array.isArray(dados.erros) ? dados.erros.map(String) : [],
    };
  } catch {
    return { ok: false, dados: {}, erro: "Sem conexão com o servidor.", erros: [] };
  }
}

export type TipoDoValor = "numero" | "texto" | "sim_nao" | "json";

export function tipoDoValor(valor: unknown): TipoDoValor {
  if (typeof valor === "number") return "numero";
  if (typeof valor === "string") return "texto";
  if (typeof valor === "boolean") return "sim_nao";
  return "json";
}

export function valorEmTexto(valor: unknown, tipo: TipoDoValor): string {
  if (tipo === "numero") return valor === null || valor === undefined ? "" : String(valor).replace(".", ",");
  if (tipo === "texto") return typeof valor === "string" ? valor : "";
  if (tipo === "sim_nao") return valor === true ? "sim" : "nao";
  return JSON.stringify(valor ?? null, null, 2);
}

/** O texto do campo de volta ao valor; null quando não dá para ler. */
export function textoEmValor(texto: string, tipo: TipoDoValor): { ok: true; valor: unknown } | { ok: false } {
  if (tipo === "numero") {
    // "1.234,5" e "12,5" no jeito brasileiro; "0.5" também vale.
    const limpo = texto.trim();
    const n = Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo);
    return limpo && Number.isFinite(n) ? { ok: true, valor: n } : { ok: false };
  }
  if (tipo === "texto") return { ok: true, valor: texto };
  if (tipo === "sim_nao") return { ok: true, valor: texto === "sim" };
  try {
    return { ok: true, valor: JSON.parse(texto) };
  } catch {
    return { ok: false };
  }
}

export function EditorDeValor({ tipo, texto, onChange, rotulo }: { tipo: TipoDoValor; texto: string; onChange: (texto: string) => void; rotulo: string }) {
  if (tipo === "sim_nao") {
    return <Dropdown value={texto} onChange={onChange} ariaLabel={rotulo} options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }]} />;
  }
  if (tipo === "json" || (tipo === "texto" && texto.length > 80)) {
    return (
      <textarea aria-label={rotulo} value={texto} onChange={e => onChange(e.target.value)} rows={tipo === "json" ? 6 : 3}
        className={`${CAMPO} h-auto py-2 ${tipo === "json" ? "font-mono text-[0.6875rem]" : ""}`} />
    );
  }
  return <input aria-label={rotulo} value={texto} onChange={e => onChange(e.target.value)} inputMode={tipo === "numero" ? "decimal" : undefined} className={`${CAMPO} ${tipo === "numero" ? "tabular-nums" : ""}`} />;
}
