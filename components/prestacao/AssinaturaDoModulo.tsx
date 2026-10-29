"use client";

// Assinatura do módulo de prestação de contas em Meu plano (P5.6): preço,
// situação, usuários e as ações de quem administra (assinar, comprar
// usuários, gerenciar no portal do Stripe). A assinatura é da organização e
// separada do plano de captação.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Minus, Plus } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useAssinaturaPrestacao } from "@/hooks/useAssinaturaPrestacao";
import { VAGAS_EXTRAS_MAX } from "@/supabase/functions/_shared/cobranca-modulo";

const reais = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const COR_DO_TOM = { ok: "#2E8932", atencao: "#B07A14", neutro: "rgba(13,13,13,.55)" } as const;

const RECURSOS = [
  "Prestação por lei: Rouanet, esporte, audiovisual e saúde",
  "Checagens, pacote de envio e acompanhamento depois do envio",
  "Contador, cliente e patrocinador com acesso próprio, sem ocupar vaga",
];

function Quantidade({ valor, minimo, onChange, rotulo }: { valor: number; minimo: number; onChange: (n: number) => void; rotulo: string }) {
  const botao = "flex h-9 w-9 items-center justify-center text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-35";
  return (
    <div className="inline-flex items-center rounded border border-black/[.12] bg-white" role="group" aria-label={rotulo}>
      <button type="button" className={botao} onClick={() => onChange(Math.max(minimo, valor - 1))} disabled={valor <= minimo} aria-label="Menos um">
        <Minus size={13} aria-hidden />
      </button>
      <span className="min-w-[2.25rem] text-center text-[0.8125rem] tabular-nums text-black/80" aria-live="polite">{valor}</span>
      <button type="button" className={botao} onClick={() => onChange(Math.min(VAGAS_EXTRAS_MAX, valor + 1))} disabled={valor >= VAGAS_EXTRAS_MAX} aria-label="Mais um">
        <Plus size={13} aria-hidden />
      </button>
    </div>
  );
}

export function AssinaturaDoModulo({ destacar, retorno }: { destacar: boolean; retorno: "pago" | "cancelado" | null }) {
  const organizationId = useOrganizationId();
  const { assinatura, carregando, recarregar } = useAssinaturaPrestacao(organizationId);
  const secao = useRef<HTMLElement>(null);
  // Quem vem do teste ou da cortesia já começa com um usuário para cada pessoa que usa o módulo.
  const [extrasEscolhidos, setExtras] = useState<number | null>(null);
  const extras = extrasEscolhidos ?? Math.min(VAGAS_EXTRAS_MAX, Math.max(0, (assinatura?.vagas.emUso ?? 1) - 1));
  const [compra, setCompra] = useState(1);
  const [ocupado, setOcupado] = useState<"assinar" | "comprar" | "portal" | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [esperando, setEsperando] = useState(retorno === "pago");

  useEffect(() => {
    if (destacar) secao.current?.scrollIntoView({ block: "start" });
  }, [destacar]);

  // Volta do pagamento: o webhook ativa o contrato em segundos.
  useEffect(() => {
    if (!esperando) return;
    let tentativas = 0;
    const timer = setInterval(async () => {
      tentativas += 1;
      const atual = await recarregar();
      if (atual?.descricao.paga || tentativas >= 10) {
        clearInterval(timer);
        setEsperando(false);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [esperando, recarregar]);

  async function assinar() {
    if (!organizationId) return;
    setErro("");
    setOcupado("assinar");
    const resposta = await fetch("/api/prestacao/assinatura", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId, vagas_extras: extras }),
    }).catch(() => null);
    const json = await resposta?.json().catch(() => ({})) as { url?: string; error?: string } | undefined;
    if (!resposta?.ok || !json?.url) {
      setErro(json?.error ?? "Não foi possível abrir o pagamento. Tente de novo.");
      setOcupado(null);
      return;
    }
    window.location.assign(json.url);
  }

  async function comprar() {
    if (!organizationId) return;
    setErro("");
    setAviso("");
    setOcupado("comprar");
    const resposta = await fetch("/api/members/seats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId, quantity: compra, request_id: crypto.randomUUID(), modulo: "prestacao" }),
    }).catch(() => null);
    const json = await resposta?.json().catch(() => ({})) as { error?: string } | undefined;
    setOcupado(null);
    if (!resposta?.ok) {
      setErro(json?.error ?? "Não foi possível comprar os usuários. Tente de novo.");
      return;
    }
    setAviso(compra === 1 ? "1 usuário extra comprado." : `${compra} usuários extras comprados.`);
    setCompra(1);
    await recarregar();
  }

  async function portal() {
    setErro("");
    setOcupado("portal");
    const resposta = await fetch("/api/stripe/portal", { method: "POST" }).catch(() => null);
    const json = await resposta?.json().catch(() => ({})) as { url?: string } | undefined;
    if (!resposta?.ok || !json?.url) {
      setErro("Não foi possível abrir o gerenciamento da assinatura. Tente de novo.");
      setOcupado(null);
      return;
    }
    window.location.assign(json.url);
  }

  const precos = assinatura?.precos ?? { modulo: 92.8, vaga: 19.9 };
  const descricao = assinatura?.descricao;
  const cor = descricao ? COR_DO_TOM[descricao.tom] : COR_DO_TOM.neutro;

  return (
    <section ref={secao} id="prestacao-de-contas" aria-labelledby="titulo-prestacao-de-contas"
      className="scroll-mt-6 rounded border bg-white p-6" style={{ borderColor: destacar ? "rgba(13,13,13,.28)" : "rgba(13,13,13,.08)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="titulo-prestacao-de-contas" className="text-[0.6875rem] font-bold uppercase tracking-widest text-black/40">Prestação de contas</h2>
          <p className="mt-3 text-[1.75rem] font-bold leading-none tracking-tight text-[#282525]">
            {reais(precos.modulo)} <span className="text-[0.8125rem] font-normal tracking-normal text-black/45">por mês, com 1 usuário</span>
          </p>
          <p className="mt-1.5 text-[0.75rem] text-black/45">Usuário extra: {reais(precos.vaga)} por mês.</p>
        </div>
        {descricao && (
          <span className="rounded border bg-white px-2 py-1 text-[0.625rem] font-medium" style={{ borderColor: `${cor}47`, color: cor }}>
            {descricao.titulo}
          </span>
        )}
      </div>

      <ul className="mt-5 grid gap-2.5 sm:grid-cols-3">
        {RECURSOS.map(recurso => (
          <li key={recurso} className="flex items-start gap-2 text-[0.8125rem] text-black/65">
            <Check size={13} strokeWidth={2.5} className="mt-0.5 shrink-0 text-black/45" aria-hidden />
            {recurso}
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-3 border-t pt-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        {retorno === "pago" && (
          <p role="status" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "rgba(46,137,50,.28)" }}>
            {descricao?.paga
              ? "Assinatura confirmada. A prestação de contas está liberada."
              : "Pagamento recebido. A prestação de contas é liberada assim que o Stripe confirmar, em alguns segundos."}
          </p>
        )}
        {retorno === "cancelado" && (
          <p className="text-[0.75rem] text-black/50">Pagamento cancelado. Você pode assinar quando quiser.</p>
        )}

        {carregando ? (
          <div className="h-12 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />
        ) : !assinatura || !descricao ? (
          <p className="text-[0.8125rem] text-black/50">Não foi possível consultar a assinatura agora.</p>
        ) : (
          <>
            <p className="text-[0.8125rem] text-black/70">{descricao.detalhe}</p>
            {assinatura.vagas.total > 0 && (
              <p className="text-[0.75rem] text-black/45">
                <span className="tabular-nums">{assinatura.vagas.emUso} de {assinatura.vagas.total}</span> {assinatura.vagas.total === 1 ? "usuário em uso" : "usuários em uso"}
              </p>
            )}
            {descricao.paga && (
              <Link href="/prestacoes" className="inline-block rounded text-[0.75rem] text-black/55 underline decoration-black/20 underline-offset-2 transition hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                Abrir as prestações
              </Link>
            )}

            {!assinatura.admin ? (
              <p className="text-[0.75rem] text-black/45">O administrador assina e gerencia a prestação de contas.</p>
            ) : descricao.podeAssinar ? (
              <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                <div>
                  <p className="mb-1.5 text-[0.6875rem] text-black/50">Usuários extras</p>
                  <Quantidade valor={extras} minimo={0} onChange={setExtras} rotulo="Usuários extras" />
                </div>
                <div className="min-w-[12rem] flex-1">
                  <p className="text-[0.75rem] text-black/50">Total</p>
                  <p className="text-[0.9375rem] font-medium tabular-nums text-black/85">{reais(precos.modulo + extras * precos.vaga)} por mês</p>
                </div>
                <button type="button" onClick={assinar} disabled={!!ocupado || !assinatura.cobrancaConfigurada}
                  className="rounded bg-[#282525] px-4 py-2.5 text-[0.8125rem] font-medium text-white transition hover:bg-[#3A3535] active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50 motion-reduce:transition-none">
                  {ocupado === "assinar" ? "Abrindo o pagamento…" : assinatura.cobrancaConfigurada ? "Assinar a prestação de contas" : "Pagamento ainda não configurado"}
                </button>
              </div>
            ) : descricao.paga && assinatura.responsavelCobranca ? (
              <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                <div>
                  <p className="mb-1.5 text-[0.6875rem] text-black/50">Comprar usuários</p>
                  <Quantidade valor={compra} minimo={1} onChange={setCompra} rotulo="Usuários para comprar" />
                </div>
                <button type="button" onClick={comprar} disabled={!!ocupado}
                  className="rounded border border-black/[.12] bg-white px-4 py-2.5 text-[0.8125rem] text-black/75 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-50">
                  {ocupado === "comprar" ? "Comprando…" : `Comprar por mais ${reais(compra * precos.vaga)} por mês`}
                </button>
                <button type="button" onClick={portal} disabled={!!ocupado}
                  className="flex items-center gap-1.5 rounded px-1 py-2.5 text-[0.75rem] text-black/50 transition hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-50">
                  <ExternalLink size={12} aria-hidden />
                  {ocupado === "portal" ? "Abrindo…" : "Gerenciar assinatura"}
                </button>
                <p className="w-full text-[0.6875rem] text-black/40">A compra de usuários é cobrada na hora, proporcional ao período.</p>
              </div>
            ) : descricao.paga ? (
              <p className="text-[0.75rem] text-black/45">Quem paga a assinatura compra usuários e gerencia a cobrança.</p>
            ) : null}
          </>
        )}

        {aviso && <p role="status" className="text-[0.75rem] text-[#2E8932]">{aviso}</p>}
        {erro && <p role="alert" className="text-[0.75rem] text-[#B23B3B]">{erro}</p>}
      </div>
    </section>
  );
}
