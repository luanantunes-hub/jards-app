"use client";
import { useEffect, useState } from "react";
import { PenLine, RefreshCw } from "lucide-react";
import { AgendadosDeEmail } from "@/components/email/AgendadosDeEmail";
import { CaixaDeEntrada } from "@/components/email/CaixaDeEntrada";
import { EscreverEmail, type ResultadoDoEnvio } from "@/components/email/EscreverEmail";
import { TriagemDeEmails } from "@/components/email/TriagemDeEmails";
import { ListPageHeader, ListToolbar, PrimaryListAction, SecondaryListAction } from "@/components/list/ListPagePrimitives";
import { SegmentedControl } from "@/components/ui/FilterControls";

type Aba = "caixa" | "novos" | "agendados";

function quandoSai(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
}

export default function EmailsPage() {
  const [aba, setAba] = useState<Aba>("caixa");
  const [versao, setVersao] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const [escrevendo, setEscrevendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const fim = window.setTimeout(() => setAviso(null), 6000);
    return () => window.clearTimeout(fim);
  }, [aviso]);

  async function atualizar() {
    setSincronizando(true);
    try {
      await fetch("/api/email/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: true }) });
    } finally {
      setSincronizando(false);
      setVersao((atual) => atual + 1);
    }
  }

  function depoisDeEnviar({ agendado, enviarEm }: ResultadoDoEnvio) {
    if (agendado) {
      setAviso(enviarEm ? `E-mail agendado para ${quandoSai(enviarEm)}.` : "E-mail agendado.");
      setAba("agendados");
    } else {
      setAviso("E-mail enviado. Ele aparece aqui na próxima atualização.");
    }
    setVersao((atual) => atual + 1);
  }

  return (
    <>
      {escrevendo && <EscreverEmail onClose={() => setEscrevendo(false)} onEnviado={depoisDeEnviar} />}
      <ListPageHeader
        eyebrow="Relacionamento"
        title="E-mails"
        description="Suas conversas com contatos e com quem ainda não é contato. Só você vê o que não registrou no histórico da empresa."
        actions={
          <>
            <SecondaryListAction onClick={() => void atualizar()} disabled={sincronizando}><RefreshCw size={13} className={sincronizando ? "animate-spin" : undefined} aria-hidden="true" />{sincronizando ? "Atualizando…" : "Atualizar"}</SecondaryListAction>
            <PrimaryListAction onClick={() => setEscrevendo(true)}><PenLine size={13} aria-hidden="true" />Escrever e-mail</PrimaryListAction>
          </>
        }
      />
      <ListToolbar>
        <SegmentedControl<Aba>
          ariaLabel="Seção de e-mails"
          value={aba}
          onChange={setAba}
          options={[{ value: "caixa", label: "Caixa de entrada" }, { value: "novos", label: "Pessoas novas" }, { value: "agendados", label: "Agendados" }]}
        />
      </ListToolbar>
      {aviso && <p role="status" className="border-b bg-white px-4 py-2.5 text-[0.75rem] font-medium text-[#3C7A55] md:px-8" style={{ borderColor: "rgba(13,13,13,.06)" }}>{aviso}</p>}
      {aba === "caixa" ? <CaixaDeEntrada versao={versao} /> : aba === "novos" ? <TriagemDeEmails versao={versao} /> : <AgendadosDeEmail versao={versao} />}
    </>
  );
}
