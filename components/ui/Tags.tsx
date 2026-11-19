"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Plus, Tag, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { AnchoredPopover, useAnchoredPopover } from "@/components/ui/AnchoredPopover";
import { MAX_TAGS, acrescentarTag, chaveDaTag, limparTag, sugerirTags } from "@/lib/tags";

// Tags livres de empresas e contatos (o vocabulário é da organização, compartilhado com os projetos).

const cache = new Map<string, Promise<string[]>>();

/** Tags que o time já usa, das mais usadas para as menos (fn_tags_em_uso). Uma busca por organização. */
export function useTagsDoTime(): [string[], (novas: string[]) => void] {
  const organizationId = useOrganizationId();
  const [tags, setTags] = useState<string[]>([]);
  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    if (!cache.has(organizationId)) {
      cache.set(organizationId, Promise.resolve(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (createClient() as any).rpc("fn_tags_em_uso", { p_organization_id: organizationId })
      ).then(({ data }: { data: { tag: string }[] | null }) => (data ?? []).map(linha => linha.tag)).catch(() => []));
    }
    cache.get(organizationId)!.then(lista => { if (ativo) setTags(lista); });
    return () => { ativo = false; };
  }, [organizationId]);
  // tag criada agora entra nas sugestões das próximas telas também
  const lembrar = (novas: string[]) => {
    const juntas = novas.reduce((lista, tag) => (lista.some(t => chaveDaTag(t) === chaveDaTag(tag)) ? lista : [...lista, tag]), tags);
    setTags(juntas);
    if (organizationId) cache.set(organizationId, Promise.resolve(juntas));
  };
  return [tags, lembrar];
}

/** Etiqueta de tag: neutra, borda leve e ícone cinza (DESIGN.md, etiquetas informativas). */
export function EtiquetaDeTag({ tag, onRemover }: { tag: string; onRemover?: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded border border-black/[.09] bg-white py-0.5 pl-1.5 pr-1.5 text-[0.6875rem] text-black/65">
      <Tag size={10} aria-hidden="true" className="shrink-0 text-black/35" />
      <span className="truncate">{tag}</span>
      {onRemover && (
        <button type="button" onClick={onRemover} aria-label={`Tirar a tag ${tag}`} className="-mr-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-black/35 transition hover:bg-black/[.06] hover:text-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/30">
          <X size={10} />
        </button>
      )}
    </span>
  );
}

/** Tags de uma linha de lista: as primeiras e "+n" para o resto. */
export function TagsDaLinha({ tags, maximo = 2 }: { tags: string[] | null | undefined; maximo?: number }) {
  const lista = tags ?? [];
  if (!lista.length) return <span className="text-[0.75rem] text-black/20">—</span>;
  return (
    <span className="flex min-w-0 items-center gap-1" title={lista.join(", ")}>
      {lista.slice(0, maximo).map(tag => <EtiquetaDeTag key={tag} tag={tag} />)}
      {lista.length > maximo && <span className="shrink-0 text-[0.6875rem] tabular-nums text-black/40">+{lista.length - maximo}</span>}
    </span>
  );
}

/**
 * Campo para escolher tags: as escolhidas viram etiquetas; digitar mostra as do time e "Criar «nome»".
 * Enter ou vírgula acrescenta; Backspace com o campo vazio tira a última.
 */
export function CampoDeTags({ valor, onChange, vocabulario }: { valor: string[]; onChange: (tags: string[]) => void; vocabulario: string[] }) {
  const [texto, setTexto] = useState("");
  const [destaque, setDestaque] = useState(0);
  const listaId = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const sugestoes = sugerirTags(texto, vocabulario, valor);
  const limpo = limparTag(texto);
  const existe = limpo && [...vocabulario, ...valor].some(t => chaveDaTag(t) === chaveDaTag(limpo));
  const opcoes = [...sugestoes.map(tag => ({ tag, criar: false })), ...(limpo && !existe ? [{ tag: limpo, criar: true }] : [])];
  const cheio = valor.length >= MAX_TAGS;

  const escolher = (tag: string) => {
    onChange(acrescentarTag(valor, tag, vocabulario));
    setTexto("");
    setDestaque(0);
    entrada.current?.focus();
  };

  return (
    <div>
      <div className="flex min-h-10 flex-wrap items-center gap-1 rounded border border-black/10 bg-white px-2 py-1.5 focus-within:border-[#7259B5]/45 focus-within:ring-2 focus-within:ring-[#7259B5]/10">
        {valor.map(tag => <EtiquetaDeTag key={tag} tag={tag} onRemover={() => onChange(valor.filter(t => t !== tag))} />)}
        <input
          ref={entrada}
          value={texto}
          disabled={cheio}
          autoFocus
          onChange={event => { setTexto(event.target.value.replace(",", "")); setDestaque(0); if (event.target.value.includes(",")) escolher(event.target.value.replace(",", "")); }}
          onKeyDown={event => {
            if (event.key === "Enter") { event.preventDefault(); const opcao = opcoes[destaque]; if (opcao) escolher(opcao.tag); else if (limpo) escolher(limpo); }
            else if (event.key === "ArrowDown") { event.preventDefault(); setDestaque(i => Math.min(i + 1, Math.max(0, opcoes.length - 1))); }
            else if (event.key === "ArrowUp") { event.preventDefault(); setDestaque(i => Math.max(0, i - 1)); }
            else if (event.key === "Backspace" && !texto && valor.length) onChange(valor.slice(0, -1));
          }}
          placeholder={cheio ? `Até ${MAX_TAGS} tags` : valor.length ? "Mais uma tag" : "Digite uma tag"}
          aria-label="Nova tag"
          aria-controls={listaId}
          aria-autocomplete="list"
          className="min-w-[7rem] flex-1 bg-transparent py-0.5 text-[0.8125rem] text-[#282525] outline-none placeholder:text-black/30 disabled:cursor-not-allowed"
        />
      </div>
      {opcoes.length > 0 && !cheio && (
        <ul id={listaId} role="listbox" className="mt-1.5 max-h-48 overflow-y-auto">
          {opcoes.map((opcao, i) => (
            <li key={`${opcao.criar}-${opcao.tag}`} role="option" aria-selected={i === destaque}>
              <button
                type="button"
                onMouseEnter={() => setDestaque(i)}
                onClick={() => escolher(opcao.tag)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[0.8125rem] transition ${i === destaque ? "bg-black/[.04]" : ""}`}
              >
                {opcao.criar
                  ? <><Plus size={12} aria-hidden="true" className="text-black/40" /><span className="text-black/55">Criar</span><span className="truncate text-[#282525]">“{opcao.tag}”</span></>
                  : <><Tag size={12} aria-hidden="true" className="text-black/35" /><span className="truncate text-[#282525]">{opcao.tag}</span></>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Tags no topo da página de uma empresa ou de um contato: etiquetas e um botão que abre a edição numa janelinha
 * (nunca campo solto na página). Salvar grava na hora e avisa a página.
 */
export function TagsDoRegistro({ tabela, id, tags, onSalvo }: {
  tabela: "empresas_crm" | "contatos";
  id: string;
  tags: string[] | null | undefined;
  onSalvo: (tags: string[]) => void;
}) {
  const atuais = tags ?? [];
  const [vocabulario, lembrar] = useTagsDoTime();
  const { pos, abrir, fechar } = useAnchoredPopover();
  const [rascunho, setRascunho] = useState<string[]>(atuais);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const comecar = (event: React.MouseEvent<HTMLElement>) => { setRascunho(atuais); setErro(null); abrir(event, 320); };
  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (createClient() as any).from(tabela).update({ tags: rascunho }).eq("id", id);
    setSalvando(false);
    if (error) { setErro(`As tags não foram salvas. ${error.message}`); return; }
    lembrar(rascunho);
    onSalvo(rascunho);
    fechar();
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {atuais.map(tag => <EtiquetaDeTag key={tag} tag={tag} />)}
      <button
        type="button"
        onClick={comecar}
        className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[0.6875rem] text-black/40 transition hover:bg-black/[.04] hover:text-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/30"
      >
        {atuais.length ? <>Editar tags</> : <><Plus size={11} aria-hidden="true" />Tag</>}
      </button>

      <AnchoredPopover pos={pos} onClose={fechar}>
        <div className="flex flex-col gap-3" role="dialog" aria-label="Tags">
          <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Tags</p>
          <CampoDeTags valor={rascunho} onChange={setRascunho} vocabulario={vocabulario} />
          {erro && <p role="alert" className="rounded border border-[#D94A4A]/30 bg-white px-2.5 py-2 text-[0.6875rem] text-[#D94A4A]">{erro}</p>}
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={fechar} className="text-[0.75rem] text-black/35 transition hover:text-black/55">Cancelar</button>
            <button type="button" onClick={salvar} disabled={salvando} className="rounded acao-salvar px-3.5 py-2 text-[0.75rem] font-medium text-white disabled:opacity-60">
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </AnchoredPopover>
    </div>
  );
}
