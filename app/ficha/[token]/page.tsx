// A ficha técnica do espaço, pelo link (PD3.5). Sem login: o servidor confere o código do link no banco (só o hash fica guardado), a revogação e a
// validade, e mostra a mesma ficha do PDF: o espaço, uma seção por sala e os equipamentos em uso (o contato só se o link foi gerado com ele).

import type { Metadata } from "next";
import { BotaoImprimir } from "@/components/producao/BotaoImprimir";
import { carregarFichaPublica, type ResultadoDaFichaPublica } from "@/lib/producao/ficha-publica";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Ficha técnica",
  robots: { index: false, follow: false },
};

// A ficha muda quando a casa atualiza: nunca vem pronta do cache.
export const dynamic = "force-dynamic";

const dataBr = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAF9] px-4">
      <div className="max-w-[28rem] rounded border bg-white px-6 py-8 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <h1 className="text-[1.0625rem] font-semibold text-[#282525]">{titulo}</h1>
        <p className="mt-2 text-[0.8125rem] text-black/55">{texto}</p>
      </div>
    </main>
  );
}

/** "Funcionamento: terça a domingo" → o rótulo em destaque e o valor ao lado; linha sem rótulo fica inteira. */
function Linha({ texto }: { texto: string }) {
  const i = texto.indexOf(": ");
  if (i < 1 || i > 40) return <li className="px-4 py-2.5 text-[0.875rem] text-[#282525]">{texto}</li>;
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5">
      <span className="w-40 shrink-0 text-[0.75rem] font-medium text-black/55">{texto.slice(0, i)}</span>
      <span className="min-w-0 flex-1 basis-48 break-words text-[0.875rem] text-[#282525]">{texto.slice(i + 2)}</span>
    </li>
  );
}

export default async function FichaPeloLink({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let resultado: ResultadoDaFichaPublica | null = null;
  try {
    resultado = await carregarFichaPublica(createAdminClient(), token);
  } catch {
    resultado = null;
  }
  if (resultado === null) return <Aviso titulo="Não foi possível abrir a ficha" texto="Tente de novo em instantes." />;
  if (resultado.situacao === "revogado") return <Aviso titulo="Esta ficha foi desativada" texto="Peça o endereço novo a quem enviou." />;
  if (resultado.situacao === "expirado") return <Aviso titulo="Este endereço venceu" texto="Peça um endereço novo a quem enviou." />;
  if (resultado.situacao !== "valido") return <Aviso titulo="Ficha não encontrada" texto="Confira o endereço que você recebeu." />;

  const { documento, organizacao, validoAte } = resultado;
  return (
    <main className="min-h-screen bg-[#FAFAF9] px-4 py-8 sm:py-12 print:bg-white print:py-0">
      <div className="mx-auto w-full max-w-[44rem]">
        {/* eslint-disable-next-line @next/next/no-img-element -- o logo é um endereço https que a casa cadastrou, de qualquer site: o otimizador do Next não serve */}
        {documento.logoUrl && <img src={documento.logoUrl} alt="" className="mb-4 h-12 w-auto max-w-[14rem] object-contain" />}
        {organizacao && <p className="text-[0.6875rem] font-medium uppercase tracking-[.08em] text-black/45">{organizacao}</p>}
        <h1 className="mt-1 text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">{documento.titulo}</h1>
        {documento.subtitulo && <p className="mt-0.5 text-[0.8125rem] text-black/55">{documento.subtitulo}</p>}
        <div className="mt-4 print:hidden">
          <BotaoImprimir className="inline-flex h-9 items-center gap-1.5 rounded border border-black/[.12] bg-white px-3 text-[0.75rem] font-medium text-black/65 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]" />
        </div>

        <div className="mt-6 space-y-5">
          {documento.secoes.filter(secao => secao.linhas.length > 0).map(secao => (
            <section key={secao.titulo} aria-label={secao.titulo} className="print:break-inside-avoid">
              <h2 className="mb-2 text-[0.75rem] font-medium uppercase tracking-[.08em] text-black/50">{secao.titulo}</h2>
              <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.1)" }}>
                {secao.linhas.map((linha, indice) => <Linha key={`${secao.titulo}-${indice}`} texto={linha} />)}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-6 text-[0.6875rem] text-black/40">Este endereço vale até {dataBr(validoAte)}. A ficha é atualizada pela casa.</p>
      </div>
    </main>
  );
}
