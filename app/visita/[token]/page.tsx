// O agendamento de visitas pelo link que a escola ou o grupo recebeu. Sem login: o servidor confere o código do link no banco (só o hash
// fica guardado) e, se vale, mostra os horários de hoje em diante com as vagas livres. Aqui não aparece quem já agendou, dinheiro nem equipe.

import type { Metadata } from "next";
import { AVISO_DO_LINK_DE_VISITAS, carregarVisitaPublica, conferirLinkDeVisitas, type VisitaPublica } from "@/lib/producao/visita-publica";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgendamentoDeVisita } from "./AgendamentoDeVisita";

export const metadata: Metadata = {
  title: "Agendar visita",
  robots: { index: false, follow: false },
};

// As vagas mudam a cada agendamento: nunca vem pronto do cache.
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

export default async function VisitaPeloLink({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let visita: VisitaPublica | null = null;
  let aviso: { titulo: string; texto: string } | null = null;
  try {
    const admin = createAdminClient();
    const conferido = await conferirLinkDeVisitas(admin, token);
    if (conferido.situacao !== "valido" || !conferido.link) aviso = AVISO_DO_LINK_DE_VISITAS[conferido.situacao === "valido" ? "inexistente" : conferido.situacao];
    else visita = await carregarVisitaPublica(admin, conferido.link);
  } catch {
    aviso = { titulo: "Não foi possível abrir o link", texto: "Tente de novo em instantes." };
  }
  if (aviso || !visita) return <Aviso titulo={aviso?.titulo ?? "Link não encontrado"} texto={aviso?.texto ?? "Confira o endereço que você recebeu."} />;
  return <AgendamentoDeVisita codigo={token} visita={visita} />;
}
