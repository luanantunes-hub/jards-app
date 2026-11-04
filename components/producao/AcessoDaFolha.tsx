"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";

type Acesso = { id: string; email: string; user_id: string | null; aceito_em: string | null; revogado_em: string | null };

const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";

/**
 * O acesso da pessoa à folha dela (PD1.12): quem edita a produção convida pelo e-mail da ficha e revoga. A
 * pessoa entra em /minha-folha com o mesmo e-mail e só vê as datas em que está escalada.
 */
export function AcessoDaFolha({ organizationId, pessoaId, email }: { organizationId: string; pessoaId: string; email: string | null }) {
  const [acesso, setAcesso] = useState<Acesso | null | undefined>(undefined);
  const [trabalhando, setTrabalhando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_acessos_equipe")
        .select("id, email, user_id, aceito_em, revogado_em").eq("pessoa_id", pessoaId).maybeSingle();
      if (ativo) setAcesso(error ? null : (data as Acesso | null));
    })();
    return () => { ativo = false; };
  }, [pessoaId, versao]);

  async function gravar(mudanca: () => PromiseLike<{ error: { code?: string } | null }>) {
    setTrabalhando(true);
    setErro(null);
    const { error } = await mudanca();
    setTrabalhando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode mudar este acesso." : "Não foi possível guardar. Tente de novo."); return; }
    setVersao(atual => atual + 1);
  }

  const producao = () => clienteDaProducao(createClient());
  const convidar = () => gravar(() => acesso
    ? producao().from("producao_acessos_equipe").update({ email: (email ?? "").trim().toLowerCase(), revogado_em: null, user_id: null, aceito_em: null }).eq("id", acesso.id)
    : producao().from("producao_acessos_equipe").insert({ organization_id: organizationId, pessoa_id: pessoaId, email: (email ?? "").trim().toLowerCase() }));
  const revogar = () => gravar(() => producao().from("producao_acessos_equipe").update({ revogado_em: new Date().toISOString() }).eq("id", (acesso as Acesso).id));

  async function copiarLink() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/minha-folha`); setCopiado(true); } catch { setErro("Não foi possível copiar. Selecione o link e copie à mão."); }
  }

  const ativo = acesso && !acesso.revogado_em;
  return (
    <section aria-label="Acesso à folha" className="rounded border p-3.5" style={{ borderColor: "rgba(13,13,13,.10)" }}>
      <p className="text-[0.75rem] font-semibold text-[#282525]">Acesso à folha do dia</p>
      <p className="mt-0.5 text-[0.6875rem] text-black/50">A pessoa entra com a própria conta e vê só as datas em que está escalada. Não vê mais ninguém nem dinheiro.</p>
      {erro && <p role="alert" className="mt-2 text-[0.6875rem] text-[#B23B3B]">{erro}</p>}
      {acesso === undefined ? null : ativo ? (
        <div className="mt-3 space-y-2.5">
          <p className="text-[0.75rem] text-black/65">{acesso.user_id ? "Acesso ativo" : "Convidada"} · {acesso.email}{acesso.user_id ? "" : ". Ainda não entrou."}</p>
          {!acesso.user_id && <p className="text-[0.6875rem] text-black/45">Mande o link abaixo. Ela entra ou cria a conta com este mesmo e-mail.</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void copiarLink()} className={BOTAO}>{copiado ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}{copiado ? "Link copiado" : "Copiar link"}</button>
            <button type="button" onClick={() => void revogar()} disabled={trabalhando} className={BOTAO}>Retirar o acesso</button>
          </div>
        </div>
      ) : !email ? (
        <p className="mt-3 text-[0.6875rem] text-black/45">Cadastre o e-mail da pessoa e salve para poder dar o acesso.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {acesso?.revogado_em && <p className="text-[0.6875rem] text-black/45">O acesso foi retirado.</p>}
          <button type="button" onClick={() => void convidar()} disabled={trabalhando} className={BOTAO}>{acesso ? "Dar o acesso de novo" : "Dar acesso à folha"}</button>
        </div>
      )}
    </section>
  );
}
