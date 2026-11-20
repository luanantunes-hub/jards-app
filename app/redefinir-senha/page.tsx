"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function RedefinirSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const redirectTo = `${window.location.origin}/api/auth/callback?next=/nova-senha`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "#FFFFFF" }}>
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <img src="/jards-logo.svg" alt="Jards" className="h-7" />
        </div>

        {sent ? (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle size={48} className="text-green-500" />
            </div>
            <h1
              className="font-bold text-[#282525] mb-2"
              style={{ fontSize: "1.5rem" }}
            >
              E-mail enviado!
            </h1>
            <p className="text-sm text-black/50 mb-8 leading-relaxed">
              Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha em alguns instantes.
              Verifique também a pasta de spam.
            </p>
            <a
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-black/50 hover:text-[#282525] transition"
            >
              <ArrowLeft size={14} />
              Voltar para o login
            </a>
          </div>
        ) : (
          <>
            <a
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-black/40 hover:text-[#282525] transition mb-8"
            >
              <ArrowLeft size={13} />
              Voltar
            </a>

            <h1
              className="font-bold text-[#282525] mb-1"
              style={{ fontSize: "1.75rem" }}
            >
              Redefinir senha
            </h1>
            <p className="text-sm text-black/40 mb-8">
              Informe seu e-mail e enviaremos um link para criar uma nova senha.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-black/50 mb-1.5 uppercase tracking-wide">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com"
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 rounded border border-black/12 bg-white text-sm text-[#282525] placeholder-black/25 focus:outline-none focus:ring-2 focus:ring-black/20 transition"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-white border border-red-200 rounded px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#282525] hover:bg-[#3A3535] disabled:opacity-50 text-white font-bold text-sm rounded py-3.5 transition"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Enviar link de redefinição
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
