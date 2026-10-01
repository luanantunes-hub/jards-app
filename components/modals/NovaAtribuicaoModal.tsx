"use client";
import { useState, useEffect, useRef } from "react";
import { X, Shield, Search, FolderOpen, UserCheck, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import type { Atribuicao, TipoExclusividade } from "@/lib/supabase/types";
import { CompanyLogo } from "@/components/CompanyLogo";
import { usePortalPosition, PortalMenu } from "@/components/ui/ComboboxPortalMenu";

type EmpresaOption = { id: string; nome: string; domain_key?: string | null; site?: string | null };

type AtribuicaoCompleta = Atribuicao & {
  empresa_crm: EmpresaOption | null;
  projeto: { id: string; nome: string } | null;
  captador: { nome: string } | null;
};

interface Props {
  editData: AtribuicaoCompleta | null;
  empresaPreSelecionada?: EmpresaOption;
  tipoPreSelecionado?: TipoExclusividade;
  onClose: () => void;
  onSaved: () => void;
}

const TIPOS: { value: TipoExclusividade; label: string; desc: string; color: string; Icon: typeof Shield }[] = [
  { value: "exclusividade_empresa", label: "Exclusiva",     desc: "Apenas este captador. Escopo: empresa inteira ou projeto selecionado.", color: "#D94E4E", Icon: Shield },
  { value: "compartilhada",         label: "Compartilhada", desc: "Vários captadores atuam em contextos distintos.",                        color: "#1A8B7A", Icon: UserCheck },
];

// Tipos que existem no banco mas não têm um card nesta tela — mostrados só
// como indicação, pra não parecer que nenhum tipo está selecionado.
const OUTROS_TIPOS_LABEL: Partial<Record<TipoExclusividade, string>> = {
  livre: "Livre",
  exclusividade_projeto: "Exclusividade por projeto",
  time_lock: "Time lock",
  relacao_pessoal: "Relação pessoal",
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 flex items-center text-[12px] font-semibold text-black">{children}</label>;
}

const fieldClass = "w-full rounded border bg-white px-3 py-2.5 text-[13px] text-black outline-none transition focus:border-black/30";
const fieldStyle = { borderColor: "rgba(13,13,13,.15)" } as const;

export function NovaAtribuicaoModal({ editData, empresaPreSelecionada, tipoPreSelecionado, onClose, onSaved }: Props) {
  const supabase = createClient();
  const organizationId = useOrganizationId();

  const [empresaBusca, setEmpresaBusca] = useState("");
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<EmpresaOption | null>(empresaPreSelecionada ?? null);
  const empresaBoxRef = useRef<HTMLDivElement>(null);
  const empresaMenuPos = usePortalPosition(empresaBoxRef, empresas.length > 0);

  const [projetoBusca, setProjetoBusca] = useState("");
  const [projetos, setProjetos] = useState<{ id: string; nome: string }[]>([]);
  const [projetoSelecionado, setProjetoSelecionado] = useState<{ id: string; nome: string } | null>(null);
  const projetoBoxRef = useRef<HTMLDivElement>(null);
  const projetoMenuPos = usePortalPosition(projetoBoxRef, projetos.length > 0);

  const [captadorBusca, setCaptadorBusca] = useState("");
  const [captadores, setCaptadores] = useState<{ id: string; nome: string }[]>([]);
  const [captadorSelecionado, setCaptadorSelecionado] = useState<{ id: string; nome: string } | null>(null);
  const captadorBoxRef = useRef<HTMLDivElement>(null);
  const captadorMenuPos = usePortalPosition(captadorBoxRef, captadores.length > 0);
  const [erro, setErro] = useState<string | null>(null);

  const [tipo, setTipo] = useState<TipoExclusividade>(tipoPreSelecionado ?? "exclusividade_empresa");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split("T")[0]);
  const [dataFim, setDataFim] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function resolverOrgId(): Promise<string | null> {
    if (organizationId) return organizationId;
    const { data: ids } = await supabase.rpc("auth_org_ids");
    return (ids as unknown as string[] | null)?.[0] ?? null;
  }

  // Search empresas
  useEffect(() => {
    if (empresaBusca.length < 2) { setEmpresas([]); return; }
    const timer = setTimeout(async () => {
      const orgId = await resolverOrgId();
      if (!orgId) return;
      const { data } = await supabase
        .from("empresas_crm")
        .select("id, nome, domain_key, site")
        .eq("organization_id", orgId)
        .ilike("nome", `%${empresaBusca}%`)
        .limit(8);
      setEmpresas((data as any) ?? []);
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaBusca, supabase, organizationId]);

  // Search projetos — restrito à organização atual, já que projetos_crm
  // isola por dono (account_id) e não por organização via RLS.
  useEffect(() => {
    if (projetoBusca.length < 2) { setProjetos([]); return; }
    const timer = setTimeout(async () => {
      const orgId = await resolverOrgId();
      if (!orgId) return;
      const { data } = await (supabase as any)
        .from("projetos_crm")
        .select("id, nome")
        .eq("organization_id", orgId)
        .ilike("nome", `%${projetoBusca}%`)
        .limit(8);
      setProjetos((data as any) ?? []);
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoBusca, supabase, organizationId]);

  // Search captadores (agencies from captadores table)
  useEffect(() => {
    if (captadorBusca.length < 2) { setCaptadores([]); return; }
    const timer = setTimeout(async () => {
      const orgId = await resolverOrgId();
      if (!orgId) return;
      const { data } = await (supabase as any)
        .from("captadores")
        .select("id, nome")
        .eq("organization_id", orgId)
        .or("ativo.eq.true,ativo.is.null")
        .ilike("nome", `%${captadorBusca}%`)
        .limit(8);
      setCaptadores((data as any) ?? []);
    }, 300);
    return () => clearTimeout(timer);
  }, [captadorBusca, supabase, organizationId]);

  // Fill form on edit
  useEffect(() => {
    if (!editData) return;
    setEmpresaSelecionada(editData.empresa_crm ? { ...editData.empresa_crm, id: editData.empresa_crm_id } : null);
    setProjetoSelecionado(editData.projeto ? { id: editData.projeto_id!, nome: editData.projeto.nome } : null);
    setCaptadorSelecionado(editData.captador ? { id: editData.captador_user_id, nome: editData.captador.nome } : null);
    setTipo(editData.tipo);
    setDataInicio(editData.data_inicio);
    setDataFim(editData.data_fim || "");
  }, [editData]);

  async function handleSalvar() {
    if (!empresaSelecionada || !captadorSelecionado) return;
    setSalvando(true);
    setErro(null);

    const orgId = await resolverOrgId();
    if (!orgId) { setErro("Organização não encontrada"); setSalvando(false); return; }

    const { data: { user } } = await supabase.auth.getUser();

    const payload: any = {
      empresa_crm_id: empresaSelecionada.id,
      projeto_id: projetoSelecionado?.id || null,
      captador_user_id: captadorSelecionado.id,
      tipo,
      status: editData?.status || "ativa",
      data_inicio: dataInicio,
      data_fim: dataFim || null,
      motivo: null,
      account_id: user?.id,
      organization_id: orgId,
    };

    let error: any;
    if (editData) {
      ({ error } = await (supabase.from("atribuicoes") as any).update(payload).eq("id", editData.id));
    } else {
      ({ error } = await (supabase.from("atribuicoes") as any).insert(payload));
    }

    setSalvando(false);
    if (error) { setErro(error.message); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center" style={{ background: "rgba(0,0,0,.45)" }} onClick={onClose}>
      <div
        className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-b bg-white"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,.12)", borderBottom: "1px solid rgba(13,13,13,.08)", borderLeft: "1px solid rgba(13,13,13,.06)", borderRight: "1px solid rgba(13,13,13,.06)" }}
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-black/5">
              <Shield size={16} className="text-black/50" />
            </div>
            <h2 className="text-[15px] font-bold text-black">{editData ? "Editar atribuição" : "Nova atribuição"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/[.06]">
            <X size={15} className="text-black/40" />
          </button>
        </header>

        <main className="px-5 py-5">
          {/* Empresa */}
          <div className="mb-4">
            <FieldLabel>Empresa *</FieldLabel>
            {empresaSelecionada ? (
              <div className="flex items-center gap-2 rounded border bg-black/[.02] px-3 py-2.5" style={fieldStyle}>
                <CompanyLogo nome={empresaSelecionada.nome} domain={empresaSelecionada.domain_key} site={empresaSelecionada.site} size={24} className="flex-shrink-0" />
                <span className="flex-1 text-[13px] font-medium text-black">{empresaSelecionada.nome}</span>
                <button type="button" onClick={() => { setEmpresaSelecionada(null); setProjetoSelecionado(null); setProjetoBusca(""); setProjetos([]); }} className="text-black/30 hover:text-black/60"><X size={12} /></button>
              </div>
            ) : (
              <div ref={empresaBoxRef} className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/25" />
                <input
                  type="text"
                  value={empresaBusca}
                  onChange={(e) => setEmpresaBusca(e.target.value)}
                  placeholder="Buscar empresa…"
                  className={`${fieldClass} pl-9`}
                  style={fieldStyle}
                />
                {empresas.length > 0 && (
                  <PortalMenu position={empresaMenuPos}>
                    {empresas.map(e => (
                      <button
                        key={e.id}
                        type="button"
                        onMouseDown={ev => { ev.preventDefault(); setEmpresaSelecionada(e); setEmpresaBusca(""); setEmpresas([]); setProjetoSelecionado(null); setProjetoBusca(""); setProjetos([]); }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] text-black/70 transition hover:bg-black/[.04]"
                      >
                        <CompanyLogo nome={e.nome} domain={e.domain_key} site={e.site} size={24} className="flex-shrink-0" />
                        <span className="truncate">{e.nome}</span>
                      </button>
                    ))}
                  </PortalMenu>
                )}
              </div>
            )}
          </div>

          {/* Projeto (opcional) */}
          <div className="mb-4">
            <FieldLabel>Projeto</FieldLabel>
            {projetoSelecionado ? (
              <div className="flex items-center gap-2 rounded border bg-black/[.02] px-3 py-2.5" style={fieldStyle}>
                <FolderOpen size={14} className="text-black/40" />
                <span className="flex-1 text-[13px] font-medium text-black">{projetoSelecionado.nome}</span>
                <button type="button" onClick={() => setProjetoSelecionado(null)} className="text-black/30 hover:text-black/60"><X size={12} /></button>
              </div>
            ) : (
              <div ref={projetoBoxRef} className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/25" />
                <input
                  type="text"
                  value={projetoBusca}
                  onChange={(e) => setProjetoBusca(e.target.value)}
                  placeholder="Buscar projeto…"
                  className={`${fieldClass} pl-9`}
                  style={fieldStyle}
                />
                {projetos.length > 0 && (
                  <PortalMenu position={projetoMenuPos}>
                    {projetos.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={ev => { ev.preventDefault(); setProjetoSelecionado(p); setProjetoBusca(""); setProjetos([]); }}
                        className="block w-full px-3 py-2 text-left text-[12px] text-black/70 transition hover:bg-black/[.04]"
                      >
                        {p.nome}
                      </button>
                    ))}
                  </PortalMenu>
                )}
              </div>
            )}
          </div>

          {/* Captador */}
          <div className="mb-4">
            <FieldLabel>Captador *</FieldLabel>
            {captadorSelecionado ? (
              <div className="flex items-center gap-2 rounded border bg-black/[.02] px-3 py-2.5" style={fieldStyle}>
                <UserCheck size={14} className="text-black/40" />
                <span className="flex-1 text-[13px] font-medium text-black">{captadorSelecionado.nome}</span>
                <button type="button" onClick={() => setCaptadorSelecionado(null)} className="text-black/30 hover:text-black/60"><X size={12} /></button>
              </div>
            ) : (
              <div ref={captadorBoxRef} className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/25" />
                <input
                  type="text"
                  value={captadorBusca}
                  onChange={(e) => setCaptadorBusca(e.target.value)}
                  placeholder="Buscar captador…"
                  className={`${fieldClass} pl-9`}
                  style={fieldStyle}
                />
                {captadores.length > 0 && (
                  <PortalMenu position={captadorMenuPos}>
                    {captadores.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={ev => { ev.preventDefault(); setCaptadorSelecionado(c); setCaptadorBusca(""); setCaptadores([]); }}
                        className="block w-full px-3 py-2 text-left text-[12px] text-black/70 transition hover:bg-black/[.04]"
                      >
                        {c.nome}
                      </button>
                    ))}
                  </PortalMenu>
                )}
              </div>
            )}
          </div>

          {/* Tipo */}
          <div className="mb-4">
            <FieldLabel>Tipo</FieldLabel>
            {OUTROS_TIPOS_LABEL[tipo] && (
              <p className="mb-2 text-[11px] text-black/45">
                Tipo atual: <span className="font-semibold text-black/70">{OUTROS_TIPOS_LABEL[tipo]}</span> — escolher uma opção abaixo substitui esse valor.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map(t => {
                const active = tipo === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTipo(t.value)}
                    className="rounded border px-3 py-3 text-left transition"
                    style={{ borderColor: active ? t.color : "rgba(13,13,13,.15)", background: active ? `${t.color}0D` : "white" }}
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <t.Icon size={12} style={{ color: active ? t.color : "rgba(13,13,13,.35)" }} />
                      <p className="text-[13px] font-semibold" style={{ color: active ? t.color : "#0D0D0D" }}>{t.label}</p>
                    </div>
                    <p className="text-[11px] leading-snug text-black/45">{t.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Data de início</FieldLabel>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
            <div>
              <FieldLabel>Data de fim</FieldLabel>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
          </div>
        </main>

        <footer className="flex items-center justify-between gap-4 border-t px-5 py-3.5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {erro ? <p className="min-w-0 text-[11px] font-medium text-[#D94E4E]">{erro}</p> : <div />}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-[12px] font-semibold text-black/35 transition hover:text-black/55">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={!empresaSelecionada || !captadorSelecionado || salvando}
              className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2.5 text-[12px] font-bold text-white transition hover:bg-[#26732A] active:translate-y-px disabled:opacity-60"
            >
              <Save size={12} /> {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
