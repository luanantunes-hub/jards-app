"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { frasesDaEntrada, INICIO_DA_BILHETERIA, lerBilheteiros, mensagemDoLogin, motivoDaEntrada } from "@/lib/ticketeria/bilheteria";

// A entrada da bilheteria: e-mail e senha, só para quem foi cadastrado pelo produtor. Quem entra com uma conta que não é de bilheteria sai de novo, sem ver nada.

const ROTULO = "mb-1.5 block text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45";
const CAMPO = "h-12 w-full rounded-xl border border-black/15 bg-white px-3.5 text-[1rem] text-[#282525] placeholder:text-black/30 focus:border-[#7259B5] focus:outline-none";

function Formulario() {
  const motivo = frasesDaEntrada(motivoDaEntrada(useSearchParams().get("motivo")));
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    if (entrando) return;
    setEntrando(true);
    setErro(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
    if (error) { setErro(mensagemDoLogin(error)); setEntrando(false); return; }
    const { data } = await clienteDaTicketeria(supabase).rpc("fn_ticketeria_bilheteiro_atual");
    if (lerBilheteiros(data).length === 0) {
      await supabase.auth.signOut();
      setErro(frasesDaEntrada("outra-conta"));
      setEntrando(false);
      return;
    }
    window.location.href = INICIO_DA_BILHETERIA;
  }

  return (
    <form onSubmit={entrar} className="w-full max-w-[26.25rem] rounded-xl border bg-white p-8" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <p className="text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45">Ticketeria</p>
      <h1 className="mt-1 text-[1.625rem] font-medium tracking-[-.025em] text-[#282525]">Bilheteria</h1>
      <p className="mt-1.5 text-[0.875rem] text-black/60">Entre para vender e conferir ingressos na porta.</p>
      {(erro ?? motivo) && <p role="alert" className="mt-5 rounded-xl border bg-white px-4 py-2.5 text-[0.8125rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro ?? motivo}</p>}
      <label htmlFor="bilheteria-email" className={`mt-6 ${ROTULO}`}>E-mail</label>
      <input id="bilheteria-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className={CAMPO} />
      <label htmlFor="bilheteria-senha" className={`mt-4 ${ROTULO}`}>Senha</label>
      <input id="bilheteria-senha" type="password" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)} className={CAMPO} />
      <button type="submit" disabled={entrando} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl text-[0.9375rem] font-normal text-white shadow-[0_1px_2px_rgba(28,14,51,.25),inset_0_1px_0_rgba(255,255,255,.08)] transition disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]" style={{ background: "linear-gradient(180deg,#2a1747,#1C0E33)" }}>{entrando ? "Entrando…" : "Entrar"}</button>
      <p className="mt-5 text-center text-[0.75rem] leading-relaxed text-black/50">Este acesso serve só para vender e conferir ingressos.<br />Não mostra relatórios, repasses nem configurações da loja.</p>
    </form>
  );
}

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF9FB] px-4 py-10">
      <Suspense fallback={null}><Formulario /></Suspense>
    </div>
  );
}
