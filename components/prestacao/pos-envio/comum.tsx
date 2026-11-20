"use client";

import { useRef } from "react";
import { Paperclip, X } from "lucide-react";
import type { createClient } from "@/lib/supabase/client";
import { montarCaminhoPrestacao } from "@/lib/prestacao/armazenamento";

export const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
export const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
export const AREA = "w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
export const BORDA = { borderColor: "rgba(13,13,13,.08)" };
export const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] text-black/70 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:text-black/35 active:scale-[.98]";
export const ICONE = "rounded p-2 text-black/35 transition hover:bg-black/[.05] hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]";

export const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
export const hojeIso = () => new Date().toLocaleDateString("sv-SE");
export const reais = (v: unknown) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const textoDoValor = (v: number | null | undefined) => (v === null || v === undefined ? "" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/** Arquivo do formulário: o já guardado e, se escolhido, o novo que o substitui. */
export type ArquivoDoForm = { path: string | null; nome: string | null; novo: File | null };
export const arquivoDe = (path: string | null | undefined, nome: string | null | undefined): ArquivoDoForm => ({ path: path ?? null, nome: nome ?? null, novo: null });

type Supabase = ReturnType<typeof createClient>;

/** Sobe o arquivo novo para a pasta pos-envio; devolve o caminho e o nome que ficam gravados. */
export async function enviarArquivo(supabase: Supabase, organizationId: string, prestacaoId: string, a: ArquivoDoForm, enviados: string[]): Promise<{ path: string | null; nome: string | null }> {
  if (!a.novo) return { path: a.path, nome: a.nome };
  const caminho = montarCaminhoPrestacao({ organizationId, prestacaoId, pasta: { tipo: "pos-envio" }, nomeOriginal: a.novo.name });
  const { error } = await supabase.storage.from("documentos").upload(caminho, a.novo, { upsert: false, contentType: a.novo.type || undefined });
  if (error) throw new Error(`Não foi possível enviar "${a.novo.name}": ${error.message}`);
  enviados.push(caminho);
  return { path: caminho, nome: a.novo.name };
}

export async function abrirArquivo(supabase: Supabase, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("documentos").createSignedUrl(path, 300);
  if (data?.signedUrl) { window.open(data.signedUrl, "_blank", "noopener,noreferrer"); return null; }
  return `Não foi possível abrir o arquivo${error ? `: ${error.message}` : ""}.`;
}

/** Escolher arquivo, ver o nome e tirar. */
export function CampoArquivo({ rotulo, arquivo, onChange, onAbrir }: {
  rotulo: string;
  arquivo: ArquivoDoForm;
  onChange: (a: ArquivoDoForm) => void;
  onAbrir: (path: string) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const nome = arquivo.novo?.name ?? arquivo.nome;
  return (
    <div>
      <span className={ROTULO}>{rotulo}</span>
      <input
        ref={entrada}
        type="file"
        accept="application/pdf,image/*"
        className="sr-only"
        aria-label={rotulo}
        onChange={e => { const f = e.target.files?.[0]; if (f) onChange({ ...arquivo, novo: f }); e.target.value = ""; }}
      />
      {arquivo.novo || arquivo.path ? (
        <div className="flex h-10 min-w-0 items-center gap-1.5">
          {arquivo.path && !arquivo.novo
            ? <button type="button" onClick={() => onAbrir(arquivo.path!)} className="min-w-0 truncate text-left text-[0.6875rem] text-black/65 underline decoration-black/20 underline-offset-2 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5]">{nome || "Arquivo"}</button>
            : <span className="min-w-0 truncate text-[0.6875rem] text-black/65">{nome}</span>}
          <button type="button" onClick={() => onChange({ path: null, nome: null, novo: null })} aria-label={`Tirar ${rotulo.toLowerCase()}`} className="shrink-0 rounded p-1 text-black/35 transition hover:bg-black/5 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            <X size={12} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => entrada.current?.click()} className={`${BOTAO} h-10`} style={{ borderColor: "rgba(13,13,13,.14)" }}>
          <Paperclip size={12} aria-hidden /> Anexar
        </button>
      )}
    </div>
  );
}

export function RodapeDoModal({ salvando, rotulo, onCancelar, onSalvar }: { salvando: boolean; rotulo: string; onCancelar: () => void; onSalvar: () => void }) {
  return (
    <>
      <span />
      <div className="flex items-center gap-4">
        <button type="button" onClick={onCancelar} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
        <button
          type="button"
          onClick={onSalvar}
          disabled={salvando}
          className="flex items-center gap-1.5 rounded acao-salvar px-5 py-2 text-[0.8125rem] font-semibold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
          {rotulo}
        </button>
      </div>
    </>
  );
}

/** Etiqueta informativa: borda leve, fundo branco, texto na cor. */
export function Etiqueta({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border bg-white px-2 py-1 text-[0.625rem] font-medium" style={{ borderColor: cor + "47", color: cor }}>
      {children}
    </span>
  );
}

/** Opções do grupo de botões (situação), com a seleção em roxo. */
export function Opcoes<T extends string>({ rotulo, valor, opcoes, onChange }: { rotulo: string; valor: T; opcoes: readonly { id: T; rotulo: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <span className={ROTULO}>{rotulo}</span>
      <div role="radiogroup" aria-label={rotulo} className="inline-flex flex-wrap rounded border bg-white p-0.5" style={BORDA}>
        {opcoes.map(o => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={valor === o.id}
            onClick={() => onChange(o.id)}
            className="h-8 rounded px-3 text-[0.6875rem] transition focus-visible:outline-2 focus-visible:outline-[#7259B5]"
            style={valor === o.id ? { background: "#684DB0", color: "#fff" } : { color: "rgba(13,13,13,.6)" }}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
