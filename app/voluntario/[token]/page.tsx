// A inscrição de voluntários pelo link que a pessoa recebeu. Sem login: o servidor confere o código do link no banco (só o hash fica
// guardado) e, se vale, a pessoa vê só o nome da produção e preenche nome, contato e disponibilidade. Aqui não aparece dinheiro,
// equipe, outras datas nem dado de outra pessoa.

import type { Metadata } from "next";
import { AVISO_DO_LINK_DE_VOLUNTARIOS, carregarInscricaoPublica, conferirLinkDeVoluntarios, type InscricaoPublica } from "@/lib/producao/voluntario-publico";
import { createAdminClient } from "@/lib/supabase/admin";
import { InscricaoDeVoluntario } from "./InscricaoDeVoluntario";

export const metadata: Metadata = {
  title: "Seja voluntário",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

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

export default async function VoluntarioPeloLink({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let inscricao: InscricaoPublica | null = null;
  let aviso: { titulo: string; texto: string } | null = null;
  try {
    const admin = createAdminClient();
    const conferido = await conferirLinkDeVoluntarios(admin, token);
    if (conferido.situacao !== "valido" || !conferido.link) aviso = AVISO_DO_LINK_DE_VOLUNTARIOS[conferido.situacao === "valido" ? "inexistente" : conferido.situacao];
    else inscricao = await carregarInscricaoPublica(admin, conferido.link);
  } catch {
    aviso = { titulo: "Não foi possível abrir o link", texto: "Tente de novo em instantes." };
  }
  if (aviso || !inscricao) return <Aviso titulo={aviso?.titulo ?? "Link não encontrado"} texto={aviso?.texto ?? "Confira o endereço que você recebeu."} />;
  return <InscricaoDeVoluntario codigo={token} inscricao={inscricao} />;
}
