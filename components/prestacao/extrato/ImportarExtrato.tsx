"use client";

import { useMemo, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { rotuloDaConta } from "@/components/prestacao/extrato/ContaBancariaModal";
import { montarCaminhoPrestacao } from "@/lib/prestacao/armazenamento";
import {
  CATEGORIAS_LANCAMENTO,
  chavesDosLancamentos,
  conferirSaldo,
  decodificarArquivo,
  ehOfx,
  hashDoArquivo,
  lerCsvExtrato,
  lerOfx,
  normalizarDocumento,
  totaisDoExtrato,
  type ExtratoLido,
  type MapaExtrato,
} from "@/lib/prestacao/extrato";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { TabelaLida } from "@/lib/prestacao/orcamento";
import type { PrestacaoContaBancaria } from "@/lib/supabase/types";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataCurta = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const MAX_PREVIA = 60;

const CAMPOS_DO_MAPA: [keyof MapaExtrato, string][] = [
  ["data", "Data *"],
  ["historico", "Histórico"],
  ["detalhe", "Detalhe"],
  ["documento", "Nº do documento"],
  ["valor", "Valor (com sinal)"],
  ["natureza", "Crédito ou débito (C/D)"],
  ["credito", "Crédito"],
  ["debito", "Débito"],
  ["saldo", "Saldo"],
];

type Lido = { arquivo: File; bytes: Uint8Array; texto: string; extrato: ExtratoLido; csv: { tabela: TabelaLida; mapa: MapaExtrato } | null };

/** Conta do arquivo (OFX) diferente da escolhida, comparando só os algarismos. */
function contaDiferente(extrato: ExtratoLido, conta: PrestacaoContaBancaria | undefined): boolean {
  const doArquivo = normalizarDocumento(extrato.conta?.conta);
  const daConta = normalizarDocumento(conta?.conta);
  return Boolean(doArquivo && daConta && !doArquivo.endsWith(daConta) && !daConta.endsWith(doArquivo));
}

export function ImportarExtrato({ prestacaoId, organizationId, contas, contaInicial, onClose, onImported }: {
  prestacaoId: string;
  organizationId: string | null;
  contas: PrestacaoContaBancaria[];
  contaInicial: string;
  onClose: () => void;
  onImported: (mensagem: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [contaId, setContaId] = useState(contaInicial || contas[0]?.id || "");
  const [lido, setLido] = useState<Lido | null>(null);
  const [verColunas, setVerColunas] = useState(false);
  const [erro, setErro] = useState("");
  const [gravando, setGravando] = useState(false);

  const conta = contas.find(c => c.id === contaId);
  const extrato = lido?.extrato ?? null;
  const totais = extrato ? totaisDoExtrato(extrato.lancamentos) : null;
  const conferencia = extrato ? conferirSaldo(extrato) : null;

  async function escolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setErro("");
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const texto = decodificarArquivo(bytes);
    if (ehOfx(texto)) {
      const ofx = lerOfx(texto);
      if (ofx.lancamentos.length === 0) { setErro("O arquivo OFX não tem lançamentos."); setLido(null); return; }
      setLido({ arquivo, bytes, texto, extrato: ofx, csv: null });
      return;
    }
    const csv = lerCsvExtrato(texto);
    if (!csv) { setErro("Não foi possível ler o arquivo. Use o OFX do banco ou um CSV com cabeçalho."); setLido(null); return; }
    setLido({ arquivo, bytes, texto, extrato: csv.extrato, csv: { tabela: csv.tabela, mapa: csv.mapa } });
    setVerColunas(csv.extrato.lancamentos.length === 0);
    if (csv.extrato.lancamentos.length === 0) setErro("Nenhum lançamento reconhecido. Indique as colunas abaixo.");
  }

  function trocarColuna(campo: keyof MapaExtrato, valor: string) {
    if (!lido?.csv) return;
    const mapa = { ...lido.csv.mapa, [campo]: valor };
    const relido = lerCsvExtrato(lido.texto, mapa);
    if (!relido) return;
    setErro(relido.extrato.lancamentos.length === 0 ? "Nenhum lançamento com data e valor nessa combinação de colunas." : "");
    setLido({ ...lido, extrato: relido.extrato, csv: { tabela: relido.tabela, mapa } });
  }

  async function importar() {
    if (!lido || !extrato?.lancamentos.length || !contaId) return;
    if (!organizationId) { setErro("A prestação ainda está carregando. Tente de novo em instantes."); return; }
    setGravando(true);
    setErro("");
    const caminho = montarCaminhoPrestacao({ organizationId, prestacaoId, pasta: { tipo: "extratos" }, nomeOriginal: lido.arquivo.name });
    const { error: erroEnvio } = await supabase.storage.from("documentos").upload(caminho, lido.arquivo, { upsert: false });
    if (erroEnvio) { setGravando(false); setErro("Não foi possível enviar o arquivo."); return; }

    const chaves = chavesDosLancamentos(extrato.lancamentos);
    const { data, error } = await supabase.rpc("fn_prestacao_extrato_importar" as never, {
      p_conta_id: contaId,
      p_importacao: {
        formato: extrato.formato,
        nome_arquivo: lido.arquivo.name,
        storage_path: caminho,
        hash_arquivo: await hashDoArquivo(lido.bytes),
        periodo_inicio: extrato.periodo?.inicio ?? null,
        periodo_fim: extrato.periodo?.fim ?? null,
        saldo_inicial: extrato.saldoInicial,
        saldo_final: extrato.saldoFinal,
      },
      p_lancamentos: extrato.lancamentos.map((l, i) => ({
        data: l.data,
        natureza: l.natureza,
        valor: l.valor,
        historico: l.historico,
        numero_documento: l.documento,
        numero_normalizado: l.documentoNormalizado,
        id_externo: l.idExterno,
        categoria: l.categoria,
        saldo_apos: l.saldoApos,
        chave: chaves[i],
      })),
    } as never);
    setGravando(false);
    if (error) {
      // Nada foi gravado: o arquivo enviado sai do storage.
      await supabase.storage.from("documentos").remove([caminho]);
      setErro(mensagemErroPrestacao(error, "Não foi possível importar o extrato"));
      return;
    }
    const resultado = data as { novos: number; repetidos: number } | null;
    const novos = resultado?.novos ?? extrato.lancamentos.length;
    const repetidos = resultado?.repetidos ?? 0;
    onImported(`${novos} ${novos === 1 ? "lançamento importado" : "lançamentos importados"}${repetidos ? `; ${repetidos} já ${repetidos === 1 ? "estava" : "estavam"} no extrato` : ""}.`);
  }

  const colunas = lido?.csv?.tabela.cabecalho.map((titulo, i) => ({ value: String(i), label: titulo || `Coluna ${i + 1}` })) ?? [];
  const quantidade = extrato?.lancamentos.length ?? 0;

  return (
    <ModalPrestacao
      titulo="Importar extrato"
      subtitulo="OFX ou CSV exportado do banco. Lançamentos que já estão no extrato ficam de fora."
      onClose={onClose}
      largura="max-w-[48rem]"
      rodape={<>
        <p className="text-[0.75rem] text-black/50">
          {quantidade > 0 ? <><strong className="tabular-nums text-black/75">{quantidade}</strong> {quantidade === 1 ? "lançamento" : "lançamentos"}</> : "Escolha o arquivo"}
        </p>
        <div className="flex items-center gap-4">
          <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button
            type="button"
            onClick={importar}
            disabled={gravando || quantidade === 0 || !contaId}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {gravando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
            Importar
          </button>
        </div>
      </>}
    >
      <div className="space-y-5 px-6 py-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <span className={ROTULO}>Conta</span>
            <Dropdown
              value={contaId}
              onChange={setContaId}
              ariaLabel="Conta do extrato"
              options={contas.map(c => ({ value: c.id, label: rotuloDaConta(c) }))}
            />
          </div>
          <button
            type="button"
            onClick={() => arquivoRef.current?.click()}
            className="flex h-10 items-center justify-center gap-1.5 rounded border bg-white px-4 text-[0.75rem] text-black/70 transition hover:border-black/25 hover:text-black/90 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
            style={{ borderColor: "rgba(13,13,13,.14)" }}
          >
            <FileUp size={14} aria-hidden /> {lido ? "Trocar arquivo" : "Escolher arquivo"}
          </button>
          <input ref={arquivoRef} type="file" accept=".ofx,.csv,.txt,.tsv" className="hidden" onChange={escolherArquivo} />
        </div>

        {lido && extrato && totais && conferencia && (
          <>
            <div className="rounded border px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="truncate text-[0.75rem] font-medium text-black/75" title={lido.arquivo.name}>
                {lido.arquivo.name} <span className="font-normal text-black/40">· {extrato.formato.toUpperCase()}</span>
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-[0.6875rem] sm:grid-cols-4">
                <div><dt className="text-black/40">Período</dt><dd className="tabular-nums text-black/75">{extrato.periodo ? `${dataCurta(extrato.periodo.inicio)} a ${dataCurta(extrato.periodo.fim)}` : "—"}</dd></div>
                <div><dt className="text-black/40">Créditos</dt><dd className="tabular-nums text-[#1A8B7A]">{fmt(totais.creditos)}</dd></div>
                <div><dt className="text-black/40">Débitos</dt><dd className="tabular-nums text-black/75">{fmt(totais.debitos)}</dd></div>
                <div><dt className="text-black/40">Saldo final</dt><dd className="tabular-nums text-black/75">{extrato.saldoFinal === null ? "—" : fmt(extrato.saldoFinal)}</dd></div>
              </dl>
              <p className="mt-2 text-[0.6875rem]" role="status">
                {conferencia.situacao === "confere" && <span className="text-[#2E8932]">Saldo inicial + créditos − débitos bate com o saldo final do arquivo.</span>}
                {conferencia.situacao === "diverge" && <span className="text-[#B23B3B]">O saldo não bate: o arquivo diz {fmt(conferencia.informado)}, a soma dá {fmt(conferencia.esperado)} (diferença de {fmt(conferencia.diferenca)}). Confira se o arquivo está completo.</span>}
                {conferencia.situacao === "sem_saldos" && <span className="text-black/45">O arquivo não traz saldo inicial e final, então a soma não pôde ser conferida.</span>}
              </p>
              {contaDiferente(extrato, conta) && (
                <p className="mt-1 text-[0.6875rem] text-[#B07A14]">O arquivo é da conta {extrato.conta?.conta}, e a conta escolhida é {conta?.conta}. Confira antes de importar.</p>
              )}
              {extrato.avisos.map(aviso => <p key={aviso} className="mt-1 text-[0.6875rem] text-black/45">{aviso}</p>)}
            </div>

            {lido.csv && (
              <div>
                <button
                  type="button"
                  onClick={() => setVerColunas(!verColunas)}
                  aria-expanded={verColunas}
                  className="rounded text-[0.6875rem] font-medium text-[#684DB0] transition hover:text-[#4F3A8C] focus-visible:outline-2 focus-visible:outline-[#7259B5]"
                >
                  {verColunas ? "Ocultar colunas do arquivo" : "Ajustar colunas do arquivo"}
                </button>
                {verColunas && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {CAMPOS_DO_MAPA.map(([campo, rotulo]) => (
                      <div key={campo}>
                        <span className={ROTULO}>{rotulo}</span>
                        <Dropdown
                          value={lido.csv!.mapa[campo]}
                          onChange={valor => trocarColuna(campo, valor)}
                          ariaLabel={rotulo.replace(" *", "")}
                          options={[{ value: "", label: "Não usar" }, ...colunas]}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {quantidade > 0 && (
              <div className="overflow-x-auto rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <p className="border-b px-3 py-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                  {quantidade > MAX_PREVIA ? `Primeiros ${MAX_PREVIA} de ${quantidade}` : "Lançamentos"}
                </p>
                <table className="hidden w-full text-[0.6875rem] sm:table" aria-label="Prévia dos lançamentos">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                      {["Data", "Histórico", "Categoria", "Valor"].map(titulo => (
                        <th key={titulo} scope="col" className={`px-3 py-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35 ${titulo === "Valor" ? "text-right" : "text-left"}`}>{titulo}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {extrato.lancamentos.slice(0, MAX_PREVIA).map((l, i) => (
                      <tr key={i} className="border-b last:border-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                        <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-black/55">{dataCurta(l.data)}</td>
                        <td className="max-w-[18rem] px-3 py-1.5">
                          <p className="truncate text-black/75" title={l.historico}>{l.historico || "—"}</p>
                          {l.documento && <p className="truncate text-[0.625rem] text-black/35">Doc. {l.documento}</p>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-black/50">{CATEGORIAS_LANCAMENTO.find(c => c.id === l.categoria)?.rotulo}</td>
                        <td className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${l.natureza === "credito" ? "text-[#1A8B7A]" : "text-black/75"}`}>
                          {l.natureza === "credito" ? "+" : "−"} {fmt(l.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="divide-y divide-black/[.05] sm:hidden">
                  {extrato.lancamentos.slice(0, MAX_PREVIA).map((l, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[0.6875rem] text-black/75">{l.historico || "—"}</p>
                        <p className="text-[0.625rem] text-black/40">
                          <span className="tabular-nums">{dataCurta(l.data)}</span> · {CATEGORIAS_LANCAMENTO.find(c => c.id === l.categoria)?.rotulo}
                          {l.documento && <> · Doc. {l.documento}</>}
                        </p>
                      </div>
                      <p className={`shrink-0 text-[0.6875rem] tabular-nums ${l.natureza === "credito" ? "text-[#1A8B7A]" : "text-black/75"}`}>
                        {l.natureza === "credito" ? "+" : "−"} {fmt(l.valor)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {erro && <p role="alert" className="text-[0.75rem] text-[#B23B3B]">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}
