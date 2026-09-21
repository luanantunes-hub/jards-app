"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function NovaSenhaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/dashboard"), 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "#FFFFFF" }}>
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <img src="/jards-logo.svg" alt="Jards" className="h-7" />
        </div>

        {done ? (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle size={48} className="text-green-500" />
            </div>
            <h1
              className="font-bold text-[#0D0D0D] mb-2"
              style={{ fontSize: "24px" }}
            >
              Senha atualizada!
            </h1>
            <p className="text-sm text-black/50">Redirecionando para o dashboard...</p>
          </div>
        ) : (
          <>
            <h1
              className="font-bold text-[#0D0D0D] mb-1"
              style={{ fontSize: "28px" }}
            >
              Nova senha
            </h1>
            <p className="text-sm text-black/40 mb-8">Escolha uma senha com pelo menos 8 caracteres.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-black/50 mb-1.5 uppercase tracking-wide">
                  Nova senha
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    className="w-full px-4 py-3 rounded border border-black/12 bg-white text-sm text-black placeholder-black/25 focus:outline-none focus:ring-2 focus:ring-black/20 transition pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-black/50 mb-1.5 uppercase tracking-wide">
                  Confirmar senha
                </label>
                <input
                  type={showPass ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-3 rounded border border-black/12 bg-white text-sm text-black placeholder-black/25 focus:outline-none focus:ring-2 focus:ring-black/20 transition"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#0D0D0D] hover:bg-black/80 disabled:opacity-50 text-white font-bold text-sm rounded py-3.5 transition"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Salvar nova senha
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
