"use client";

import { useEffect, useState } from "react";
import { Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";

type EscopoTipo = "empresas" | "negociacoes" | "inscricoes";
type EscopoModo = "pedido" | "consulta" | "ver_tudo";

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

export default function WorkspaceCaptadorPage() {
  const organizationId = useOrganizationId();
  const [carregando, setCarregando] = useState(true);
  const [escopos, setEscopos] = useState<{ tipo: EscopoTipo; habilitado: boolean; modo: EscopoModo }[] | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);

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

      setEscopos(workspace?.captador_workspace_escopos ?? []);
      setCarregando(false);
    }
    void carregar();
  }, [organizationId]);

  if (carregando) return null;

  const habilitados = (escopos ?? []).filter(e => e.habilitado);

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded bg-[#7259B5]/10"><Briefcase size={20} className="text-[#7259B5]" /></div>
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
              <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-[#B07A14]">Em construção — a consulta/solicitação em si ainda não está funcional.</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
