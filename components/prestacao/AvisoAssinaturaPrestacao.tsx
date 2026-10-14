"use client";

// Aviso nas telas da prestação quando a assinatura do módulo pede atenção
// (P5.6): pagamento em atraso, ou o módulo só para leitura depois que a
// assinatura, a cortesia ou o teste grátis terminou. Sem assinatura nada é
// apagado; o banco só não deixa escrever. Durante o teste grátis da primeira
// versão, o aviso mostra quantos dias faltam (em âmbar na última semana); no
// fim do teste, abre uma vez por sessão a explicação do que muda, com o
// caminho para assinar.

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Hourglass } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useAssinaturaPrestacao } from "@/hooks/useAssinaturaPrestacao";
import { FimDoTestePrestacao } from "@/components/prestacao/FimDoTestePrestacao";

const CHAVE_FIM_DO_TESTE = "jards:fim-do-teste-visto:";

function fimDoTesteVisto(organizationId: string): boolean {
  try {
    return sessionStorage.getItem(CHAVE_FIM_DO_TESTE + organizationId) === "1";
  } catch {
    return false;
  }
}

export function AvisoAssinaturaPrestacao() {
  const organizationId = useOrganizationId();
  const { assinatura } = useAssinaturaPrestacao(organizationId);
  const [fechadoPara, setFechadoPara] = useState<string | null>(null);
  if (!assinatura?.descricao.aviso) return null;
  const { descricao } = assinatura;
  const atencao = descricao.tom === "atencao";
  const emTeste = !!descricao.teste && !descricao.teste.terminou;
  const mostrarFimDoTeste = !!descricao.teste?.terminou && !!organizationId
    && fechadoPara !== organizationId && !fimDoTesteVisto(organizationId);

  function fecharFimDoTeste() {
    if (!organizationId) return;
    try { sessionStorage.setItem(CHAVE_FIM_DO_TESTE + organizationId, "1"); } catch { /* sem armazenamento, volta a abrir na próxima tela */ }
    setFechadoPara(organizationId);
  }

  return (
    <>
      <div role="status" className="border-b bg-white px-4 py-2.5 sm:px-8" style={{ borderColor: atencao ? "rgba(176,122,20,.28)" : "rgba(13,13,13,.07)" }}>
        <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] ${atencao ? "text-[#B07A14]" : "text-black/55"}`}>
          {atencao
            ? <AlertTriangle size={13} className="shrink-0" aria-hidden />
            : <Hourglass size={12} className="shrink-0 text-black/40" aria-hidden />}
          <span className="font-medium">{descricao.aviso}</span>
          <span>{descricao.detalhe}</span>
          <Link href="/meu-plano?assinar=prestacao"
            className={`rounded underline underline-offset-2 transition focus-visible:outline-2 focus-visible:outline-[#7259B5] ${
              atencao ? "decoration-[#B07A14]/40 hover:decoration-[#B07A14]" : "text-black/70 decoration-black/25 hover:decoration-black/60"
            }`}>
            {!assinatura.admin ? "Ver a assinatura" : emTeste ? "Assinar agora" : "Ver em Meu plano"}
          </Link>
        </p>
      </div>
      {mostrarFimDoTeste && descricao.teste && organizationId && (
        <FimDoTestePrestacao
          organizationId={organizationId}
          ate={descricao.teste.ate}
          admin={assinatura.admin}
          emUso={assinatura.vagas.emUso}
          precos={assinatura.precos}
          cobrancaConfigurada={assinatura.cobrancaConfigurada}
          onClose={fecharFimDoTeste}
        />
      )}
    </>
  );
}
