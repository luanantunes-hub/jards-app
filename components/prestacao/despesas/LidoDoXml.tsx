"use client";

// O que veio do XML da nota (P2.10), para a pessoa conferir antes de enviar:
// emitente, tomador, número, chave, retenções e os avisos da leitura.

import { Fragment } from "react";
import { AlertTriangle, FileCode2, Info } from "lucide-react";
import { rotuloDoDocumento, type AvisoDoDocumento, type DocumentoFiscalLido, type ParteDoDocumento } from "@/lib/prestacao/documento-fiscal";
import { formatarDocumento } from "@/lib/prestacao/fornecedores";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function parte(p: ParteDoDocumento): string {
  return [p.nome, p.documento ? formatarDocumento(p.documento) : null].filter(Boolean).join(" · ") || "Não consta no XML";
}

const COR_DO_AVISO = { alerta: "#B23B3B", info: "#2D72B0" } as const;

export function LidoDoXml({ documento, avisos }: { documento: DocumentoFiscalLido; avisos: readonly AvisoDoDocumento[] }) {
  const { iss, inss, irrf, outras } = documento.retencoes;
  const retido = Math.round((iss + inss + irrf + outras) * 100) / 100;
  const retencoes = [
    iss > 0 && `ISS ${fmt(iss)}`,
    inss > 0 && `INSS ${fmt(inss)}`,
    irrf > 0 && `IRRF ${fmt(irrf)}`,
    outras > 0 && `outras ${fmt(outras)}`,
  ].filter(Boolean).join(" · ");
  const linhas: [string, string][] = [
    ["Emitente", parte(documento.emitente)],
    ["Tomador", parte(documento.tomador)],
    ["Número", [documento.numero, documento.serie ? `série ${documento.serie}` : null].filter(Boolean).join(" · ") || "Não consta no XML"],
    ...(documento.chave ? [["Chave", documento.chave.match(/.{1,4}/g)!.join(" ")] as [string, string]] : []),
    ...(retido > 0 ? [["Retenções", retencoes] as [string, string]] : []),
    ...(retido > 0 && documento.valor !== null ? [["Líquido", fmt(Math.round((documento.valor - retido) * 100) / 100)] as [string, string]] : []),
  ];

  return (
    <section aria-label="Dados lidos do XML" className="space-y-2.5 rounded border bg-white p-3" style={{ borderColor: "rgba(13,13,13,.1)" }}>
      <p className="flex items-center gap-1.5 text-[0.6875rem] text-black/60">
        <FileCode2 size={13} className="shrink-0 text-black/45" aria-hidden />
        Lido do XML da {rotuloDoDocumento(documento)}, sem IA. Confira antes de enviar.
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.6875rem]">
        {linhas.map(([rotulo, valor]) => (
          <Fragment key={rotulo}>
            <dt className="text-black/40">{rotulo}</dt>
            <dd className={`min-w-0 break-words text-black/75 ${rotulo === "Chave" || rotulo === "Líquido" || rotulo === "Retenções" ? "tabular-nums" : ""}`}>{valor}</dd>
          </Fragment>
        ))}
      </dl>
      {avisos.length > 0 && (
        <ul className="space-y-1.5">
          {avisos.map(aviso => {
            const cor = COR_DO_AVISO[aviso.nivel];
            const Icone = aviso.nivel === "alerta" ? AlertTriangle : Info;
            return (
              <li key={aviso.texto} className="flex items-start gap-1.5 rounded border bg-white px-2.5 py-1.5 text-[0.6875rem] leading-4" style={{ borderColor: `${cor}47`, color: cor }}>
                <Icone size={12} className="mt-0.5 shrink-0" aria-hidden />
                <span>{aviso.texto}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
