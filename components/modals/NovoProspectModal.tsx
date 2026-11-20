"use client";
import { useEffect, useId, useRef, useState } from "react";
import { X, Building2, Save, MessageSquare, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { usePortalPosition, PortalMenu } from "@/components/ui/ComboboxPortalMenu";
import { useTaxonomiasComerciais } from "@/contexts/TaxonomiasComerciaisContext";
import type { OrigemOportunidade, CanalContato } from "@/lib/supabase/types";
import { useModalDismiss } from "@/hooks/useModalDismiss";

export function NovoProspectModal({ onClose, onSaved, nomePreEmpresa, empresaPubId, empresaCrmId, setorPreEmpresa, dominioPreEmpresa, cidadePreEmpresa, ufPreEmpresa }: {
  onClose: () => void;
  onSaved: (id?: string) => void;
  nomePreEmpresa?: string;
  empresaPubId?: string;
  empresaCrmId?: string;
  setorPreEmpresa?: string;
  dominioPreEmpresa?: string;
  cidadePreEmpresa?: string;
  ufPreEmpresa?: string;
}) {
  const supabase = createClient();
  const organizationId = useOrganizationId();
  const { origens, canais } = useTaxonomiasComerciais();

  const [nome, setNome]     = useState(nomePreEmpresa ?? "");
  const [setor, setSetor]   = useState(setorPreEmpresa ?? "");
  const [dominio, setDominio] = useState(dominioPreEmpresa ?? "");
  const [cidadeNome, setCidadeNome] = useState(cidadePreEmpresa ?? "");
  const [cidadeUF, setCidadeUF]     = useState(ufPreEmpresa ?? "");
  const [setoresExistentes, setSetoresExistentes] = useState<string[]>([]);
  const [setorDropdown, setSetorDropdown] = useState(false);
  const setorRef = useRef<HTMLDivElement>(null);
  const setorFieldRef = useRef<HTMLDivElement>(null);
  const setorMenuPos = usePortalPosition(setorFieldRef, setorDropdown);
  const [origem, setOrigem] = useState<OrigemOportunidade | null>(null);
  const [canal, setCanal]   = useState<CanalContato | null>(null);
  const [saving, setSaving] = useState(false);
  const [erro, setErro]     = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(onClose);

  useEffect(() => {
    if (!organizationId) return;
    supabase.from("empresas_crm").select("setor").eq("organization_id", organizationId).not("setor", "is", null)
      .then(({ data }) => {
        const unique = [...new Set(((data ?? []) as any[]).map(r => r.setor as string).filter(Boolean))].sort();
        setSetoresExistentes(unique);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (setorRef.current && !setorRef.current.contains(e.target as Node)) setSetorDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const origensAtivas = origens.filter(item => item.ativo);
  const canaisAtivos  = canais.filter(item => item.ativo);

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

    const localizacao = cidadeNome.trim() && cidadeUF.trim()
      ? `${cidadeNome.trim()}-${cidadeUF.trim().toUpperCase()}`
      : cidadeNome.trim() || null;
    const empresaFields = { nome: nome.trim(), setor: setor.trim() || null, domain_key: dominio.trim() || null, localizacao };

    // Reusa o empresas_crm existente (gravando as edições feitas na tela) ou cria um novo.
    // Confirma antes que o id recebido pertence mesmo à organização ativa —
    // o chamador pode ter resolvido esse id sem filtrar por organização, e
    // cair aqui com o id de uma empresa de outra organização do usuário.
    let crmId: string | null = null;
    if (empresaCrmId) {
      const { data: empresaValida } = await (supabase as any)
        .from("empresas_crm").select("id").eq("id", empresaCrmId).eq("organization_id", organizationId).maybeSingle();
      crmId = empresaValida?.id ?? null;
    }
    if (crmId) {
      const { error: erroEmpresa } = await (supabase as any)
        .from("empresas_crm")
        .update(empresaFields)
        .eq("id", crmId);
      if (erroEmpresa) { setErro(erroEmpresa.message); setSaving(false); return; }
    } else {
      const { data: empresa, error: erroEmpresa } = await (supabase as any)
        .from("empresas_crm")
        .insert({ ...empresaFields, account_id: user.id, organization_id: organizationId })
        .select("id")
        .single();

      if (erroEmpresa || !empresa) {
        setErro(erroEmpresa?.message ?? "Erro ao criar empresa");
        setSaving(false); return;
      }
      crmId = empresa.id as string;
    }

    const captacaoPayload = {
      account_id: user.id,
      organization_id: organizationId,
      empresa_id: empresaPubId ?? null,
      empresa_crm_id: crmId,
      captador_id: user.id,
      status: "prospeccao" as const,
      meio_contato: null,
      origem_oportunidade: origem,
      canal_planejado: canal,
      valor_solicitado: null,
      proxima_prospeccao: null,
    };

    let captResult = await (supabase as any).from("captacoes").insert(captacaoPayload);
    if (captResult.error && /(origem_oportunidade|canal_planejado)/i.test(captResult.error.message)) {
      const legacyPayload = { ...captacaoPayload } as Record<string, unknown>;
      delete legacyPayload.origem_oportunidade;
      delete legacyPayload.canal_planejado;
      captResult = await (supabase as any).from("captacoes").insert(legacyPayload);
    }

    setSaving(false);
    if (captResult.error) { setErro(captResult.error.message); return; }
    onSaved(crmId ?? undefined); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center veu" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="folha-vidro flex max-h-[96dvh] w-full max-w-[30rem] flex-col overflow-hidden"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,.12)", borderBottom: "1px solid rgba(13,13,13,.08)", borderLeft: "1px solid rgba(13,13,13,.06)", borderRight: "1px solid rgba(13,13,13,.06)" }}
        onClick={e => e.stopPropagation()}>

        <header className="flex shrink-0 items-center justify-between border-b px-6 py-5 sm:px-7 sm:py-6" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-black/5">
              <Building2 size={16} className="text-black/50" />
            </div>
            <h2 id={titleId} className="text-[#282525] font-display text-[1.25rem] font-extrabold leading-[1.1] tracking-[-.04em] sm:text-[1.5rem]">Novo prospect</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/[.06]">
            <X size={15} className="text-black/40" />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <SectionLabel>Empresa</SectionLabel>
          <div className="mb-4">
            <FieldLabel>Nome *</FieldLabel>
            <input
              autoFocus
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Nome da empresa"
              className="w-full rounded border bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition focus:border-black/30"
              style={{ borderColor: "rgba(13,13,13,.15)" }}
            />
          </div>

          <div className="mb-5" ref={setorRef}>
            <FieldLabel>Setor</FieldLabel>
            <div className="relative" ref={setorFieldRef}>
              <input
                value={setor}
                onChange={e => { setSetor(e.target.value); setSetorDropdown(true); }}
                onFocus={() => setSetorDropdown(true)}
                placeholder="Ex: Tecnologia, Varejo, Saúde…"
                className="w-full rounded border bg-white px-3 py-2.5 pr-8 text-[0.8125rem] text-[#282525] outline-none transition focus:border-black/30"
                style={{ borderColor: "rgba(13,13,13,.15)" }}
              />
              <button type="button" tabIndex={-1} onClick={() => setSetorDropdown(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-black/25">
                <ChevronDown size={13}/>
              </button>
              {setorDropdown && (() => {
                const q = setor.trim().toLowerCase();
                const filtered = setoresExistentes.filter(s => s.toLowerCase().includes(q));
                const showCreate = q.length > 0 && !setoresExistentes.some(s => s.toLowerCase() === q);
                if (!filtered.length && !showCreate) return null;
                return (
                  <PortalMenu position={setorMenuPos}>
                    {filtered.map(s => (
                      <button key={s} type="button"
                        onMouseDown={e => { e.preventDefault(); setSetor(s); setSetorDropdown(false); }}
                        className="block w-full px-3 py-2 text-left text-[0.75rem] text-black/70 transition hover:bg-black/[.04]">
                        {s}
                      </button>
                    ))}
                    {showCreate && (
                      <button type="button"
                        onMouseDown={e => { e.preventDefault(); setSetorDropdown(false); }}
                        className="block w-full px-3 py-2 text-left text-[0.75rem] text-[#7259B5] transition hover:bg-black/[.04]">
                        Criar "<span className="font-semibold">{setor.trim()}</span>"
                      </button>
                    )}
                  </PortalMenu>
                );
              })()}
            </div>
          </div>

          <div className="mb-4 grid grid-cols-[1fr_auto] gap-2">
            <div>
              <FieldLabel>Domínio</FieldLabel>
              <input
                value={dominio}
                onChange={e => setDominio(e.target.value)}
                placeholder="empresa.com.br"
                className="w-full rounded border bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition focus:border-black/30"
                style={{ borderColor: "rgba(13,13,13,.15)" }}
              />
            </div>
            <div>
              <FieldLabel>Localização</FieldLabel>
              <div className="flex gap-1.5">
                <input
                  value={cidadeNome}
                  onChange={e => setCidadeNome(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("uf-input-prospect")?.focus(); } }}
                  placeholder="Cidade"
                  className="w-32 rounded border bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition focus:border-black/30"
                  style={{ borderColor: "rgba(13,13,13,.15)" }}
                />
                <input
                  id="uf-input-prospect"
                  value={cidadeUF}
                  onChange={e => setCidadeUF(e.target.value.slice(0, 2))}
                  placeholder="UF"
                  maxLength={2}
                  className="w-14 rounded border bg-white px-3 py-2.5 text-[0.8125rem] text-center uppercase text-[#282525] outline-none transition focus:border-black/30"
                  style={{ borderColor: "rgba(13,13,13,.15)" }}
                />
              </div>
            </div>
          </div>

          <section className="border-t pt-5" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <SectionLabel>Planejamento de abordagem</SectionLabel>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <FieldLabel>Origem da oportunidade</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {origensAtivas.map(item => (
                    <button key={item.chave} type="button" onClick={() => setOrigem(origem === item.chave ? null : item.chave)}
                      className="rounded border bg-white px-2.5 py-1.5 text-[0.625rem] font-semibold text-black/55 transition hover:bg-black/[.04]"
                      style={origem === item.chave ? { color: item.cor, borderColor: `${item.cor}70` } : { borderColor: "rgba(13,13,13,.10)" }}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel>Canal planejado</FieldLabel>
                <CustomDropdown value={canal ?? ""} onChange={value => setCanal((value || null) as CanalContato | null)}
                  className="[&>button]:w-full" compact icon={<MessageSquare size={13} />}
                  placeholder="Definir depois"
                  options={[{ value: "", label: "Definir depois" }, ...canaisAtivos.map(item => ({ value: item.chave, label: item.label }))]} />
              </div>
            </div>
          </section>
        </main>

        <footer className="folha-rodape rounded-b-[var(--raio-folha)] flex shrink-0 items-center justify-between gap-4 border-t px-5 py-3.5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {erro ? <p role="alert" className="min-w-0 text-[0.6875rem] font-medium text-[#D94E4E]">{erro}</p> : <div />}
          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-[0.75rem] font-semibold text-black/35 transition hover:text-black/55">Cancelar</button>
            <button type="button" onClick={handleSalvar} disabled={saving}
              className="flex items-center gap-1.5 rounded acao-salvar px-5 py-2.5 text-[0.75rem] font-bold text-white transition active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed">
              <Save size={12} /> {saving ? "Salvando…" : "Criar prospect"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
