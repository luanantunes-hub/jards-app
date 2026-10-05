"use client";

import { useMemo, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao as Modal } from "@/components/prestacao/ModalPrestacao";
import { montarCaminhoPrestacao } from "@/lib/prestacao/armazenamento";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";
import {
  adivinharColuna,
  ajustarAoRegime,
  agrupadorPorNome,
  etapasParaCriar,
  lerTabela,
  linhasDaLeitura,
  linhasDaTabela,
  rotuloGrupo,
  sugerirGrupoDoRegime,
  type GrupoCusto,
  type LinhaImportada,
  type MapaDeColunas,
  type NoOrcamento,
  type TabelaLida,
} from "@/lib/prestacao/orcamento";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";

/**
 * Importa o orçamento aprovado para a versão aberta: CSV ou TSV com mapa de
 * colunas, ou PDF lido pela IA (importar-orcamento). Uma coluna de etapa vira
 * agrupador; o grupo de custo é sugerido pelo nome e pode ser revisto depois.
 */
export function ImportarOrcamento({ prestacaoId, organizationId, versaoId, garantirVersao, nos, onImported, disabled, regime = null }: {
  prestacaoId: string;
  /** Regime da prestação: o grupo de custo sugerido é um dos dele. */
  regime?: RegimeNormativo | null;
  organizationId: string | null;
  versaoId: string | null;
  garantirVersao: () => Promise<string | null>;
  nos: NoOrcamento[];
  onImported: (mensagem: string) => void;
  disabled?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState("");
  const [erro, setErro] = useState("");
  const [tabela, setTabela] = useState<TabelaLida | null>(null);
  const [mapa, setMapa] = useState<MapaDeColunas>({ nome: "", valor: "", descricao: "", etapa: "" });
  const [previa, setPrevia] = useState<LinhaImportada[] | null>(null);
  const [gravando, setGravando] = useState(false);

  async function escolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setErro("");
    const nome = arquivo.name.toLowerCase();

    if (/\.(csv|tsv|txt)$/.test(nome)) {
      const lida = lerTabela(await arquivo.text());
      if (!lida) { setErro("Não foi possível ler o arquivo. Confira se é um CSV ou TSV com cabeçalho."); return; }
      const nomeCol = adivinharColuna(lida.cabecalho, ["item", "despesa", "rubrica", "descricao do item", "nome"]);
      const valorCol = adivinharColuna(lida.cabecalho, ["valor total", "total", "aprovado", "valor", "previsto", "orcado"], [nomeCol]);
      setMapa({
        nome: nomeCol,
        valor: valorCol,
        descricao: adivinharColuna(lida.cabecalho, ["justificativa", "especificacao", "detalhe", "descricao", "obs"], [nomeCol, valorCol]),
        etapa: adivinharColuna(lida.cabecalho, ["etapa", "produto", "fase", "grupo", "categoria"], [nomeCol, valorCol]),
      });
      setTabela(lida);
      return;
    }

    if (nome.endsWith(".pdf")) {
      if (!organizationId) { setErro("A prestação ainda está carregando. Tente de novo em instantes."); return; }
      setLendo("Enviando o PDF…");
      const caminho = montarCaminhoPrestacao({ organizationId, prestacaoId, pasta: { tipo: "orcamento" }, nomeOriginal: arquivo.name });
      const { error: erroEnvio } = await supabase.storage.from("documentos").upload(caminho, arquivo, { upsert: false });
      if (erroEnvio) { setLendo(""); setErro("Não foi possível enviar o PDF."); return; }
      setLendo("Lendo o orçamento…");
      let linhas: LinhaImportada[] = [];
      try {
        const { data } = await supabase.functions.invoke("importar-orcamento", { body: { storage_path: caminho, prestacao_id: prestacaoId } });
        linhas = ajustarAoRegime(linhasDaLeitura(data?.itens), regime);
      } catch {
        linhas = [];
      }
      // O PDF só serve para a leitura: sai do storage em qualquer resultado.
      await supabase.storage.from("documentos").remove([caminho]);
      setLendo("");
      if (linhas.length === 0) { setErro("Não encontramos itens com valor no PDF. Tente exportar a planilha como CSV."); return; }
      setPrevia(linhas);
      return;
    }

    setErro("Formato não aceito. Use CSV, TSV ou PDF.");
  }

  function verPrevia() {
    if (!tabela) return;
    const linhas = ajustarAoRegime(linhasDaTabela(tabela, mapa), regime);
    if (linhas.length === 0) { setErro("Nenhuma linha com nome e valor nessa combinação de colunas."); return; }
    setErro("");
    setTabela(null);
    setPrevia(linhas);
  }

  async function importar() {
    if (!previa?.length) return;
    setGravando(true);
    setErro("");
    const versao = versaoId ?? await garantirVersao();
    if (!versao) { setGravando(false); setErro("Não foi possível criar a versão do orçamento."); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do orçamento ainda não estão no tipo Database
    const tabelaNos = (supabase as any).from("prestacao_orcamento_nos");
    let ordem = nos.reduce((maior, no) => Math.max(maior, no.ordem), -1) + 1;

    const novas = etapasParaCriar(previa, nos);
    let criadas: NoOrcamento[] = [];
    if (novas.length) {
      const { data, error } = await tabelaNos
        .insert(novas.map(nome => ({ versao_id: versao, tipo: "etapa", nome, grupo_custo: sugerirGrupoDoRegime(regime, nome), ordem: ordem++ })))
        .select("*");
      if (error) { setGravando(false); setErro(mensagemErroPrestacao(error, "Não foi possível criar as etapas")); return; }
      criadas = (data as NoOrcamento[]) ?? [];
    }

    const agrupadores = [...nos, ...criadas];
    const itens = previa.map(linha => {
      const etapa = linha.etapa ? agrupadorPorNome(agrupadores, linha.etapa) : null;
      // Igual ao grupo da etapa: o item herda em vez de repetir.
      const grupo: GrupoCusto | null = linha.grupo_custo && linha.grupo_custo !== etapa?.grupo_custo ? linha.grupo_custo : null;
      return {
        versao_id: versao,
        parent_id: etapa?.id ?? null,
        tipo: "item",
        nome: linha.nome,
        descricao: linha.descricao,
        valor_total: linha.valor,
        grupo_custo: grupo,
        ordem: ordem++,
      };
    });
    const { error } = await tabelaNos.insert(itens);
    setGravando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível importar os itens")); return; }
    setPrevia(null);
    onImported(`${itens.length} ${itens.length === 1 ? "item importado" : "itens importados"}${novas.length ? ` em ${novas.length} ${novas.length === 1 ? "etapa nova" : "etapas novas"}` : ""}.`);
  }

  const colunas = tabela?.cabecalho.map((titulo, i) => ({ value: String(i), label: titulo || `Coluna ${i + 1}` })) ?? [];
  const exemplo = tabela?.linhas.slice(0, 3) ?? [];

  return (
    <>
      <button
        type="button"
        onClick={() => arquivoRef.current?.click()}
        disabled={disabled || Boolean(lendo)}
        className="flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.75rem] text-black/65 transition hover:border-black/25 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: "rgba(13,13,13,.14)" }}
      >
        {lendo
          ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-black/15 border-t-black/55 motion-reduce:animate-none" />{lendo}</>
          : <><Upload size={13} aria-hidden /> Importar CSV ou PDF</>}
      </button>
      <input ref={arquivoRef} type="file" accept=".csv,.tsv,.txt,.pdf" className="hidden" onChange={escolherArquivo} />
      {erro && !tabela && !previa && (
        <p role="alert" className="basis-full text-[0.6875rem] text-[#B23B3B]">{erro}</p>
      )}

      {tabela && (
        <Modal
          titulo="Colunas do arquivo"
          subtitulo={`${tabela.cabecalho.length} colunas · ${tabela.linhas.length} linhas`}
          onClose={() => { setTabela(null); setErro(""); }}
          largura="max-w-[36rem]"
          rodape={<>
            <button type="button" onClick={() => { setTabela(null); setErro(""); }} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70">Cancelar</button>
            <button
              type="button"
              onClick={verPrevia}
              disabled={mapa.nome === "" || mapa.valor === ""}
              className="rounded bg-[#0D0D0D] px-4 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ver prévia
            </button>
          </>}
        >
          <div className="space-y-4 px-6 py-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {([
                ["nome", "Item *", "Escolher coluna"],
                ["valor", "Valor total *", "Escolher coluna"],
                ["etapa", "Etapa ou agrupador", "Não usar"],
                ["descricao", "Descrição", "Não usar"],
              ] as const).map(([campo, rotulo, vazio]) => (
                <div key={campo}>
                  <span className={ROTULO}>{rotulo}</span>
                  <Dropdown
                    value={mapa[campo]}
                    onChange={valor => setMapa({ ...mapa, [campo]: valor })}
                    ariaLabel={rotulo.replace(" *", "")}
                    options={[{ value: "", label: vazio }, ...colunas]}
                  />
                </div>
              ))}
            </div>
            {exemplo.length > 0 && mapa.nome !== "" && (
              <div className="overflow-x-auto rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <table className="w-full text-[0.6875rem]">
                  <caption className="border-b px-3 py-2 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                    Primeiras linhas
                  </caption>
                  <tbody>
                    {exemplo.map((linha, i) => (
                      <tr key={i} className="border-b last:border-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                        <td className="max-w-[12rem] truncate px-3 py-1.5 text-black/70">{linha[Number(mapa.nome)] || "—"}</td>
                        {mapa.etapa !== "" && <td className="max-w-[8rem] truncate px-3 py-1.5 text-black/45">{linha[Number(mapa.etapa)] || "—"}</td>}
                        {mapa.valor !== "" && <td className="px-3 py-1.5 text-right tabular-nums text-black/70">{linha[Number(mapa.valor)] || "—"}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {erro && <p role="alert" className="text-[0.75rem] text-[#B23B3B]">{erro}</p>}
          </div>
        </Modal>
      )}

      {previa && (
        <Modal
          titulo="Prévia da importação"
          subtitulo={`${previa.length} ${previa.length === 1 ? "item" : "itens"} · entram na versão aberta, depois dos que já existem`}
          onClose={() => { setPrevia(null); setErro(""); }}
          rodape={<>
            <p className="text-[0.75rem] text-black/50">Total <strong className="tabular-nums text-black/75">{fmt(previa.reduce((soma, linha) => soma + linha.valor, 0))}</strong></p>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => { setPrevia(null); setErro(""); }} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70">Cancelar</button>
              <button
                type="button"
                onClick={importar}
                disabled={gravando}
                className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {gravando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
                Importar
              </button>
            </div>
          </>}
        >
          <table className="w-full text-[0.75rem]">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                {["Item", "Etapa", "Grupo de custo", "Valor"].map(titulo => (
                  <th key={titulo} scope="col" className={`px-4 py-2.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35 ${titulo === "Valor" ? "text-right" : "text-left"}`}>{titulo}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previa.map((linha, i) => (
                <tr key={i} className="border-b last:border-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                  <td className="px-4 py-2">
                    <p className="text-black/80">{linha.nome}</p>
                    {linha.descricao && <p className="max-w-[16rem] truncate text-[0.625rem] text-black/40">{linha.descricao}</p>}
                  </td>
                  <td className="px-4 py-2 text-black/50">{linha.etapa ?? "—"}</td>
                  <td className={`px-4 py-2 ${linha.grupo_custo ? "text-[#684DB0]" : "text-black/30"}`}>{linha.grupo_custo ? rotuloGrupo(linha.grupo_custo, regime) : "Sem grupo"}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-black/75">{fmt(linha.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {erro && <p role="alert" className="px-6 py-3 text-[0.75rem] text-[#B23B3B]">{erro}</p>}
        </Modal>
      )}
    </>
  );
}
