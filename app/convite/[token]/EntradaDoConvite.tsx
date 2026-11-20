"use client";

// Entrada pelo convite (P5.3): com a conta do e-mail convidado, aceita e abre
// a prestação; com outra conta, oferece trocar; sem login, entra ou cria o
// acesso (o e-mail é confirmado antes de o convite valer).

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const PRIMARIO = "flex items-center justify-center gap-1.5 rounded bg-[#282525] px-5 py-2.5 text-[0.8125rem] font-semibold text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50";

function Girando() {
  return <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />;
}

export function EntradaDoConvite({ token, email, nome: nomeDoConvite, logadoComo }: {
  token: string;
  email: string;
  nome: string;
  logadoComo: string | null;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [nome, setNome] = useState(nomeDoConvite);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [confirmarEmail, setConfirmarEmail] = useState(false);
  const voltar = `/convite/${token}`;

  async function aceitar() {
    setEnviando(true);
    setErro("");
    const { data, error } = await createClient().rpc("fn_prestacao_aceitar_convite" as never, { p_token: token } as never);
    if (error || !data) {
      setErro(mensagemErroPrestacao(error, "Não foi possível aceitar o convite"));
      setEnviando(false);
      return;
    }
    router.push(`/convidado/prestacoes/${data as string}`);
  }

  async function sair() {
    setEnviando(true);
    await createClient().auth.signOut();
    router.refresh();
    setEnviando(false);
  }

  async function criarAcesso(evento: React.FormEvent) {
    evento.preventDefault();
    setErro("");
    if (nome.trim().length < 2) { setErro("Informe seu nome."); return; }
    if (senha.length < 8) { setErro("A senha precisa ter pelo menos 8 caracteres."); return; }
    if (senha !== confirmacao) { setErro("As senhas não coincidem."); return; }
    setEnviando(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(voltar)}`,
        data: { full_name: nome.trim() },
      },
    });
    setEnviando(false);
    if (error) {
      setErro(error.message.toLowerCase().includes("already registered")
        ? "Este e-mail já tem conta na Jards. Entre com a sua senha."
        : "Não foi possível criar o acesso. Tente de novo.");
      return;
    }
    // E-mail já cadastrado volta sem identidade: a pessoa entra com a senha que já tem.
    if (!data.user?.identities?.length) { setErro("Este e-mail já tem conta na Jards. Entre com a sua senha."); return; }
    if (data.session) { router.refresh(); return; }
    setConfirmarEmail(true);
  }

  const caixa = "rounded-lg border bg-white px-5 py-5 md:px-7";
  const borda = { borderColor: "rgba(13,13,13,.08)" };

  if (logadoComo && logadoComo === email) {
    return (
      <section className={caixa} style={borda}>
        <p className="text-[0.8125rem] text-black/65">Você entrou como <span className="font-medium text-black/85">{email}</span>.</p>
        {erro && <p role="alert" className="mt-3 text-[0.75rem] text-[#B23B3B]">{erro}</p>}
        <button type="button" onClick={aceitar} disabled={enviando} className={`${PRIMARIO} mt-4 w-full sm:w-auto`}>
          {enviando && <Girando />} Aceitar e abrir a prestação
        </button>
      </section>
    );
  }

  if (logadoComo) {
    return (
      <section className={caixa} style={borda}>
        <p className="text-[0.8125rem] leading-relaxed text-black/65">
          Você entrou como <span className="font-medium text-black/85">{logadoComo}</span>, mas o convite é para <span className="font-medium text-black/85">{email}</span>. Saia e entre com a conta desse e-mail.
        </p>
        <button type="button" onClick={sair} disabled={enviando} className={`${PRIMARIO} mt-4 w-full sm:w-auto`}>
          {enviando && <Girando />} Sair desta conta
        </button>
      </section>
    );
  }

  if (confirmarEmail) {
    return (
      <section className={caixa} style={{ borderColor: "#2E893247" }} aria-live="polite">
        <p className="flex items-center gap-2 text-[0.875rem] font-semibold text-[#2E8932]"><MailCheck size={16} aria-hidden /> Confira seu e-mail</p>
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-black/60">
          Enviamos um link de confirmação para <span className="font-medium text-black/80">{email}</span>. Abra o link neste aparelho e o convite continua daqui.
        </p>
      </section>
    );
  }

  return (
    <section className={caixa} style={borda} aria-labelledby="entrada-titulo">
      <h2 id="entrada-titulo" className="text-[0.875rem] font-semibold text-[#282525]">Entre com {email}</h2>
      <p className="mt-1 text-[0.75rem] text-black/50">Se você já usa a Jards com esse e-mail, entre com a sua senha. Se não, crie o acesso abaixo.</p>
      <Link href={`/login?next=${encodeURIComponent(voltar)}`} className={`${PRIMARIO} mt-4 w-full sm:w-auto sm:inline-flex`}>
        Já tenho conta: entrar
      </Link>

      <form onSubmit={criarAcesso} className="mt-6 border-t pt-5" style={{ borderColor: "rgba(13,13,13,.07)" }} noValidate>
        <p className="text-[0.75rem] font-medium text-black/70">Criar acesso</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={ROTULO}>Seu nome</span>
            <input value={nome} onChange={e => setNome(e.target.value)} maxLength={200} autoComplete="name" className={CAMPO} />
          </label>
          <label className="block">
            <span className={ROTULO}>Senha (8 caracteres ou mais)</span>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password" className={CAMPO} />
          </label>
          <label className="block">
            <span className={ROTULO}>Repita a senha</span>
            <input type="password" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} autoComplete="new-password" className={CAMPO} />
          </label>
        </div>
        {erro && <p role="alert" className="mt-3 text-[0.75rem] text-[#B23B3B]">{erro}</p>}
        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={enviando}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2.5 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50">
            {enviando && <Girando />} Criar acesso
          </button>
        </div>
      </form>
    </section>
  );
}
