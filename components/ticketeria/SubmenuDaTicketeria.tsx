"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { abasDaRota, barraTemOQueMostrar, depoisDeAdicionar, voltaDaRota, type Adicao, type EscolhasDaLoja } from "@/lib/ticketeria/menu";

const TUDO: EscolhasDaLoja = { canais: null, usaEspacos: null };
const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

/**
 * A barra de abas das páginas agrupadas (Programação, Financeiro, Marketing, Configurações). Mostra só o que a loja usa (escolhido no Começar) e, para o que
 * falta, um "+" que o adiciona com um toque. Nas demais páginas não aparece.
 */
export function SubmenuDaTicketeria() {
  const path = usePathname();
  const router = useRouter();
  const organizationId = useOrganizationId();
  const [loja, setLoja] = useState<{ id: string; escolhas: EscolhasDaLoja } | null | undefined>(undefined);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data } = await clienteDaTicketeria(createClient()).from("ticketeria_lojas").select("id, canais, usa_espacos").eq("organization_id", organizationId).maybeSingle();
      if (ativo) setLoja(data ? { id: data.id, escolhas: { canais: data.canais, usaEspacos: data.usa_espacos } } : null);
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  const barra = abasDaRota(path, loja?.escolhas ?? TUDO);
  if (!barra) {
    // As páginas de cada caixa de Vendas (a Bilheteria, a Loja online) não têm abas: têm o caminho de volta à página de caixas.
    const volta = voltaDaRota(path);
    return volta ? (
      <nav aria-label="Voltar" className="px-5 pt-4 md:px-10">
        <Link href={volta.href} prefetch={false} className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[0.8125rem] font-normal text-black/50 transition hover:bg-black/[.04] hover:text-black/75 ${FOCO}`}>
          <ArrowLeft size={13} aria-hidden="true" /> {volta.rotulo}
        </Link>
      </nav>
    ) : null;
  }
  // Enquanto a loja carrega, o espaço da barra fica reservado (as abas não pulam quando a escolha chega).
  if (loja === undefined) return <div className="h-[3.25rem]" aria-hidden="true" />;
  if (!barraTemOQueMostrar(barra)) return null;

  async function adicionar(adicao: Adicao) {
    if (!loja) return;
    const novas = depoisDeAdicionar(loja.escolhas, adicao);
    const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_lojas").update({ canais: novas.canais, usa_espacos: novas.usaEspacos }).eq("id", loja.id);
    if (error) return;
    setLoja({ id: loja.id, escolhas: novas });
    router.push(adicao.href);
  }

  return (
    <nav aria-label="Seções" className="flex items-center gap-1 overflow-x-auto px-5 pt-4 md:px-10">
      {barra.secoes.map((secao, i) => (
        <Fragment key={(secao.abas[0] ?? secao.mais[0]).href}>
          {i > 0 && <span className="mx-1.5 h-4 w-px shrink-0 bg-black/[.12]" aria-hidden="true" />}
          {secao.abas.map(aba => {
            const ativa = aba === barra.ativa;
            return (
              <Link key={aba.href} href={aba.href} prefetch={false} aria-current={ativa ? "page" : undefined}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-[0.8125rem] font-normal transition ${FOCO} ${ativa ? "bg-black/[.06] text-[#282525]" : "text-black/45 hover:bg-black/[.04] hover:text-black/70"}`}>
                {aba.rotulo}
              </Link>
            );
          })}
          {secao.mais.map(adicao => (
            <button key={adicao.rotulo} type="button" onClick={() => void adicionar(adicao)} aria-label={`Adicionar ${adicao.rotulo}`}
              className={`inline-flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-black/[.18] px-2.5 py-1.5 text-[0.8125rem] font-normal text-black/40 transition hover:border-black/30 hover:bg-black/[.03] hover:text-black/65 ${FOCO}`}>
              <Plus size={13} aria-hidden="true" /> {adicao.rotulo}
            </button>
          ))}
        </Fragment>
      ))}
    </nav>
  );
}
