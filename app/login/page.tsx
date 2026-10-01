"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Mail, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { ObliqueStrategyCard } from "@/components/auth/ObliqueStrategyCard";

function PasswordResetModal({
  email,
  onConfirm,
  onCancel,
  loading,
  sent,
}: {
  email: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  sent: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={!loading && !sent ? onCancel : undefined}
      />
      <div className="relative w-full max-w-sm rounded bg-white shadow-2xl">
        {!loading && (
          <button
            onClick={onCancel}
            className="absolute right-4 top-4 text-black/20 hover:text-black/50 transition"
          >
            <X size={16} />
          </button>
        )}

        <div className="px-8 pb-8 pt-10 text-center">
          <div className="mx-auto mb-5 flex h-40 w-40 items-center justify-center">
            <Image
              src="/tamandua.png"
              alt="Tamanduá com a chave de acesso"
              width={160}
              height={160}
              className="object-contain"
            />
          </div>

          {sent ? (
            <>
              <h2 className="text-[1.35rem] font-bold tracking-tight text-[#0D0D0D]">
                Link enviado!
              </h2>
              <p className="mt-2.5 text-sm leading-6 text-black/50">
                Verifique a caixa de entrada de{" "}
                <span className="font-semibold text-black/75">{email}</span>.
                {" "}Use o link para criar sua nova senha.
              </p>
              <p className="mt-2 text-xs text-black/30">
                Não encontrou? Confira o spam.
              </p>
              <button
                onClick={onCancel}
                className="mt-6 text-sm text-black/35 hover:text-black/55 transition"
              >
                Fechar
              </button>
            </>
          ) : (
            <>
              <h2 className="text-[1.35rem] font-bold tracking-tight text-[#0D0D0D]">
                O Jards foi<br />totalmente renovado
              </h2>
              <p className="mt-2.5 text-sm leading-6 text-black/50">
                Para garantir sua segurança nesta nova versão, você precisa confirmar seu acesso por e-mail e criar uma nova senha.{" "}
                Enviamos um link para{" "}
                <span className="font-semibold text-black/75">{email}</span>.
              </p>

              <button
                onClick={onConfirm}
                disabled={loading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded bg-[#7259B5] py-3 text-sm font-medium text-white transition hover:bg-[#614ba0] active:scale-[.99] disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <Mail size={15} />
                    Confirmar via e-mail
                  </>
                )}
              </button>

              <button
                onClick={onCancel}
                disabled={loading}
                className="mt-3 text-sm text-black/35 hover:text-black/55 transition disabled:opacity-40"
              >
                Voltar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Só caminhos do próprio site: "?next=https://outro.site" ou "//outro.site"
// levariam a pessoa para fora depois do login.
function destinoInterno(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/dashboard";
  return next;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = destinoInterno(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const supabase = createClient();

  const callbackErrorHandledRef = useRef(false);
  useEffect(() => {
    // Em dev, o StrictMode roda este efeito duas vezes; na segunda, a URL já
    // foi limpa pela primeira execução — a guarda evita reprocessar com dados
    // inconsistentes (hash já vazio, searchParams ainda com o valor antigo).
    if (callbackErrorHandledRef.current) return;
    callbackErrorHandledRef.current = true;

    // O Supabase redireciona erros de link (expirado, já usado, etc.) como
    // hash fragment — nunca aparece em searchParams, só em window.location.hash.
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorCode = hashParams.get("error_code") ?? (searchParams.get("error") ? "auth_callback_failed" : null);
    if (!errorCode) return;

    setError(
      errorCode === "otp_expired"
        ? "Este link expirou ou já foi usado. Solicite um novo abaixo."
        : "Não foi possível confirmar o acesso pelo link. Tente novamente."
    );
    window.history.replaceState(null, "", window.location.pathname);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      if (error.message === "Invalid login credentials") {
        setResetSent(false);
        setShowResetModal(true);
      } else {
        setError(error.message);
      }
      return;
    }

    window.location.href = next;
  }

  // Conta que já existe mas errou a senha: pede para definir uma senha nova
  // de verdade (fluxo de redefinição), em vez de logar direto sem senha.
  async function handleSendPasswordReset() {
    setResetLoading(true);
    const redirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent("/nova-senha")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setResetLoading(false);
    if (error) {
      setShowResetModal(false);
      setError("Não foi possível enviar o link de redefinição. Tente novamente em instantes.");
    } else {
      setResetSent(true);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setError(null);
    const redirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  }

  return (
    <>
      {showResetModal && (
        <PasswordResetModal
          email={email}
          onConfirm={handleSendPasswordReset}
          onCancel={() => setShowResetModal(false)}
          loading={resetLoading}
          sent={resetSent}
        />
      )}

      <form className="space-y-3.5" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-black/55">
            E-mail
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
            required
            autoComplete="email"
            className="w-full rounded-xl border border-black/12 bg-white px-4 py-2.5 text-sm text-black placeholder-black/55 transition focus:border-[#684DB0]/55 focus:outline-none focus:ring-2 focus:ring-[#684DB0]/12"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-black/55">
            Senha
          </label>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-black/12 bg-white px-4 py-2.5 pr-11 text-sm text-black placeholder-black/55 transition focus:border-[#684DB0]/55 focus:outline-none focus:ring-2 focus:ring-[#684DB0]/12"
            />
            <button
              type="button"
              aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="mt-2 flex justify-end">
            <a
              href="/redefinir-senha"
              className="text-xs text-black/40 hover:text-black transition"
            >
              Esqueci minha senha
            </a>
          </div>
        </div>

        {error && (
          <p className="rounded border border-[#D94E4E]/25 bg-white px-3 py-2 text-xs text-[#D94E4E]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[#684DB0] bg-[#684DB0] py-3.5 text-sm font-semibold text-white transition hover:bg-[#59409B] active:scale-[.99] disabled:opacity-40"
        >
          {loading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              Entrar
              <ArrowRight size={15} />
            </>
          )}
        </button>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-black/10" />
          <span className="text-xs text-black/30">ou</span>
          <div className="flex-1 h-px bg-black/10" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading || googleLoading}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-black/12 bg-white py-3 text-sm font-medium text-black/65 transition hover:bg-black/[.04] active:scale-[.99] disabled:opacity-40"
        >
          {googleLoading ? (
            <span className="inline-block w-4 h-4 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Entrar com Google
            </>
          )}
        </button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthShell asideContent={<ObliqueStrategyCard />} showAsideLogo={false}>
      <a href="/" aria-label="Ir para a página inicial do Jards" className="mb-6 inline-block">
        <Image src="/jards-logo.svg" alt="Jards" width={88} height={28} priority className="h-7 w-auto" />
      </a>
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[.14em] text-[#684DB0]">Continue seu trabalho</p>
      <h1 className="text-[clamp(2.2rem,5vw,3rem)] font-bold leading-[.98] tracking-[-.045em] text-[#0D0D0D]">Hoje é o dia.</h1>
      <p className="mb-5 mt-2.5 text-sm leading-6 text-black/50">Seu workspace, projetos e negociações permanecem no mesmo contexto.</p>

      <Suspense fallback={<div className="space-y-4 animate-pulse"><div className="h-12 bg-black/5 rounded"/><div className="h-12 bg-black/5 rounded"/><div className="h-12 bg-black/5 rounded"/></div>}>
        <LoginForm />
      </Suspense>

      <p className="mt-5 text-center text-xs text-black/40">
        Ainda não usa o Jards? <a href="/cadastro" className="font-semibold text-black hover:underline">Criar uma conta</a>
      </p>

      <p className="mt-4 text-center text-[11px] leading-5 text-black/35">
        <a href="/termos" className="hover:text-black/45 underline">Termos de Uso</a>
        {" · "}
        <a href="/privacidade" className="hover:text-black/45 underline">Política de Privacidade</a>
      </p>
    </AuthShell>
  );
}
