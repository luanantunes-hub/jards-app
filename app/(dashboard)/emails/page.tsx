"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { CaixaDeEntrada } from "@/components/email/CaixaDeEntrada";
import { TriagemDeEmails } from "@/components/email/TriagemDeEmails";
import { ListPageHeader, ListToolbar, SecondaryListAction } from "@/components/list/ListPagePrimitives";
import { SegmentedControl } from "@/components/ui/FilterControls";

type Aba = "caixa" | "novos";

export default function EmailsPage() {
  const [aba, setAba] = useState<Aba>("caixa");
  const [versao, setVersao] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);

  async function atualizar() {
    setSincronizando(true);
    try {
      await fetch("/api/email/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: true }) });
    } finally {
      setSincronizando(false);
      setVersao((atual) => atual + 1);
    }
  }

  return (
    <>
      <ListPageHeader
        eyebrow="Relacionamento"
        title="E-mails"
        description="Suas conversas com contatos e com quem ainda não é contato. Só você vê o que não registrou no histórico da empresa."
        actions={<SecondaryListAction onClick={() => void atualizar()} disabled={sincronizando}><RefreshCw size={13} className={sincronizando ? "animate-spin" : undefined} aria-hidden="true" />{sincronizando ? "Atualizando…" : "Atualizar"}</SecondaryListAction>}
      />
      <ListToolbar>
        <SegmentedControl<Aba>
          ariaLabel="Seção de e-mails"
          value={aba}
          onChange={setAba}
          options={[{ value: "caixa", label: "Caixa de entrada" }, { value: "novos", label: "Pessoas novas" }]}
        />
      </ListToolbar>
      {aba === "caixa" ? <CaixaDeEntrada versao={versao} /> : <TriagemDeEmails versao={versao} />}
    </>
  );
}
