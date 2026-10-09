"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, FileUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import {
  adivinharMapaDeBeneficiados,
  beneficiadosDaTabela,
  CAMPOS_DA_IMPORTACAO,
  ROTULO_DO_SEXO,
  rotuloDaRede,
  type MapaDeBeneficiados,
} from "@/lib/prestacao/beneficiarios";
import { decodificarArquivo } from "@/lib/prestacao/extrato";
import { lerTabela } from "@/lib/prestacao/orcamento";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CABECALHO = "px-3 py-2 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40";
const LOTE = 500;

/**
 * Importa a relação de uma planilha: as linhas coladas do Excel (com o
 * cabeçalho) ou um CSV. As colunas são reconhecidas pelo título e podem ser
 * trocadas; a prévia mostra como cada linha entra.
 */
export function ImportarBeneficiados({ prestacaoId, jaCadastrados, onClose, onImported }: {
  prestacaoId: string;
  jaCadastrados: number;
  onClose: () => void;
  onImported: (quantidade: number) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState("");
  const [escolhido, setEscolhido] = useState<{ chave: string; mapa: MapaDeBeneficiados } | null>(null);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState("");

  const tabela = useMemo(() => lerTabela(texto), [texto]);
  const chave = tabela ? tabela.cabecalho.join("\u0001") : "";
  const mapa = useMemo(
    () => (tabela ? (escolhido?.chave === chave ? escolhido.mapa : adivinharMapaDeBeneficiados(tabela.cabecalho)) : null),
    [tabela, chave, escolhido],
  );
  const hoje = new Date().toISOString().slice(0, 10);
  const resultado = useMemo(() => (tabela && mapa ? beneficiadosDaTabela(tabela, mapa, hoje) : null), [tabela, mapa, hoje]);

  const colunas = useMemo(() => [
    { value: "", label: "A planilha não tem" },
    ...(tabela?.cabecalho ?? []).map((t, i) => ({ value: String(i), label: t || `Coluna ${i + 1}` })),
  ], [tabela]);

  async function escolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErro("");
    if (f.size > 5 * 1024 * 1024) { setErro("O arquivo passa de 5 MB."); return; }
    setArquivo(f.name);
    setTexto(decodificarArquivo(new Uint8Array(await f.arrayBuffer())));
  }

  async function importar() {
    if (!resultado?.linhas.length) return;
    setErro("");
    setImportando(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
    const db = supabase as any;
    let gravados = 0;
    for (let i = 0; i < resultado.linhas.length; i += LOTE) {
      const lote = resultado.linhas.slice(i, i + LOTE).map(l => ({ ...l, prestacao_id: prestacaoId }));
      const { error } = await db.from("prestacao_beneficiarios").insert(lote);
      if (error) {
        setImportando(false);
        setErro(`${gravados ? `${gravados} entraram; ` : ""}${mensagemErroPrestacao(error, "não foi possível importar o restante")}`);
        if (gravados) onImported(gravados);
        return;
      }
      gravados += lote.length;
    }
    setImportando(false);
    onImported(gravados);
  }

  const semNome = Boolean(mapa && mapa.nome === "");
  const n = resultado?.linhas.length ?? 0;

  return (
    <ModalPrestacao
      titulo="Importar beneficiados"
      subtitulo="Da planilha de inscrições ou da lista de chamada"
      onClose={onClose}
      largura="max-w-[52rem]"
      rodape={<>
        <span className="text-[0.6875rem] text-black/45">{tabela && !semNome ? `${n} ${n === 1 ? "beneficiado" : "beneficiados"} para importar` : ""}</span>
        <div className="flex items-center gap-4">
          <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button
            type="button"
            onClick={importar}
            disabled={importando || semNome || n === 0}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {importando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
            {n ? `Importar ${n}` : "Importar"}
          </button>
        </div>
      </>}
    >
      <div className="space-y-4 px-6 py-5">
        <div>
          <label htmlFor="beneficiados-colados" className={ROTULO}>Linhas da planilha, com o cabeçalho</label>
          <textarea
            id="beneficiados-colados"
            value={texto}
            onChange={e => { setTexto(e.target.value); setArquivo(""); }}
            rows={5}
            placeholder={"Nome\tSexo\tIdade\tEscola\tModalidade\nAna Souza\tF\t11\tEMEF Vila Nova\tAtletismo"}
            className="w-full rounded border border-black/[.12] bg-white px-3 py-2 font-mono text-[0.6875rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={() => arquivoRef.current?.click()}
              className="flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] text-black/65 transition hover:border-black/25 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
              style={{ borderColor: "rgba(13,13,13,.14)" }}
            >
              <FileUp size={12} aria-hidden /> Escolher arquivo CSV
            </button>
            <input ref={arquivoRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={escolherArquivo} />
            <span className="text-[0.625rem] text-black/40">{arquivo || "Copie as células no Excel e cole aqui, ou salve a planilha como CSV."}</span>
          </div>
        </div>

        {texto.trim() && !tabela && (
          <p className="flex items-start gap-1.5 text-[0.6875rem] text-black/60"><AlertTriangle size={12} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#B07A14]" aria-hidden />Não deu para ler a tabela: ela precisa do cabeçalho e de ao menos uma linha.</p>
        )}

        {tabela && mapa && (
          <>
            <fieldset>
              <legend className="mb-2 text-[0.75rem] font-semibold text-[#282525]">Colunas</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {CAMPOS_DA_IMPORTACAO.map(c => (
                  <div key={c.campo}>
                    <span className={ROTULO}>{c.rotulo}</span>
                    <Dropdown
                      value={mapa[c.campo]}
                      onChange={v => setEscolhido({ chave, mapa: { ...mapa, [c.campo]: v } })}
                      options={colunas}
                      ariaLabel={`Coluna de ${c.rotulo.toLowerCase()}`}
                    />
                  </div>
                ))}
              </div>
              {semNome && <p className="mt-2 text-[0.6875rem] text-[#B23B3B]">Escolha a coluna do nome.</p>}
            </fieldset>

            {resultado && !semNome && (
              <div className="space-y-2">
                <p className="text-[0.6875rem] text-black/55">
                  Prévia das primeiras linhas{resultado.ignoradas ? ` · ${resultado.ignoradas} ${resultado.ignoradas === 1 ? "linha sem nome fica" : "linhas sem nome ficam"} de fora` : ""}
                  {jaCadastrados ? ` · a relação já tem ${jaCadastrados}: a importação soma, não substitui` : ""}
                </p>
                <div className="overflow-x-auto rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <table className="w-full text-[0.6875rem]">
                    <thead>
                      <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                        <th className={CABECALHO}>Nome</th>
                        <th className={CABECALHO}>Sexo</th>
                        <th className={`${CABECALHO} text-right`}>Idade</th>
                        <th className={CABECALHO}>Rede</th>
                        <th className={CABECALHO}>Modalidade</th>
                        <th className={CABECALHO}>Benefícios</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.linhas.slice(0, 5).map((l, i) => (
                        <tr key={i} className="border-b last:border-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                          <td className="px-3 py-2 text-black/80">{l.nome}</td>
                          <td className="px-3 py-2 text-black/60">{l.sexo ? ROTULO_DO_SEXO[l.sexo] : <span className="text-black/30">—</span>}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-black/60">{l.idade ?? <span className="text-black/30">—</span>}</td>
                          <td className="px-3 py-2 text-black/60">{rotuloDaRede(l.rede_publica)}</td>
                          <td className="px-3 py-2 text-black/60">{l.modalidade ?? <span className="text-black/30">—</span>}</td>
                          <td className="px-3 py-2 text-black/60">{l.beneficios.join(", ") || <span className="text-black/30">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {resultado.avisos.length > 0 && (
                  <ul className="space-y-0.5">
                    {resultado.avisos.map(a => (
                      <li key={a} className="flex items-start gap-1.5 text-[0.6875rem] text-black/60"><AlertTriangle size={12} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#B07A14]" aria-hidden />{a}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}

        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "rgba(178,59,59,.35)" }}>{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}
