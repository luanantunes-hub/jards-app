// As prestações que a pessoa acompanha como convidada (P5.3).

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { rotuloDoPapel, textoDasSecoes } from "@/lib/prestacao/convidados";

type MeuConvite = {
  convidado_id: string;
  prestacao_id: string;
  titulo: string;
  organizacao: string | null;
  papel: string;
  secoes: string[];
  expira_em: string;
  situacao: "ativo" | "expirado" | "revogado" | "suspenso";
};

const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const SITUACAO: Record<MeuConvite["situacao"], string> = {
  ativo: "",
  expirado: "Convite vencido",
  revogado: "Acesso revogado",
  suspenso: "Indisponível no momento",
};

export default async function PrestacoesDoConvidado() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
  const { data, error } = await (supabase as any).rpc("fn_convidado_minhas");
  const convites = (data ?? []) as MeuConvite[];

  return (
    <main className="mx-auto max-w-[48rem] px-4 py-8 md:px-6 md:py-10">
      <h1 className="text-balance text-[1.375rem] font-semibold tracking-[-0.02em] text-[#0D0D0D]">Prestações que você acompanha</h1>
      <p className="mt-1 text-[0.8125rem] text-black/50">Por convite, só leitura: você comenta e marca itens como verificados.</p>

      {error ? (
        <p role="alert" className="mt-6 rounded border bg-white px-4 py-3 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>
          Não foi possível carregar seus convites. Atualize a página.
        </p>
      ) : convites.length === 0 ? (
        <div className="mt-6 rounded-lg border bg-white px-5 py-6 text-[0.8125rem] text-black/55" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          Você ainda não aceitou nenhum convite. Abra o link do convite que recebeu por e-mail, entrando com o e-mail convidado.
        </div>
      ) : (
        <ul className="mt-6 space-y-2" aria-label="Convites">
          {convites.map(c => {
            const ativo = c.situacao === "ativo";
            const conteudo = (
              <>
                <div className="min-w-0">
                  <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">{c.organizacao ?? "Organização"}</p>
                  <p className="mt-0.5 truncate text-[0.875rem] font-medium text-[#0D0D0D]">{c.titulo}</p>
                  <p className="mt-0.5 text-[0.6875rem] text-black/50">
                    {rotuloDoPapel(c.papel)} · {textoDasSecoes(c.secoes)} · {ativo ? `até ${dataBr(c.expira_em)}` : SITUACAO[c.situacao]}
                  </p>
                </div>
                {ativo && <ChevronRight size={16} className="shrink-0 text-black/30" aria-hidden />}
              </>
            );
            return (
              <li key={c.convidado_id}>
                {ativo ? (
                  <Link href={`/convidado/prestacoes/${c.prestacao_id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3.5 transition hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
                    style={{ borderColor: "rgba(13,13,13,.08)" }}>
                    {conteudo}
                  </Link>
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3.5 opacity-70" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                    {conteudo}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
