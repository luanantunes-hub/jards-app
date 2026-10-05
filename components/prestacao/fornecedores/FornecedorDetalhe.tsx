"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Info, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { consultarFornecedor } from "@/components/prestacao/fornecedores/FornecedorModal";
import { EtiquetaResultadoCertidao, EtiquetaSancoes, EtiquetaSituacao } from "@/components/prestacao/fornecedores/EtiquetasFornecedor";
import { alertasDoFornecedor, cnpjValido, formatarDocumento, nomeDoFornecedor, TIPOS_PESSOA } from "@/lib/prestacao/fornecedores";
import type { PrestacaoFornecedor } from "@/lib/supabase/types";

const dataCurta = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—");
const dataHora = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const SECAO = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35";

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.625rem] text-black/40">{rotulo}</dt>
      <dd className="text-[0.75rem] text-black/75">{children}</dd>
    </div>
  );
}

/** Tudo o que se sabe do fornecedor: alertas, Receita, sócios e certidões de sanções. */
export function FornecedorDetalhe({ fornecedor, podeEditar, onClose, onEditar, onExcluir, onAtualizado }: {
  fornecedor: PrestacaoFornecedor;
  podeEditar: boolean;
  onClose: () => void;
  onEditar: () => void;
  onExcluir: () => void;
  onAtualizado: (fornecedor: PrestacaoFornecedor) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState("");
  const f = fornecedor;
  const alertas = alertasDoFornecedor(f);
  const temCnpj = (f.tipo_pessoa === "pj" || f.tipo_pessoa === "mei") && cnpjValido(f.documento);

  async function consultar() {
    setConsultando(true);
    setErro("");
    const atualizado = await consultarFornecedor(supabase, f.id);
    setConsultando(false);
    if (atualizado) onAtualizado(atualizado);
    else setErro("A consulta não respondeu agora. Tente de novo em alguns minutos.");
  }

  return (
    <ModalPrestacao
      titulo={nomeDoFornecedor(f)}
      subtitulo={[TIPOS_PESSOA.find(t => t.id === f.tipo_pessoa)?.rotulo, formatarDocumento(f.documento, { mascararCpf: f.tipo_pessoa === "pf" })].filter(Boolean).join(" · ")}
      onClose={onClose}
      largura="max-w-[44rem]"
      rodape={podeEditar ? <>
        <button type="button" onClick={onExcluir} className="flex items-center gap-1.5 rounded px-2 py-2 text-[0.75rem] text-[#B23B3B]/80 transition hover:bg-black/[.04] hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#D94A4A]">
          <Trash2 size={13} aria-hidden /> Excluir
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {temCnpj && (
            <button type="button" onClick={consultar} disabled={consultando} className="flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.75rem] text-black/70 transition hover:border-black/25 hover:text-black/90 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:cursor-wait disabled:text-black/40" style={{ borderColor: "rgba(13,13,13,.14)" }}>
              <RefreshCw size={13} aria-hidden className={consultando ? "animate-spin motion-reduce:animate-none" : ""} /> {consultando ? "Consultando…" : "Consultar de novo"}
            </button>
          )}
          <button type="button" onClick={onEditar} className="flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.75rem] text-black/70 transition hover:border-black/25 hover:text-black/90 focus-visible:outline-2 focus-visible:outline-[#7259B5]" style={{ borderColor: "rgba(13,13,13,.14)" }}>
            <Pencil size={13} aria-hidden /> Editar
          </button>
        </div>
      </> : <><span /><button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Fechar</button></>}
    >
      <div className="space-y-6 px-6 py-5">
        {(alertas.length > 0 || erro) && (
          <ul className="space-y-1.5">
            {erro && <li role="alert" className="text-[0.75rem] text-[#B23B3B]">{erro}</li>}
            {alertas.map(a => (
              <li key={a.codigo + a.texto} className={`flex items-start gap-2 text-[0.75rem] ${a.nivel === "alerta" ? "text-[#B23B3B]" : "text-black/55"}`}>
                {a.nivel === "alerta" ? <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden /> : <Info size={13} className="mt-0.5 shrink-0" aria-hidden />}
                {a.texto}
              </li>
            ))}
          </ul>
        )}

        {temCnpj && (
          <section aria-labelledby="receita-titulo">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 id="receita-titulo" className={SECAO}>Receita Federal</h3>
              <span className="text-[0.625rem] text-black/35">Consulta de {dataHora(f.cnpj_consultado_em)}</span>
            </div>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <Dado rotulo="Razão social">{f.razao_social ?? "—"}</Dado>
              <Dado rotulo="Nome fantasia">{f.nome_fantasia ?? "—"}</Dado>
              <Dado rotulo="Situação"><span className="flex items-center gap-2"><EtiquetaSituacao fornecedor={f} />{f.data_situacao && <span className="text-[0.625rem] text-black/40">desde {dataCurta(f.data_situacao)}</span>}</span></Dado>
              <Dado rotulo="Abertura">{dataCurta(f.data_abertura)}</Dado>
              <Dado rotulo="Natureza jurídica">{f.natureza_juridica ?? "—"}</Dado>
              <Dado rotulo="Porte">{f.porte ?? "—"}{f.opcao_mei ? " · MEI" : ""}</Dado>
              <Dado rotulo="Município">{[f.municipio, f.uf].filter(Boolean).join(" / ") || "—"}</Dado>
              <Dado rotulo="CNAE principal">{f.cnae_principal ? <><span className="tabular-nums">{f.cnae_principal}</span> · {f.cnae_descricao}</> : "—"}</Dado>
            </dl>
            {(f.cnaes_secundarios?.length ?? 0) > 0 && (
              <details className="mt-3 text-[0.75rem]">
                <summary className="cursor-pointer rounded text-[0.6875rem] font-medium text-[#684DB0] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  {f.cnaes_secundarios!.length} {f.cnaes_secundarios!.length === 1 ? "CNAE secundário" : "CNAEs secundários"}
                </summary>
                <ul className="mt-2 space-y-1">
                  {f.cnaes_secundarios!.map(c => <li key={c.codigo} className="text-black/65"><span className="tabular-nums text-black/45">{c.codigo}</span> · {c.descricao}</li>)}
                </ul>
              </details>
            )}
          </section>
        )}

        {temCnpj && (
          <section aria-labelledby="sancoes-titulo">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 id="sancoes-titulo" className={SECAO}>Sanções</h3>
              <span className="flex items-center gap-2 text-[0.625rem] text-black/35"><EtiquetaSancoes fornecedor={f} /> {dataHora(f.sancoes_consultadas_em)}</span>
            </div>
            {(f.sancoes?.length ?? 0) > 0 ? (
              <ul className="divide-y divide-black/[.05] rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                {f.sancoes!.map((c, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[0.75rem] text-black/75">{c.descricao ?? c.tipo}</p>
                      <p className="text-[0.625rem] text-black/40">{[c.emissor, c.tipo].filter(Boolean).join(" · ")}{c.emitida_em ? ` · emitida em ${c.emitida_em}` : ""}</p>
                      {c.observacao && <p className="mt-0.5 text-[0.6875rem] text-black/60">{c.observacao}</p>}
                    </div>
                    <EtiquetaResultadoCertidao resultado={c.resultado} situacao={c.situacao} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.75rem] text-black/45">
                {f.sancoes_situacao === "indisponivel" ? "A consulta consolidada do TCU não respondeu." : "Ainda não consultado."}
              </p>
            )}
            <p className="mt-2 text-[0.625rem] text-black/35">Consulta consolidada do TCU: inidôneos do TCU, CNIA do CNJ, CEIS e CNEP da CGU.</p>
          </section>
        )}

        {(f.socios?.length ?? 0) > 0 && (
          <section aria-labelledby="socios-titulo">
            <h3 id="socios-titulo" className={`${SECAO} mb-2`}>Quadro societário ({f.socios!.length})</h3>
            <ul className="max-h-[16rem] divide-y divide-black/[.05] overflow-y-auto rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              {f.socios!.map((s, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-2">
                  <span className="text-[0.75rem] text-black/75">{s.nome}</span>
                  <span className="text-[0.625rem] text-black/40">{[s.qualificacao, s.documento, s.entrada ? `desde ${dataCurta(s.entrada)}` : null].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(f.grupo_economico || f.observacoes) && (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {f.grupo_economico && <Dado rotulo="Grupo econômico">{f.grupo_economico}</Dado>}
            {f.observacoes && <Dado rotulo="Observações"><span className="whitespace-pre-line">{f.observacoes}</span></Dado>}
          </dl>
        )}
      </div>
    </ModalPrestacao>
  );
}
