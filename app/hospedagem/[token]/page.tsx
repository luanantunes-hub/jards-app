// A lista de quartos para o hotel, pelo link (PD8.6). Sem login: o servidor confere o código do link no banco (só o hash fica
// guardado), a revogação e a validade, e mostra só o hotel, o período, o localizador e os nomes por quarto.

import type { Metadata } from "next";
import { carregarListaDoHotel, type ResultadoDaListaDoHotel } from "@/lib/producao/hospedagem-publica";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Lista de quartos",
  robots: { index: false, follow: false },
};

// Os quartos mudam a cada ajuste da produção: nunca vêm prontos do cache.
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

export default async function ListaDoHotelPeloLink({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let resultado: ResultadoDaListaDoHotel | null = null;
  try {
    resultado = await carregarListaDoHotel(createAdminClient(), token);
  } catch {
    resultado = null;
  }
  if (resultado === null) return <Aviso titulo="Não foi possível abrir a lista" texto="Tente de novo em instantes." />;
  if (resultado.situacao === "revogado") return <Aviso titulo="Esta lista foi desativada" texto="Peça o endereço novo a quem enviou." />;
  if (resultado.situacao === "expirado") return <Aviso titulo="Este endereço venceu" texto="Peça um endereço novo a quem enviou." />;
  if (resultado.situacao !== "valido") return <Aviso titulo="Lista não encontrada" texto="Confira o endereço que você recebeu." />;

  const { lista, organizacao, validoAte } = resultado;
  return (
    <main className="min-h-screen bg-[#FAFAF9] px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-[40rem]">
        {organizacao && <p className="text-[0.6875rem] font-medium uppercase tracking-[.08em] text-black/45">{organizacao}</p>}
        <h1 className="mt-1 text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">{lista.hotel}</h1>
        <p className="mt-0.5 text-[0.8125rem] text-black/55">
          {[lista.periodo, lista.endereco, lista.localizador ? `localizador ${lista.localizador}` : null].filter(Boolean).join(" · ") || "Lista de quartos"}
        </p>
        <p className="mt-1 text-[0.75rem] text-black/45">
          {lista.hospedes} {lista.hospedes === 1 ? "hóspede" : "hóspedes"} em {lista.quartos.length} {lista.quartos.length === 1 ? "quarto" : "quartos"}
        </p>

        {lista.quartos.length === 0 ? (
          <p className="mt-6 rounded border bg-white px-4 py-6 text-center text-[0.875rem] text-black/55" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            Os quartos ainda não foram montados. Volte em breve.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.1)" }}>
            {lista.quartos.map(quarto => (
              <li key={quarto.nome} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-3">
                <span className="w-28 shrink-0 text-[0.9375rem] font-medium text-[#282525]">Quarto {quarto.nome}</span>
                <span className="min-w-0 flex-1 basis-40 text-[0.9375rem] text-[#282525]">
                  {quarto.hospedes.length > 0 ? quarto.hospedes.join(", ") : <span className="text-black/40">vago</span>}
                </span>
                <span className="text-[0.8125rem] tabular-nums text-black/50">{quarto.capacidade} {quarto.capacidade === 1 ? "lugar" : "lugares"}{quarto.cama ? ` · ${quarto.cama.toLowerCase()}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-[0.6875rem] text-black/40">Este endereço vale até {dataBr(validoAte)}. A lista é atualizada pela produção.</p>
      </div>
    </main>
  );
}
