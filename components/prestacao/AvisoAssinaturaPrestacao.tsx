"use client";

// Aviso nas telas da prestação quando a assinatura do módulo pede atenção
// (P5.6): pagamento em atraso, ou o módulo só para leitura depois que a
// assinatura, a cortesia ou o teste grátis terminou. Sem assinatura nada é
// apagado; o banco só não deixa escrever. Durante o teste grátis da primeira
// versão, o aviso mostra quantos dias faltam (em âmbar na última semana); no
// fim do teste, abre uma vez por sessão a explicação do que muda, com o
// caminho para assinar.
// O aviso do teste grátis pode ser fechado: some até o tom mudar (na última
// semana ele volta, em âmbar). Atraso e somente leitura não fecham.

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Hourglass, X } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useAssinaturaPrestacao } from "@/hooks/useAssinaturaPrestacao";
import { FimDoTestePrestacao } from "@/components/prestacao/FimDoTestePrestacao";

const CHAVE_FIM_DO_TESTE = "jards:fim-do-teste-visto:";
const CHAVE_AVISO_FECHADO = "jards:aviso-teste-prestacao-fechado:";

function avisoFechado(chave: string): boolean {
  try {
    return localStorage.getItem(chave) === "1";
  } catch {
    return false;
  }
}

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
  const [avisoFechadoAgora, setAvisoFechadoAgora] = useState<string | null>(null);
  if (!assinatura?.descricao.aviso) return null;
  const { descricao } = assinatura;
  const atencao = descricao.tom === "atencao";
  const emTeste = !!descricao.teste && !descricao.teste.terminou;
  const chaveAviso = emTeste && organizationId ? `${CHAVE_AVISO_FECHADO}${organizationId}:${descricao.tom}` : null;
  const avisoEscondido = !!chaveAviso && (avisoFechadoAgora === chaveAviso || avisoFechado(chaveAviso));
  const mostrarFimDoTeste = !!descricao.teste?.terminou && !!organizationId
    && fechadoPara !== organizationId && !fimDoTesteVisto(organizationId);

  function fecharFimDoTeste() {
    if (!organizationId) return;
    try { sessionStorage.setItem(CHAVE_FIM_DO_TESTE + organizationId, "1"); } catch { /* sem armazenamento, volta a abrir na próxima tela */ }
    setFechadoPara(organizationId);
  }

  function fecharAviso() {
    if (!chaveAviso) return;
    try { localStorage.setItem(chaveAviso, "1"); } catch { /* sem armazenamento, fica fechado só nesta tela */ }
    setAvisoFechadoAgora(chaveAviso);
  }

  return (
    <>
      {!avisoEscondido && (
      <div role="status" className="flex items-start gap-3 border-b bg-white px-4 py-2.5 sm:px-8" style={{ borderColor: atencao ? "rgba(176,122,20,.28)" : "rgba(13,13,13,.07)" }}>
        <p className={`flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] ${atencao ? "text-[#B07A14]" : "text-black/55"}`}>
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
        {chaveAviso && (
          <button type="button" onClick={fecharAviso} aria-label="Fechar aviso do teste grátis" title="Fechar"
            className="-my-1.5 -mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded text-black/35 transition hover:bg-black/[.04] hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            <X size={14} aria-hidden />
          </button>
        )}
      </div>
      )}
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
