"use client";

import { useMemo, useRef, useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { lerTabela, prepararImportacao } from "@/lib/producao/importar-pessoas";

const AREA = "w-full rounded border border-black/[.12] bg-white px-3 py-2.5 font-mono text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";

/**
 * Importar a equipe de uma planilha: cole as linhas (com os títulos) ou escolha um arquivo CSV. Mostra o que entra,
 * o que já existe e o que tem erro antes de gravar; só as novas são gravadas.
 */
export function ImportarPessoasSheet({ organizationId, existentes, onClose, onImported }: {
  organizationId: string; existentes: { nome: string; email: string | null }[]; onClose: () => void; onImported: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const preparo = useMemo(() => (texto.trim() === "" ? null : prepararImportacao(lerTabela(texto), existentes)), [texto, existentes]);

  async function escolherArquivo(arquivo: File) {
    setErro(null);
    if (arquivo.size > 1024 * 1024) { setErro("O arquivo passa de 1 MB. Importe em partes."); return; }
    setTexto(await arquivo.text());
  }

  async function importar(fechar: () => void) {
    if (!preparo || !preparo.ok || preparo.novas.length === 0) return;
    setSalvando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_pessoas")
      .insert(preparo.novas.map(pessoa => ({ organization_id: organizationId, ...pessoa })));
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Só quem vê a produção inteira cadastra pessoas." : "Não foi possível importar. Nada foi gravado; tente de novo."); return; }
    onImported();
    fechar();
  }

  const novas = preparo?.ok ? preparo.novas.length : 0;
  const problemas = preparo?.ok ? preparo.linhas.filter(linha => linha.situacao !== "nova") : [];

  return (
    <TopSheet
      titulo="Importar pessoas de uma planilha"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void importar(fechar)} disabled={salvando || novas === 0} className="rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">
            {salvando ? "Importando…" : novas === 0 ? "Importar" : `Importar ${novas} ${novas === 1 ? "pessoa" : "pessoas"}`}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <p className="text-[0.75rem] text-black/55">Copie as células da planilha (com a linha dos títulos) e cole aqui, ou escolha um arquivo CSV. Colunas aceitas: <strong className="font-medium">Nome</strong> (obrigatória), Nome artístico, E-mail, Telefone e Tipo (equipe, elenco, técnica ou apoio).</p>
          <div className="mt-3 flex items-center gap-3">
            <input ref={entrada} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={event => { const escolhido = event.target.files?.[0]; event.target.value = ""; if (escolhido) void escolherArquivo(escolhido); }} />
            <button type="button" onClick={() => entrada.current?.click()} disabled={salvando} className="rounded border border-black/[.12] px-3.5 py-2 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Escolher arquivo CSV</button>
          </div>
        </div>
        <textarea aria-label="Linhas da planilha" rows={7} className={AREA} value={texto} onChange={event => setTexto(event.target.value)} placeholder={"Nome\tE-mail\tTelefone\tTipo\nAna Souza\tana@exemplo.com\t11 90000-0001\telenco"} disabled={salvando} spellCheck={false} />

        {preparo && !preparo.ok && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}>{preparo.erro}</p>}
        {preparo?.ok && (
          <div aria-live="polite">
            <p className="text-[0.8125rem] text-[#282525]">
              <strong className="font-medium">{novas}</strong> {novas === 1 ? "pessoa nova" : "pessoas novas"}
              {problemas.length > 0 && <span className="text-black/55"> · {problemas.length} {problemas.length === 1 ? "linha fica de fora" : "linhas ficam de fora"}</span>}
            </p>
            {problemas.length > 0 && (
              <ul className="mt-2 max-h-48 divide-y divide-black/[.06] overflow-y-auto rounded border text-[0.75rem]" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                {problemas.map(linha => (
                  <li key={linha.linha} className="flex flex-wrap items-baseline gap-x-2 px-3 py-2">
                    <span className="tabular-nums text-black/45">Linha {linha.linha}</span>
                    <span className="font-medium text-[#282525]">{linha.nome || "(sem nome)"}</span>
                    <span className={linha.situacao === "erro" ? "text-[#B23B3B]" : "text-black/55"}>{linha.situacao === "erro" ? linha.erro : `ignorada: ${linha.motivo}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </TopSheet>
  );
}
