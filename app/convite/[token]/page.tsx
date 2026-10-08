// Convite para acompanhar uma prestação de contas (P5.3). O banco confere o
// link (fn_convite_publico) e diz para quem é o convite; a pessoa entra, ou
// cria o acesso, com esse e-mail, e só então o convite é aceito.

import type { Metadata } from "next";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { rotuloDoPapel, textoDasSecoes } from "@/lib/prestacao/convidados";
import { EntradaDoConvite } from "./EntradaDoConvite";

export const metadata: Metadata = {
  title: "Convite",
  robots: { index: false, follow: false },
};

type ConvitePublico = {
  situacao: "pendente" | "aceito" | "expirado" | "revogado";
  email?: string;
  nome?: string | null;
  papel?: string;
  secoes?: string[];
  mensagem?: string | null;
  expira_em?: string;
  prestacao?: { titulo: string };
  organizacao?: { nome: string | null; avatar_url: string | null } | null;
  convidado_por?: string | null;
};

const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

async function lerConvite(token: string): Promise<ConvitePublico | null | "erro"> {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const supabase = createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("fn_convite_publico" as never, { p_token: token } as never);
  if (error) return "erro";
  return (data as ConvitePublico | null) ?? null;
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAF9] px-4">
      <div className="max-w-[28rem] rounded-lg border bg-white px-6 py-8 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <h1 className="text-[1.0625rem] font-semibold text-[#0D0D0D]">{titulo}</h1>
        <p className="mt-2 text-[0.8125rem] text-black/55">{texto}</p>
      </div>
    </main>
  );
}

export default async function ConviteDaPrestacao({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await lerConvite(token);
  if (c === "erro") return <Aviso titulo="Não foi possível abrir o convite" texto="Tente de novo em instantes." />;
  if (!c) return <Aviso titulo="Convite não encontrado" texto="Confira o endereço recebido ou peça um novo convite a quem convidou você." />;
  if (c.situacao === "revogado") return <Aviso titulo="Este convite foi revogado" texto="Peça um novo convite a quem convidou você." />;
  if (c.situacao === "expirado") return <Aviso titulo="Este convite venceu" texto="Peça um novo convite a quem convidou você." />;

  const { data: { user } } = await (await createClient()).auth.getUser();
  const organizacao = c.organizacao?.nome?.trim() || "Uma organização";
  const quem = c.convidado_por?.trim() ? `${c.convidado_por.trim()}, de ${organizacao},` : organizacao;

  return (
    <main className="min-h-screen bg-[#FAFAF9] px-4 py-10 md:py-16">
      <div className="mx-auto max-w-[32rem] space-y-4">
        <section className="rounded-lg border bg-white px-5 py-6 md:px-7" style={{ borderColor: "rgba(13,13,13,.08)" }} aria-labelledby="convite-titulo">
          <div className="flex items-center gap-3">
            {c.organizacao?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo da organização, de endereço público
              <img src={c.organizacao.avatar_url} alt={`Logo de ${organizacao}`} className="h-10 w-10 rounded object-cover" />
            ) : (
              <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded bg-[#0D0D0D] text-[0.9375rem] font-semibold text-white">
                {organizacao.charAt(0).toUpperCase()}
              </span>
            )}
            <p className="text-[0.75rem] text-black/50">{organizacao}</p>
          </div>
          <h1 id="convite-titulo" className="mt-4 text-balance text-[1.375rem] font-semibold leading-tight tracking-[-0.02em] text-[#0D0D0D]">
            {quem} convidou você para acompanhar a prestação de contas de {c.prestacao?.titulo}.
          </h1>
          <dl className="mt-5 grid grid-cols-1 gap-3 text-[0.75rem] sm:grid-cols-3">
            <div>
              <dt className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">Como</dt>
              <dd className="mt-0.5 text-black/75">{rotuloDoPapel(c.papel ?? "outro")}</dd>
            </div>
            <div>
              <dt className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">Acesso a</dt>
              <dd className="mt-0.5 text-black/75">{textoDasSecoes(c.secoes ?? [])}</dd>
            </div>
            <div>
              <dt className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">Até</dt>
              <dd className="mt-0.5 tabular-nums text-black/75">{dataBr(c.expira_em)}</dd>
            </div>
          </dl>
          {c.mensagem && (
            <p className="mt-5 whitespace-pre-line border-l-2 border-black/10 pl-3 text-[0.8125rem] leading-relaxed text-black/60">{c.mensagem}</p>
          )}
          <p className="mt-5 text-[0.75rem] leading-relaxed text-black/50">
            Você lê essas seções, comenta e marca itens como verificados. Não altera nada da prestação, e quem convidou vê suas notas.
          </p>
        </section>

        <EntradaDoConvite token={token} email={c.email ?? ""} nome={c.nome ?? ""} logadoComo={user?.email?.toLowerCase() ?? null} />
      </div>
    </main>
  );
}
