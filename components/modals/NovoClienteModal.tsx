"use client";
import { useId, useState } from "react";
import { X, Users, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";

export function NovoClienteModal({ onClose, onSaved }: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const organizationId = useOrganizationId();

  const [nome, setNome]     = useState("");
  const [setor, setSetor]   = useState("");
  const [site, setSite]     = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro]     = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(onClose);

  function SectionLabel({ children }: { children: React.ReactNode }) {
    return <p className="text-[0.5625rem] font-bold uppercase tracking-widest text-black/30 mb-1.5">{children}</p>;
  }

  function FieldLabel({ children }: { children: React.ReactNode }) {
    return <label className="mb-1.5 flex items-center text-[0.75rem] font-semibold text-[#282525]">{children}</label>;
  }

  async function handleSalvar() {
    if (!nome.trim()) { setErro("Informe o nome da empresa."); return; }
    setSaving(true); setErro(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErro("Usuário não autenticado"); setSaving(false); return; }

    const { data: empresa, error } = await (supabase as any)
      .from("empresas_crm")
      .insert({
        nome: nome.trim(),
        setor: setor.trim() || null,
        site: site.trim() || null,
        tipo: "cliente_ativo",
        account_id: user.id,
        organization_id: organizationId,
      })
      .select("id")
      .single();

    if (error || !empresa) { setErro(error?.message ?? "Erro ao criar empresa"); setSaving(false); return; }

    // Cliente sem conta de patrocínio não aparece na tela Clientes.
    const { error: erroConta } = await (supabase as any).from("contas_patrocinio").insert({
      account_id: user.id,
      organization_id: organizationId,
      empresa_crm_id: empresa.id,
      nome: null,
      status: "ativa",
    });
    if (erroConta) {
      await (supabase as any).from("empresas_crm").delete().eq("id", empresa.id);
      setErro(erroConta.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center veu" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[96dvh] w-full max-w-[30rem] flex-col overflow-hidden rounded-b bg-white border-x border-b elevacao-2"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,.12)", borderBottom: "1px solid rgba(13,13,13,.08)", borderLeft: "1px solid rgba(13,13,13,.06)", borderRight: "1px solid rgba(13,13,13,.06)" }}
        onClick={e => e.stopPropagation()}>

        <header className="flex shrink-0 items-center justify-between border-b px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-black/5">
              <Users size={16} className="text-black/50" />
            </div>
            <h2 id={titleId} className="text-[0.9375rem] font-bold text-[#282525]">Novo cliente</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/[.06]">
            <X size={15} className="text-black/40" />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <SectionLabel>Empresa</SectionLabel>
            <FieldLabel>Nome *</FieldLabel>
            <input
              autoFocus
              value={nome}
              onChange={e => setNome(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSalvar()}
              placeholder="Nome da empresa"
              className="w-full rounded border bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition focus:border-black/30"
              style={{ borderColor: "rgba(13,13,13,.15)" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 border-t pt-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <div>
              <FieldLabel>Setor</FieldLabel>
              <input
                value={setor}
                onChange={e => setSetor(e.target.value)}
                placeholder="Ex: Energia, Cultura…"
                className="w-full rounded border bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition focus:border-black/30"
                style={{ borderColor: "rgba(13,13,13,.15)" }}
              />
            </div>
            <div>
              <FieldLabel>Site</FieldLabel>
              <input
                value={site}
                onChange={e => setSite(e.target.value)}
                placeholder="empresa.com.br"
                className="w-full rounded border bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition focus:border-black/30"
                style={{ borderColor: "rgba(13,13,13,.15)" }}
              />
            </div>
          </div>
        </main>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t px-5 py-3.5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {erro ? <p role="alert" className="min-w-0 text-[0.6875rem] font-medium text-[#D94E4E]">{erro}</p> : <div />}
          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-[0.75rem] font-semibold text-black/35 transition hover:text-black/55">Cancelar</button>
            <button type="button" onClick={handleSalvar} disabled={saving}
              className="flex items-center gap-1.5 rounded acao-salvar px-5 py-2.5 text-[0.75rem] font-bold text-white transition active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed">
              <Save size={12} /> {saving ? "Salvando…" : "Criar cliente"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
