"use client";

// O aceite do patrocinador pelo link (P5.2): uma vez, com o nome. O banco
// confere o link e leva o aceite ao histórico do patrocinador no CRM.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { erroDoAceite } from "@/lib/prestacao/relatorio-patrocinador";

const ERROS: Record<string, string> = {
  ja_aceito: "Este relatório já foi aceito.",
  link_invalido: "Este link não vale mais. Peça um novo a quem enviou o relatório.",
  nome_invalido: "Informe seu nome.",
  comentario_longo: "O comentário tem até 2.000 caracteres.",
};

const dataBr = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function AceiteDoRelatorio({ token, patrocinador, aceite }: {
  token: string;
  patrocinador: string;
  aceite: { em: string; nome: string; comentario: string | null } | null;
}) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  if (aceite) {
    return (
      <section className="rounded-lg border bg-white px-5 py-5 md:px-6" style={{ borderColor: "#2E893247" }}>
        <p className="flex items-center gap-2 text-[0.875rem] font-semibold text-[#2E8932]">
          <CheckCircle2 size={16} aria-hidden /> Relatório aceito
        </p>
        <p className="mt-1 text-[0.75rem] text-black/60">Por {aceite.nome} em {dataBr(aceite.em)}{aceite.comentario ? `: ${aceite.comentario}` : "."}</p>
      </section>
    );
  }

  async function aceitar() {
    const problema = erroDoAceite({ nome, comentario });
    if (problema) { setErro(problema); return; }
    setEnviando(true);
    setErro("");
    const { error } = await createClient().rpc("fn_relatorio_patrocinador_aceitar" as never, { p_token: token, p_nome: nome.trim(), p_comentario: comentario.trim() || null } as never);
    if (error) {
      const codigo = Object.keys(ERROS).find(c => error.message.includes(c));
      setErro(codigo ? ERROS[codigo] : "Não foi possível registrar o aceite. Tente de novo.");
      setEnviando(false);
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-lg border bg-white px-5 py-5 md:px-6" style={{ borderColor: "rgba(13,13,13,.08)" }} aria-labelledby="aceite-titulo">
      <h2 id="aceite-titulo" className="text-[0.8125rem] font-semibold text-[#282525]">Aceite do relatório</h2>
      <p className="mt-1 text-[0.75rem] text-black/55">Se as informações estão de acordo, registre o aceite em nome de {patrocinador}. Quem enviou o relatório recebe a confirmação.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[0.625rem] font-medium text-black/45">Seu nome</span>
          <input value={nome} onChange={e => setNome(e.target.value)} maxLength={200} autoComplete="name"
            className="h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[0.625rem] font-medium text-black/45">Comentário (opcional)</span>
          <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={3} maxLength={2000}
            className="w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.8125rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
        </label>
      </div>
      {erro && <p role="alert" className="mt-3 text-[0.75rem] text-[#B23B3B]">{erro}</p>}
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={aceitar} disabled={enviando}
          className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2.5 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50">
          {enviando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
          Aceitar o relatório
        </button>
      </div>
    </section>
  );
}
