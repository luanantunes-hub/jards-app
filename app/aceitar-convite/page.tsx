"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { destinoInterno } from "@/lib/destino-interno";
import {
  estabelecerSessaoDoConvite,
  lembrarOrganizacaoAtual,
  lerFragmentoDoConvite,
  organizacaoDoConvite,
} from "@/lib/convite-sessao";

type Estado = "verificando" | "senha" | "invalido";
// "senha" ainda pede a senha; "aceite" é depois da senha criada, quando só falta entrar na equipe.
type Etapa = "senha" | "aceite";

/**
 * Destino do link do convite de equipe (/api/auth/callback leva para cá). A sessão do convite vem no fragmento
 * do endereço (lib/convite-sessao.ts); aqui ela é gravada, a pessoa cria a senha (o convite nasce sem uma) e
 * aceita o convite, que a coloca na equipe.
 */
export default function AceitarConvitePage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const destino = destinoInterno(use(searchParams).next);
  const [estado, setEstado] = useState<Estado>("verificando");
  const [etapa, setEtapa] = useState<Etapa>("senha");
  const [organizacao, setOrganizacao] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    async function verificar() {
      const fragmento = lerFragmentoDoConvite(window.location.hash);
      // Os tokens saem do endereço já: não precisam ficar no histórico nem à vista de extensões do navegador.
      if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);

      const supabase = createClient();
      let convidado = null;
      if (fragmento.tipo === "tokens") {
        convidado = await estabelecerSessaoDoConvite(supabase, fragmento);
      } else if (fragmento.tipo === "nenhum") {
        // Sem fragmento: a pessoa recarregou a página depois de abrir o link, e a sessão do convite já está
        // gravada. Só vale a de quem foi convidado (o convite guarda a organização nos metadados da conta),
        // nunca uma sessão qualquer que o navegador já tivesse.
        const { data } = await supabase.auth.getSession();
        const usuario = data.session?.user;
        convidado = organizacaoDoConvite(usuario) ? usuario ?? null : null;
      }
      if (!ativo) return;
      setOrganizacao(organizacaoDoConvite(convidado));
      setEstado(convidado ? "senha" : "invalido");
    }
    verificar();
    return () => { ativo = false; };
  }, []);

  async function entrarNaEquipe() {
    const { error: erroAceite } = await createClient().rpc("accept_my_organization_invitations");
    if (erroAceite) {
      setEtapa("aceite");
      setErro("Sua senha foi criada, mas não conseguimos colocar você na equipe agora. Tente de novo; se continuar assim, avise quem convidou você.");
      setSalvando(false);
      return;
    }
    // A conta nasce com uma organização própria vazia; sem isto o app abriria essa e não a da equipe.
    lembrarOrganizacaoAtual(organizacao);
    // Navegação completa: o servidor passa a ler a sessão que o navegador acabou de gravar.
    window.location.href = destino;
  }

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
    const { error: erroSenha } = await createClient().auth.updateUser({ password: senha });
    if (erroSenha) {
      setErro(
        erroSenha.code === "weak_password"
          ? "Essa senha é fraca demais. Use pelo menos 8 caracteres, misturando letras e números."
          : "Não foi possível salvar a senha. Tente novamente.",
      );
      setSalvando(false);
      return;
    }
    await entrarNaEquipe();
  }

  async function tentarDeNovo() {
    setErro(null);
    setSalvando(true);
    await entrarNaEquipe();
  }

  return (
    <AuthShell
      eyebrow="Convite para a equipe"
      title="Sua equipe já está esperando."
      description="Crie sua senha e entre no espaço da organização que convidou você."
    >
      <Image src="/jards-logo.svg" alt="Jards" width={88} height={28} priority className="mb-8 h-7 w-auto lg:hidden" />

      {estado === "verificando" && (
        <section role="status">
          <h1 className="text-2xl font-bold text-[#282525]">Confirmando seu convite…</h1>
        </section>
      )}

      {estado === "invalido" && (
        <section>
          <h1 className="text-2xl font-bold text-[#282525]">Este link não vale mais</h1>
          <p className="mt-3 text-sm leading-6 text-black/50">
            O link expirou ou já foi usado. Se você já criou sua senha, é só entrar. Se não, peça um novo convite
            a quem convidou você ou use “Esqueci minha senha” com o e-mail do convite.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={`/login?next=${encodeURIComponent(destino)}`} className="inline-flex items-center gap-2 rounded-xl border border-[#684DB0] bg-[#684DB0] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#59409B]">
              Entrar <ArrowRight size={15} />
            </a>
            <a href="/redefinir-senha" className="inline-flex items-center rounded-xl border border-black/12 bg-white px-5 py-3 text-sm font-medium text-black/70 transition hover:bg-black/[.04]">
              Esqueci minha senha
            </a>
          </div>
        </section>
      )}

      {estado === "senha" && etapa === "aceite" && (
        <section>
          <h1 className="text-2xl font-bold text-[#282525]">Quase lá</h1>
          {erro && <p role="alert" className="mt-4 rounded border border-[#D94E4E]/25 bg-white px-3 py-2 text-xs text-[#D94E4E]">{erro}</p>}
          <button type="button" onClick={tentarDeNovo} disabled={salvando} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[#684DB0] bg-[#684DB0] py-3.5 text-sm font-semibold text-white transition hover:bg-[#59409B] active:scale-[.99] disabled:opacity-40">
            {salvando ? <span role="status" aria-label="Entrando na equipe" className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <>Tentar entrar na equipe de novo <ArrowRight size={15} /></>}
          </button>
        </section>
      )}

      {estado === "senha" && etapa === "senha" && (
        <>
          <p className="mb-2.5 text-[0.6875rem] font-semibold uppercase tracking-[.14em] text-[#684DB0]">Último passo</p>
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
                  autoFocus
                  autoComplete="new-password"
                  placeholder="Mínimo de 8 caracteres"
                  className={`${campo} pr-11`}
                />
                <button type="button" aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"} aria-pressed={mostrar} onClick={() => setMostrar((valor) => !valor)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black/30 transition hover:text-black/60">
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
              {salvando ? <span role="status" aria-label="Salvando" className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <>Criar senha e entrar <ArrowRight size={15} /></>}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}

const campo = "w-full rounded-xl border border-black/12 bg-white px-4 py-2.5 text-sm text-[#282525] placeholder-black/55 transition focus:border-[#684DB0]/55 focus:outline-none focus:ring-2 focus:ring-[#684DB0]/12";
