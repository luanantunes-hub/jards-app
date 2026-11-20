// O portal do patrocinador, pelo link (PD9.2). Sem login: o servidor confere o código do link no banco (só o hash fica guardado), a
// revogação e a validade, e mostra só o nome e o logo da marca e as sessões que ela apresenta — dia, hora, título, sala e espaço.

import type { Metadata } from "next";
import { carregarPortalDoPatrocinador, type ResultadoDoPortal } from "@/lib/producao/patrocinador-publico";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Portal do patrocinador",
  robots: { index: false, follow: false },
};

// A programação muda a cada ajuste da produção: nunca vem pronta do cache.
export const dynamic = "force-dynamic";

const dataBr = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const dia = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;
const hora = (valor: string) => valor.slice(0, 5);

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

export default async function PortalDoPatrocinadorPeloLink({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let resultado: ResultadoDoPortal | null = null;
  try {
    resultado = await carregarPortalDoPatrocinador(createAdminClient(), token);
  } catch {
    resultado = null;
  }
  if (resultado === null) return <Aviso titulo="Não foi possível abrir o portal" texto="Tente de novo em instantes." />;
  if (resultado.situacao === "revogado") return <Aviso titulo="Este portal foi desativado" texto="Peça o endereço novo a quem enviou." />;
  if (resultado.situacao === "expirado") return <Aviso titulo="Este endereço venceu" texto="Peça um endereço novo a quem enviou." />;
  if (resultado.situacao !== "valido") return <Aviso titulo="Portal não encontrado" texto="Confira o endereço que você recebeu." />;

  const { portal, organizacao, validoAte } = resultado;
  const { marca, retorno, sessoes } = portal;
  return (
    <main className="min-h-screen bg-[#FAFAF9] px-4 py-8 sm:py-12 print:bg-white print:py-0">
      <div className="mx-auto w-full max-w-[44rem]">
        {marca.logo_url && (
          /* eslint-disable-next-line @next/next/no-img-element -- o logo é um endereço https que a produção cadastrou, de qualquer site: o otimizador do Next não serve */
          <img src={marca.logo_url} alt="" className="mb-4 h-12 w-auto max-w-[14rem] object-contain" />
        )}
        {organizacao && <p className="text-[0.6875rem] font-medium uppercase tracking-[.08em] text-black/45">{organizacao}</p>}
        <h1 className="mt-1 text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">{marca.nome}</h1>
        <p className="mt-0.5 text-[0.8125rem] text-black/55">
          {retorno.sessoes === 0
            ? "Nenhuma sessão apresentada por esta marca."
            : [
                `${retorno.sessoes.toLocaleString("pt-BR")} ${retorno.sessoes === 1 ? "sessão apresentada" : "sessões apresentadas"}`,
                retorno.realizadas > 0 ? `${retorno.realizadas.toLocaleString("pt-BR")} já ${retorno.realizadas === 1 ? "realizada" : "realizadas"}` : null,
                retorno.proximas > 0 ? `${retorno.proximas.toLocaleString("pt-BR")} por vir` : null,
              ].filter(Boolean).join(" · ")}
        </p>

        {sessoes.length > 0 && (
          <section aria-label="Sessões" className="mt-6">
            <h2 className="mb-2 text-[0.75rem] font-medium uppercase tracking-[.08em] text-black/50">Sessões</h2>
            <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.1)" }}>
              {sessoes.map(sessao => (
                <li key={sessao.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5">
                  <span className="w-24 shrink-0 text-[0.75rem] tabular-nums text-black/55">{dia(sessao.dia)}</span>
                  <span className="w-12 shrink-0 text-[0.75rem] tabular-nums text-black/45">{hora(sessao.inicio)}</span>
                  <span className={`min-w-0 flex-1 basis-48 break-words text-[0.875rem] ${sessao.aconteceu ? "text-black/55" : "text-[#282525]"}`}>
                    {sessao.titulo || "Sessão"}
                    {(sessao.espaco || sessao.sala) && <span className="text-black/45"> · {[sessao.espaco, sessao.sala].filter(Boolean).join(", ")}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {marca.site_url && (
          <p className="mt-6 text-[0.75rem]">
            <a href={marca.site_url} target="_blank" rel="noopener noreferrer" className="text-[#7259B5] underline-offset-2 hover:underline">{marca.site_url}</a>
          </p>
        )}
        <p className="mt-6 text-[0.6875rem] text-black/40">Este endereço vale até {dataBr(validoAte)}. A programação é atualizada pela produção.</p>
      </div>
    </main>
  );
}
