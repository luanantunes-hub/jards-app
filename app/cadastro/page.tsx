"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, CheckCircle, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { anexarOrigem, consentiuMedicao, lerOrigem } from "@/lib/origem-cadastro";
import { registrarCadastroNoGoogleAds } from "@/lib/conversao-google-ads";

// De qual campanha veio este cadastro; o clique do anúncio só com o aceite.
function origemDaVisita() {
  return lerOrigem(new URLSearchParams(window.location.search), consentiuMedicao());
}

export default function CadastroPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const origem = origemDaVisita();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/confirmacao-email`,
        data: {
          full_name: fullName.trim(),
          ...(origem ? { origem_cadastro: origem } : {}),
        },
      },
    });

    if (signUpError) {
      setError(
        signUpError.message.toLowerCase().includes("already registered")
          ? "Este e-mail já possui uma conta. Entre ou redefina sua senha."
          : signUpError.message
      );
      setLoading(false);
      return;
    }

    // E-mail já cadastrado volta sem identidade: não é cadastro novo.
    if (data.user?.identities?.length) await registrarCadastroNoGoogleAds(email);

    if (data.session) {
      window.location.href = "/dashboard";
      return;
    }

    setSent(true);
    setLoading(false);
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    // O Google não recebe dados extras no cadastro; a origem segue pelo
    // endereço de retorno e o callback a grava na conta nova.
    const retorno = new URL("/api/auth/callback", window.location.origin);
    retorno.searchParams.set("next", "/dashboard?onboarding=1");
    anexarOrigem(retorno, origemDaVisita());
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: retorno.toString() },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Comece com contexto, não do zero"
      title="Sua captação já nasce organizada."
      description="Crie seu workspace e conecte projetos, oportunidades, contatos e próximos passos desde o primeiro dia."
    >
      <Image src="/jards-logo.svg" alt="Jards" width={88} height={28} priority className="mb-8 h-7 w-auto lg:hidden" />

        {sent ? (
          <section className="py-5 text-center">
            <CheckCircle size={38} className="mx-auto mb-5 text-[#2E8932]" strokeWidth={1.6} />
            <h1 className="text-2xl font-bold text-[#0D0D0D]">Confirme seu e-mail</h1>
            <p className="mt-3 text-sm leading-6 text-black/50">
              Enviamos um link de confirmação para <strong className="font-medium text-black/70">{email}</strong>.
              Abra-o para ativar sua conta e acessar o Jards.
            </p>
            <a href="/login" className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-black/45 transition hover:text-black">
              <ArrowLeft size={14} /> Voltar ao login
            </a>
          </section>
        ) : (
          <>
            <a href="/login" className="mb-4 inline-flex items-center gap-1.5 text-xs text-black/40 transition hover:text-black">
              <ArrowLeft size={13} /> Voltar ao login
            </a>
            <p className="mb-2.5 text-[0.6875rem] font-semibold uppercase tracking-[.14em] text-[#684DB0]">Crie seu workspace</p>
            <h1 className="text-[clamp(2.15rem,5vw,3rem)] font-bold leading-[.98] tracking-[-.045em] text-[#0D0D0D]">Comece gratuitamente.</h1>
            <p className="mb-4 mt-2.5 text-sm leading-6 text-black/50">Configure seu espaço e comece com o contexto organizado.</p>

            <button type="button" onClick={handleGoogle} disabled={loading} className="mb-4 flex w-full items-center justify-center gap-2.5 rounded-xl border border-black/12 bg-white py-3 text-sm font-medium text-black/70 transition hover:bg-black/[.04] active:scale-[.99] disabled:opacity-50">
              <GoogleMark /> Cadastrar com Google
            </button>

            <div className="mb-4 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-black/8" />
              <span className="text-[0.6875rem] text-black/30">ou use seu e-mail</span>
              <span className="h-px flex-1 bg-black/8" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <Field label="Seu nome">
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} required autoComplete="name" placeholder="Nome e sobrenome" className={inputClass} />
              </Field>
              <Field label="E-mail">
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="voce@empresa.com" className={inputClass} />
              </Field>
              <Field label="Senha">
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" className={`${inputClass} pr-11`} />
                  <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((value) => !value)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black/30 transition hover:text-black/60">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
              <Field label="Confirmar senha">
                <input type={showPassword ? "text" : "password"} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} autoComplete="new-password" placeholder="Repita sua senha" className={inputClass} />
              </Field>

              {error && <p role="alert" className="rounded border border-[#D94E4E]/25 bg-white px-3 py-2 text-xs text-[#D94E4E]">{error}</p>}

              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#684DB0] bg-[#684DB0] py-3.5 text-sm font-semibold text-white transition hover:bg-[#59409B] active:scale-[.99] disabled:opacity-40">
                {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <>Criar conta <ArrowRight size={15} /></>}
              </button>
            </form>

            <p className="mt-3 text-center text-[0.6875rem] text-black/40">Sem cartão. Seus dados ficam protegidos.</p>

            <p className="mt-3 text-center text-[0.6875rem] leading-5 text-black/35">
              Ao criar uma conta, você concorda com os nossos{" "}
              <a href="/termos" className="text-black/45 underline hover:text-black/70">Termos de Uso</a>
              {" "}e a nossa{" "}
              <a href="/privacidade" className="text-black/45 underline hover:text-black/70">Política de Privacidade</a>.
            </p>

            <p className="mt-2.5 text-center text-xs text-black/40">
              Já possui uma conta? <a href="/login" className="font-semibold text-black hover:underline">Entrar</a>
            </p>
          </>
        )}
    </AuthShell>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#2D72B0" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.87h5.39a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.97-4.33 2.97-7.35Z" />
      <path fill="#2E8932" d="M12 22c2.7 0 4.98-.9 6.63-2.42l-3.24-2.51c-.9.6-2.04.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#B07A14" d="M6.4 13.91A6 6 0 0 1 6.08 12c0-.67.12-1.31.32-1.91V7.5H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.5l3.35-2.59Z" />
      <path fill="#D94E4E" d="M12 5.97c1.47 0 2.79.5 3.83 1.49l2.87-2.87A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.95 5.5l3.35 2.59A5.98 5.98 0 0 1 12 5.97Z" />
    </svg>
  );
}

const inputClass = "w-full rounded-xl border border-black/12 bg-white px-4 py-2.5 text-sm text-black placeholder-black/55 transition focus:border-[#684DB0]/55 focus:outline-none focus:ring-2 focus:ring-[#684DB0]/12";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.6875rem] font-medium text-black/55">{label}</span>
      {children}
    </label>
  );
}
