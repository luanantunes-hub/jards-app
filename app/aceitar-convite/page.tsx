"use client";

import { use, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";

// Só caminhos do próprio site: "?next=https://outro.site" ou "//outro.site" levariam a pessoa para fora.
function destinoInterno(next: string | string[] | undefined) {
  const valor = Array.isArray(next) ? next[0] : next;
  if (!valor || !valor.startsWith("/") || valor.startsWith("//") || valor.startsWith("/\\")) return "/dashboard";
  return valor;
}

type Estado = "verificando" | "senha" | "invalido";

/**
 * Destino do link do convite de equipe (/api/auth/callback leva para cá). O Supabase devolve a sessão no
 * fragmento do endereço; o cliente do navegador a lê ao carregar, então aqui a pessoa já está logada e falta
 * criar a senha (o convite nasce sem uma) e aceitar o convite, que a coloca na equipe.
 */
export default function AceitarConvitePage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const destino = destinoInterno(use(searchParams).next);
  const [estado, setEstado] = useState<Estado>("verificando");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    async function verificar() {
      // Link expirado ou já usado volta com o erro no fragmento (#error_code=otp_expired).
      const fragmento = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      if (fragmento.get("error") || fragmento.get("error_code")) {
        if (ativo) setEstado("invalido");
        return;
      }
      // getSession espera o cliente terminar de ler o fragmento do endereço.
      const { data } = await createClient().auth.getSession();
      if (ativo) setEstado(data.session ? "senha" : "invalido");
    }
    verificar();
    return () => { ativo = false; };
  }, []);

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);

    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }

    setSalvando(true);
    const supabase = createClient();
    const { error: erroSenha } = await supabase.auth.updateUser({ password: senha });
    if (erroSenha) {
      setErro(
        erroSenha.code === "weak_password"
          ? "Essa senha é fraca demais. Use pelo menos 8 caracteres, misturando letras e números."
          : "Não foi possível salvar a senha. Tente novamente.",
      );
      setSalvando(false);
      return;
    }

    const { error: erroAceite } = await supabase.rpc("accept_my_organization_invitations");
    if (erroAceite) {
      setErro("Sua senha foi criada, mas não conseguimos colocar você na equipe agora. Entre com o e-mail e a nova senha e, se continuar assim, avise quem convidou.");
      setSalvando(false);
      return;
    }

    // Navegação completa: o servidor passa a ler a sessão que o navegador acabou de gravar.
    window.location.href = destino;
  }

  return (
    <AuthShell
      eyebrow="Convite para a equipe"
      title="Sua equipe já está esperando."
      description="Crie sua senha e entre no espaço da organização que convidou você."
    >
      {estado === "verificando" && (
        <p role="status" className="text-sm text-black/50">Confirmando o seu convite…</p>
      )}

      {estado === "invalido" && (
        <section>
          <h1 className="text-2xl font-bold text-[#282525]">Este link não vale mais</h1>
          <p className="mt-3 text-sm leading-6 text-black/50">
            O link do convite expirou ou já foi usado. Se você já criou sua senha, é só entrar. Se não, peça
            um novo convite a quem convidou você ou use “Esqueci minha senha” com o e-mail do convite.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/login" className="inline-flex items-center gap-2 rounded-xl border border-[#684DB0] bg-[#684DB0] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#59409B]">
              Entrar <ArrowRight size={15} />
            </a>
            <a href="/redefinir-senha" className="inline-flex items-center rounded-xl border border-black/12 bg-white px-5 py-3 text-sm font-medium text-black/70 transition hover:bg-black/[.04]">
              Esqueci minha senha
            </a>
          </div>
        </section>
      )}

      {estado === "senha" && (
        <>
          <p className="mb-2.5 text-[0.6875rem] font-semibold uppercase tracking-[.14em] text-[#684DB0]">Convite aceito</p>
          <h1 className="text-[clamp(2rem,4.5vw,2.75rem)] font-bold leading-[1] tracking-[-.04em] text-[#282525]">Crie sua senha.</h1>
          <p className="mb-5 mt-2.5 text-sm leading-6 text-black/50">
            Com ela você entra no Jards sempre que precisar, sem esperar um novo e-mail.
          </p>

          <form onSubmit={salvar} className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[0.6875rem] font-medium text-black/55">Senha</span>
              <div className="relative">
                <input
                  type={mostrar ? "text" : "password"}
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Mínimo de 8 caracteres"
                  className={`${campo} pr-11`}
                />
                <button type="button" aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"} onClick={() => setMostrar((valor) => !valor)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black/30 transition hover:text-black/60">
                  {mostrar ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[0.6875rem] font-medium text-black/55">Confirmar senha</span>
              <input
                type={mostrar ? "text" : "password"}
                value={confirmacao}
                onChange={(event) => setConfirmacao(event.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Repita sua senha"
                className={campo}
              />
            </label>

            {erro && <p role="alert" className="rounded border border-[#D94E4E]/25 bg-white px-3 py-2 text-xs text-[#D94E4E]">{erro}</p>}

            <button type="submit" disabled={salvando} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#684DB0] bg-[#684DB0] py-3.5 text-sm font-semibold text-white transition hover:bg-[#59409B] active:scale-[.99] disabled:opacity-40">
              {salvando ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <>Criar senha e entrar <ArrowRight size={15} /></>}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}

const campo = "w-full rounded-xl border border-black/12 bg-white px-4 py-2.5 text-sm text-[#282525] placeholder-black/55 transition focus:border-[#684DB0]/55 focus:outline-none focus:ring-2 focus:ring-[#684DB0]/12";
