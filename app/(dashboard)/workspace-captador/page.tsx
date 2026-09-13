"use client";

import { useEffect, useState } from "react";
import { Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";

type EscopoTipo = "empresas" | "negociacoes" | "inscricoes";
type EscopoModo = "pedido" | "consulta" | "ver_tudo";
type Escopo = { tipo: EscopoTipo; habilitado: boolean; modo: EscopoModo };

const TIPO_LABEL: Record<EscopoTipo, string> = {
  empresas: "Empresas",
  negociacoes: "Negociações",
  inscricoes: "Inscrições",
};

const MODO_LABEL: Record<EscopoModo, string> = {
  pedido: "Solicitação — pede acesso e espera aprovação",
  consulta: "Consulta — verifica um item específico",
  ver_tudo: "Ver tudo — lista completa",
};

type LinhaEmpresa = { id: string; nome: string; status: string | null };
type LinhaCaptacao = { id: string; titulo: string; status: string; empresaNome: string };

export default function WorkspaceCaptadorPage() {
  const organizationId = useOrganizationId();
  const [carregando, setCarregando] = useState(true);
  const [escopos, setEscopos] = useState<Escopo[] | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [empresas, setEmpresas] = useState<LinhaEmpresa[]>([]);
  const [negociacoes, setNegociacoes] = useState<LinhaCaptacao[]>([]);
  const [inscricoes, setInscricoes] = useState<LinhaCaptacao[]>([]);

  useEffect(() => {
    async function carregar() {
      if (!organizationId) return;
      setCarregando(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: captador } = await (supabase as any)
        .from("captadores")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!captador) { setNaoEncontrado(true); setCarregando(false); return; }

      const { data: workspace } = await (supabase as any)
        .from("captador_workspaces")
        .select("captador_workspace_escopos(tipo, habilitado, modo)")
        .eq("captador_id", captador.id)
        .maybeSingle();

      const escoposCarregados = (workspace?.captador_workspace_escopos ?? []) as Escopo[];
      setEscopos(escoposCarregados);

      const verTudo = (tipo: EscopoTipo) => escoposCarregados.some(e => e.tipo === tipo && e.habilitado && e.modo === "ver_tudo");

      if (verTudo("empresas")) {
        const { data } = await (supabase as any)
          .from("empresas_crm")
          .select("id, nome, status")
          .eq("organization_id", organizationId)
          .order("nome");
        setEmpresas((data ?? []) as LinhaEmpresa[]);
      }

      if (verTudo("negociacoes")) {
        const { data } = await (supabase as any)
          .from("captacoes")
          .select("id, titulo, status, empresa_crm:empresas_crm!empresa_crm_id(nome), empresa_pub:empresas!empresa_id(nome)")
          .eq("organization_id", organizationId)
          .order("updated_at", { ascending: false });
        setNegociacoes(((data ?? []) as any[]).map(r => ({
          id: r.id, titulo: r.titulo, status: r.status,
          empresaNome: r.empresa_crm?.nome ?? r.empresa_pub?.nome ?? "—",
        })));
      }

      if (verTudo("inscricoes")) {
        const { data } = await (supabase as any)
          .from("editais_user")
          .select("id, titulo, status, empresas_crm!empresa_crm_id(nome), empresas!empresa_pub_id(nome)")
          .eq("organization_id", organizationId)
          .order("updated_at", { ascending: false });
        setInscricoes(((data ?? []) as any[]).map(r => ({
          id: r.id, titulo: r.titulo ?? "Sem título", status: r.status,
          empresaNome: r.empresas_crm?.nome ?? r.empresas?.nome ?? "—",
        })));
      }

      setCarregando(false);
    }
    void carregar();
  }, [organizationId]);

  if (carregando) return null;

  const habilitados = (escopos ?? []).filter(e => e.habilitado);

  function ListaCaptacao({ linhas, vazio }: { linhas: LinhaCaptacao[]; vazio: string }) {
    if (linhas.length === 0) return <p className="mt-3 text-[12px] text-black/35">{vazio}</p>;
    return (
      <div className="mt-3 divide-y divide-black/[.06] rounded border border-black/[.08]">
        {linhas.map(linha => (
          <div key={linha.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-medium text-black/80">{linha.titulo}</p>
              <p className="truncate text-[11px] text-black/40">{linha.empresaNome}</p>
            </div>
            <span className="shrink-0 rounded bg-black/[.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-black/50">{linha.status}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded bg-black/[.05]"><Briefcase size={20} className="text-black" /></div>
        <div>
          <h1 className="text-[22px] font-bold text-black">Seu workspace</h1>
          <p className="text-[13px] text-black/45">Acesso limitado configurado pela organização que te convidou.</p>
        </div>
      </div>

      {naoEncontrado ? (
        <p className="mt-8 text-[13px] text-black/50">Não encontramos um workspace configurado pra você nesta organização.</p>
      ) : habilitados.length === 0 ? (
        <p className="mt-8 text-[13px] text-black/50">Nenhum acesso foi habilitado ainda. Fale com quem te convidou.</p>
      ) : (
        <div className="mt-8 space-y-3">
          {habilitados.map(escopo => (
            <div key={escopo.tipo} className="rounded border border-black/[.10] p-4">
              <p className="text-[14px] font-semibold text-black">{TIPO_LABEL[escopo.tipo]}</p>
              <p className="mt-1 text-[12px] text-black/45">{MODO_LABEL[escopo.modo]}</p>

              {escopo.modo === "ver_tudo" ? (
                escopo.tipo === "empresas" ? (
                  empresas.length === 0 ? <p className="mt-3 text-[12px] text-black/35">Nenhuma empresa cadastrada ainda.</p> : (
                    <div className="mt-3 divide-y divide-black/[.06] rounded border border-black/[.08]">
                      {empresas.map(e => (
                        <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <p className="truncate text-[12.5px] font-medium text-black/80">{e.nome}</p>
                          {e.status && <span className="shrink-0 rounded bg-black/[.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-black/50">{e.status}</span>}
                        </div>
                      ))}
                    </div>
                  )
                ) : escopo.tipo === "negociacoes" ? (
                  <ListaCaptacao linhas={negociacoes} vazio="Nenhuma negociação em andamento." />
                ) : (
                  <ListaCaptacao linhas={inscricoes} vazio="Nenhuma inscrição em andamento." />
                )
              ) : (
                <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-[#B07A14]">Em construção — esse modo ainda não está funcional.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
