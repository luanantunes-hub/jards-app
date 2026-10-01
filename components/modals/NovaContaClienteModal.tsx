"use client";
import { useState, useEffect, useId, useRef } from "react";
import { X, Users, Save, Search, Building2, Handshake, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { usePortalPosition, PortalMenu } from "@/components/ui/ComboboxPortalMenu";
import { useModalDismiss } from "@/hooks/useModalDismiss";

type EmpresaOption = { id: string; nome: string; tipo: string };
type AgenciaOption = { id: string; nome: string };
type MembroOption = { id: string; nome: string; email: string | null };

export function NovaContaClienteModal({ onClose, onSaved }: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const organizationId = useOrganizationId();

  const [busca, setBusca] = useState("");
  const buscaBoxRef = useRef<HTMLDivElement>(null);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<EmpresaOption | null>(null);
  const [agenciaId, setAgenciaId] = useState("");
  const [agencias, setAgencias] = useState<AgenciaOption[]>([]);
  const [responsavelId, setResponsavelId] = useState("");
  const [membros, setMembros] = useState<MembroOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(onClose);

  useEffect(() => {
    if (!busca.trim() || !organizationId) { setEmpresas([]); return; }
    async function buscarEmpresas() {
      const { data } = await (supabase as any)
        .from("empresas_crm")
        .select("id, nome, tipo")
        .eq("organization_id", organizationId)
        .ilike("nome", `%${busca}%`)
        .order("nome")
        .limit(8);
      setEmpresas(data ?? []);
    }
    buscarEmpresas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    void Promise.all([
      (supabase as any).from("captadores").select("id,nome").eq("organization_id", organizationId).or("ativo.eq.true,ativo.is.null").order("nome"),
      (supabase as any).rpc("get_organization_members", { org_id: organizationId }),
    ]).then(([agenciasResult, membrosResult]) => {
      setAgencias((agenciasResult.data ?? []) as AgenciaOption[]);
      setMembros(((membrosResult.data ?? []) as Array<{ user_id: string; full_name: string | null; email: string | null }>)
        .filter(membro => membro.full_name || membro.email)
        .map(membro => ({ id: membro.user_id, nome: membro.full_name ?? membro.email ?? "Membro", email: membro.email })));
    });
  }, [organizationId]);

  async function handleSalvar() {
    if (!empresaSelecionada) { setErro("Selecione ou crie uma empresa."); return; }
    setSaving(true); setErro(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErro("Usuário não autenticado"); setSaving(false); return; }

    let crmId = empresaSelecionada.id;
    let empresaCriadaAgora = false;

    // Se a opção selecionada for "nova empresa", cria primeiro
    if (crmId === "__new__") {
      const { data: novaEmpresa, error: erroEmpresa } = await (supabase as any)
        .from("empresas_crm")
        .insert({ nome: busca.trim(), tipo: "cliente_ativo", account_id: user.id, organization_id: organizationId })
        .select("id")
        .single();
      if (erroEmpresa || !novaEmpresa) { setErro(erroEmpresa?.message ?? "Erro ao criar empresa"); setSaving(false); return; }
      crmId = novaEmpresa.id;
      empresaCriadaAgora = true;
    }

    const { data: conta, error } = await (supabase as any).from("contas_patrocinio").insert({
      account_id: user.id,
      organization_id: organizationId,
      empresa_crm_id: crmId,
      nome: null,
      status: "ativa",
      responsavel_id: responsavelId || null,
    }).select("id").single();

    if (error) {
      // Evita deixar uma empresa vazia quando o limite de clientes impede a
      // segunda etapa da criacao.
      if (empresaCriadaAgora) {
        await (supabase as any).from("empresas_crm").delete().eq("id", crmId);
      }
      setErro(error.message);
      setSaving(false);
      return;
    }
    if (agenciaId && conta?.id) {
      const { data: contrato } = await (supabase as any).from("contratos").select("id").eq("conta_patrocinio_id", conta.id).eq("rascunho_automatico", true).order("created_at").limit(1).maybeSingle();
      if (contrato?.id) {
        const { error: erroAgencia } = await (supabase as any).from("participacoes_agencia_cliente").insert({
          account_id: user.id, organization_id: organizationId, conta_patrocinio_id: conta.id,
          contrato_id: contrato.id, captador_id: agenciaId, papel: "principal", status: "ativa",
        });
        if (erroAgencia) { setErro(`Cliente criado, mas a agência não foi vinculada: ${erroAgencia.message}`); setSaving(false); onSaved(); return; }
      }
    }
    setSaving(false);
    onSaved(); onClose();
  }

  const opcoes: EmpresaOption[] = busca.trim()
    ? [...empresas, { id: "__new__", nome: `Criar "${busca.trim()}"`, tipo: "" }]
    : empresas;
  const buscaMenuPos = usePortalPosition(buscaBoxRef, busca.trim().length > 0 && opcoes.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center"
      style={{ background: "rgba(0,0,0,.45)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[96dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-b bg-white"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,.12)", borderBottom: "1px solid rgba(13,13,13,.08)", borderLeft: "1px solid rgba(13,13,13,.06)", borderRight: "1px solid rgba(13,13,13,.06)" }}
        onClick={e => e.stopPropagation()}>

        <header className="flex shrink-0 items-center justify-between border-b px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-black/5">
              <Users size={16} className="text-black/50" />
            </div>
            <h2 id={titleId} className="text-[15px] font-bold text-black">Novo cliente</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/[.06]">
            <X size={15} className="text-black/40" />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Empresa */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-black/30 mb-1.5">Empresa</p>
            {empresaSelecionada ? (
              <div className="flex items-center justify-between rounded border px-3 py-2.5"
                style={{ borderColor: "rgba(13,13,13,.15)" }}>
                <div className="flex items-center gap-2">
                  <Building2 size={13} className="text-black/40 flex-shrink-0" />
                  <span className="text-[13px] font-semibold text-black">{empresaSelecionada.nome}</span>
                </div>
                <button type="button" onClick={() => { setEmpresaSelecionada(null); setBusca(""); setAgenciaId(""); setResponsavelId(""); }}
                  className="text-[11px] text-black/35 hover:text-black/55 transition">trocar</button>
              </div>
            ) : (
              <div className="relative">
                <div ref={buscaBoxRef} className="flex items-center gap-2 rounded border px-3 py-2.5" style={{ borderColor: "rgba(13,13,13,.15)" }}>
                  <Search size={13} className="text-black/30 flex-shrink-0" />
                  <input
                    autoFocus
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar ou criar empresa…"
                    className="flex-1 text-[13px] text-black outline-none bg-transparent"
                  />
                </div>
                {busca.trim().length > 0 && opcoes.length > 0 && (
                  <PortalMenu position={buscaMenuPos}>
                    {opcoes.map(e => (
                      <button key={e.id} type="button"
                        onMouseDown={ev => { ev.preventDefault(); setEmpresaSelecionada(e); }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] hover:bg-black/[.04] transition">
                        {e.id === "__new__"
                          ? <span className="text-[#7259B5] font-semibold">{e.nome}</span>
                          : <><Building2 size={12} className="text-black/30 flex-shrink-0" /><span className="text-black">{e.nome}</span></>
                        }
                      </button>
                    ))}
                  </PortalMenu>
                )}
              </div>
            )}
          </div>

          {/* Responsável interno */}
          <div className="border-t pt-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-black">
              <UserRound size={12} className="text-black/35" /> Responsável interno
              <span className="font-normal text-black/30">recomendado</span>
            </label>
            <CustomDropdown
              value={responsavelId}
              onChange={setResponsavelId}
              options={[{ value: "", label: "Sem responsável" }, ...membros.map(membro => ({ value: membro.id, label: membro.nome, sublabel: membro.email ?? undefined }))]}
              compact
              portalZIndex={100}
              className="w-full [&>button]:h-10 [&>button]:w-full"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-black"><Handshake size={12} className="text-black/35"/>Agência de captação <span className="text-black/30 font-normal">opcional</span></label>
            <CustomDropdown value={agenciaId} onChange={setAgenciaId} options={[{ value: "", label: "Sem agência vinculada" }, ...agencias.map(agencia => ({ value: agencia.id, label: agencia.nome }))]} compact portalZIndex={100} className="w-full [&>button]:h-10 [&>button]:w-full"/>
          </div>

        </main>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t px-5 py-3.5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {erro ? <p role="alert" className="min-w-0 text-[11px] font-medium text-[#D94E4E]">{erro}</p> : <div />}
          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-[12px] font-semibold text-black/35 transition hover:text-black/55">Cancelar</button>
            <button type="button" onClick={handleSalvar} disabled={saving || !empresaSelecionada}
              className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2.5 text-[12px] font-bold text-white transition hover:bg-[#26752A] active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed">
              <Save size={12} /> {saving ? "Salvando…" : "Criar cliente"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
