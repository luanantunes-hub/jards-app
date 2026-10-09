"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import {
  EVENTO_PERFIL_CONCLUIDO,
  comEstado,
  contaRecebePrimeirosPassos,
  ordemDosPassos,
  proximoPasso,
  type PassoComEstado,
  type PassoId,
} from "@/lib/onboarding/primeiros-passos";

/** Este navegador já mostrou o cartão incompleto para esta organização. */
const chaveVisto = (organizationId: string) => `jards:primeiros-passos-visto:${organizationId}`;

function lerVisto(organizationId: string) {
  try { return localStorage.getItem(chaveVisto(organizationId)) === "1"; } catch { return false; }
}

function marcarVisto(organizationId: string) {
  try { localStorage.setItem(chaveVisto(organizationId), "1"); } catch { /* sem localStorage: só não celebra a conclusão */ }
}

type Estado = { userId: string; passos: PassoComEstado[] };

/**
 * Guia da Visão geral para quem administra a organização de uma conta nova
 * (criada a partir de INICIO_PRIMEIROS_PASSOS). Some quando a pessoa o oculta.
 * Quem já tinha tudo pronto antes de vê-lo não recebe o cartão de conclusão.
 */
export function PrimeirosPassos() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [ocultando, setOcultando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const recarregar = () => setRecarga(n => n + 1);
    window.addEventListener(EVENTO_PERFIL_CONCLUIDO, recarregar);
    return () => window.removeEventListener(EVENTO_PERFIL_CONCLUIDO, recarregar);
  }, []);

  useEffect(() => {
    if (!organizationId || papel !== "admin") return;
    let cancelado = false;
    const supabase = createClient();
    // A tipagem manual do Supabase ainda não expõe todas as tabelas consultadas.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: perfil, error } = await db
        .from("profiles")
        .select("created_at, objetivo_principal, onboarding_completed, primeiros_passos_ocultos_em")
        .eq("id", user.id)
        .single();
      if (cancelado) return;
      // O questionário de boas-vindas vem antes; sem a coluna (migration
      // pendente) o cartão simplesmente não aparece.
      if (error || !perfil?.onboarding_completed || perfil.primeiros_passos_ocultos_em || !contaRecebePrimeirosPassos(perfil.created_at)) {
        setEstado(null);
        return;
      }

      const ordem = ordemDosPassos(perfil.objetivo_principal);
      const existencias = await Promise.all(
        ordem.map(passo => db.from(passo.tabela).select("id").eq("organization_id", organizationId).limit(1)),
      );
      if (cancelado) return;
      const feitos = new Set<PassoId>(
        ordem.filter((_, i) => (existencias[i].data?.length ?? 0) > 0).map(passo => passo.id),
      );
      const passos = comEstado(ordem, feitos);

      if (proximoPasso(passos)) marcarVisto(organizationId);
      else if (!lerVisto(organizationId)) { setEstado(null); return; }
      setEstado({ userId: user.id, passos });
    })();

    return () => { cancelado = true; };
  }, [organizationId, papel, recarga]);

  async function ocultar() {
    if (!estado) return;
    setOcultando(true);
    setErro(null);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("profiles")
      .update({ primeiros_passos_ocultos_em: new Date().toISOString() })
      .eq("id", estado.userId)
      .select("id")
      .maybeSingle();
    setOcultando(false);
    if (error || !data) { setErro("Não foi possível ocultar agora. Tente novamente."); return; }
    setEstado(null);
  }

  if (!estado) return null;

  return <PrimeirosPassosCard passos={estado.passos} onOcultar={ocultar} ocultando={ocultando} erro={erro} />;
}

type CardProps = {
  passos: PassoComEstado[];
  onOcultar: () => void;
  ocultando?: boolean;
  erro?: string | null;
};

export function PrimeirosPassosCard({ passos, onOcultar, ocultando = false, erro = null }: CardProps) {
  const tituloId = useId();
  const proximo = proximoPasso(passos);
  const feitos = passos.filter(passo => passo.feito).length;
  const total = passos.length;

  return (
    <section aria-labelledby={tituloId} className="mb-5 overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <header className="flex items-start justify-between gap-4 border-b px-5 py-3.5" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <div className="min-w-0 flex-1">
          <p className="text-[0.625rem] font-bold uppercase tracking-[.09em] text-black/30">Primeiros passos</p>
          <h2 id={tituloId} className="mt-0.5 text-[0.8125rem] font-semibold text-[#282525]">
            {proximo ? "Deixe o Jards pronto para captar" : "Tudo pronto para captar"}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <div className="hidden items-center gap-2.5 sm:flex">
            <span className="text-[0.6875rem] tabular-nums text-black/45">{feitos} de {total}</span>
            <span aria-hidden="true" className="block h-1 w-24 overflow-hidden rounded-full bg-black/[.06]">
              <span
                className="block h-full origin-left bg-[#2E8932] transition-transform duration-[240ms] ease-out motion-reduce:transition-none"
                style={{ transform: `scaleX(${total ? feitos / total : 0})` }}
              />
            </span>
          </div>
          <button
            type="button"
            onClick={onOcultar}
            disabled={ocultando}
            className="-my-1 rounded px-2 py-1.5 text-[0.6875rem] text-black/40 transition hover:bg-black/[.04] hover:text-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50"
          >
            {ocultando ? "Ocultando…" : proximo ? "Ocultar" : "Fechar"}
          </button>
        </div>
      </header>

      {erro && <p role="alert" className="border-b px-5 py-2 text-[0.75rem] text-[#B23A3A]" style={{ borderColor: "rgba(13,13,13,.07)" }}>{erro}</p>}

      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col justify-center px-5 py-5 md:py-6">
          {proximo ? (
            <>
              <p className="text-[0.6875rem] font-medium text-black/45">Próximo passo</p>
              <p className="mt-1 text-[1.125rem] font-semibold tracking-[-.015em] text-[#282525] [text-wrap:balance]">{proximo.titulo}</p>
              <Link
                href={proximo.href}
                className="mt-4 inline-flex min-h-10 items-center gap-2 self-start rounded bg-[#282525] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98]"
              >
                {proximo.acao} <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </>
          ) : (
            <>
              <p className="text-[0.6875rem] font-medium text-black/45">Concluído</p>
              <p className="mt-1 text-[1.125rem] font-semibold tracking-[-.015em] text-[#282525] [text-wrap:balance]">Seu Jards está montado</p>
            </>
          )}
          <p className="mt-4 text-[0.6875rem] tabular-nums text-black/40 sm:hidden">{feitos} de {total} concluídos</p>
        </div>

        <ol className="border-t py-2 md:border-l md:border-t-0" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          {passos.map((passo, index) => {
            const atual = passo.id === proximo?.id;
            return (
              <li key={passo.id}>
                <Link
                  href={passo.feito ? passo.hrefFeito : passo.href}
                  aria-current={atual ? "step" : undefined}
                  className={`group flex min-h-10 items-center gap-3 px-5 py-2 transition-colors hover:bg-black/[.025] focus-visible:bg-black/[.025] focus-visible:outline-none ${atual ? "bg-black/[.03]" : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-semibold tabular-nums ${
                      passo.feito
                        ? "border border-black/15 text-black/40"
                        : atual
                          ? "border border-[#7259B5] text-[#7259B5]"
                          : "border border-black/15 text-black/35"
                    }`}
                  >
                    {passo.feito ? <Check size={11} strokeWidth={3} /> : index + 1}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-[0.8125rem] ${passo.feito ? "text-black/40" : atual ? "font-medium text-[#282525]" : "text-black/65"}`}>
                    {passo.titulo}
                  </span>
                  <span className="sr-only">{passo.feito ? "(concluído)" : atual ? "(próximo passo)" : "(pendente)"}</span>
                  {passo.feito
                    ? <span aria-hidden="true" className="text-[0.625rem] font-medium text-black/45">Feito</span>
                    : <ArrowRight size={12} aria-hidden="true" className="text-black/20 transition-transform group-hover:translate-x-0.5 group-hover:text-black/45 motion-reduce:transition-none" />}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
