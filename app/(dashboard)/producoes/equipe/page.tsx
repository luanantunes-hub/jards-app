"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { rotuloDoTipoDePessoa } from "@/lib/producao/equipe";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { PessoaSheet, type PessoaEditavel } from "@/components/producao/PessoaSheet";
import { ImportarPessoasSheet } from "@/components/producao/ImportarPessoasSheet";
import { chaveDoNome } from "@/lib/dominio";

/** A equipe da produção: as pessoas da organização, com ou sem conta no Jards. */
export default function EquipePage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [pessoas, setPessoas] = useState<PessoaEditavel[] | null>(null);
  const [busca, setBusca] = useState("");
  const [arquivadas, setArquivadas] = useState(false);
  const [folha, setFolha] = useState<{ pessoa?: PessoaEditavel } | null>(null);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_pessoas")
        .select("id, nome, nome_artistico, email, telefone, tipo, arquivada").eq("organization_id", organizationId).order("nome");
      if (!ativo) return;
      setPessoas((data ?? []) as PessoaEditavel[]);
      setErro(error ? "Não foi possível carregar a equipe. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  const visiveis = useMemo(() => {
    const chave = chaveDoNome(busca);
    return (pessoas ?? []).filter(pessoa => pessoa.arquivada === arquivadas
      && (!chave || chaveDoNome(`${pessoa.nome} ${pessoa.nome_artistico ?? ""}`).includes(chave)));
  }, [pessoas, busca, arquivadas]);
  const temArquivadas = (pessoas ?? []).some(pessoa => pessoa.arquivada);

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Equipe</h1>
              <p className="mt-1 text-[0.75rem] text-black/45">As pessoas que trabalham nas suas produções, com ou sem conta no Jards.</p>
            </div>
            {podeEditar && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setImportando(true)} className="rounded border border-black/[.12] px-3.5 py-2 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Importar planilha</button>
                <PrimaryListAction onClick={() => setFolha({})}><Plus size={13} aria-hidden="true" /> Nova pessoa</PrimaryListAction>
              </div>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <label className="relative block w-full max-w-xs">
              <span className="sr-only">Buscar pessoa</span>
              <Search size={13} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
              <input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar pelo nome" className="h-10 w-full rounded border border-black/[.12] bg-white pl-8 pr-3 text-[0.8125rem] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
            </label>
            {temArquivadas && (
              <button type="button" onClick={() => setArquivadas(atual => !atual)} aria-pressed={arquivadas} className={`h-10 rounded border px-3.5 text-[0.75rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${arquivadas ? "border-[#7259B5]/40 text-[#7259B5]" : "border-black/[.12] text-black/55 hover:bg-black/[.04]"}`}>Arquivadas</button>
            )}
          </div>
        </div>
      </header>

      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {pessoas === null ? (
          <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : visiveis.length === 0 ? (
          <div className="rounded border bg-white px-5 py-10 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.8125rem] font-medium text-black/55">{pessoas.length === 0 ? "Ninguém cadastrado ainda" : "Nenhuma pessoa encontrada"}</p>
            {pessoas.length === 0 && <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Cadastre a equipe uma vez e escale em qualquer data. Quem trabalha com você não precisa ter conta no Jards.</p>}
            {pessoas.length === 0 && podeEditar && <div className="mt-4 flex justify-center"><PrimaryListAction onClick={() => setFolha({})}><Plus size={13} aria-hidden="true" /> Nova pessoa</PrimaryListAction></div>}
          </div>
        ) : (
          <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <ul className="divide-y divide-black/[.06]">
              {visiveis.map(pessoa => (
                <li key={pessoa.id}>
                  <button type="button" onClick={() => podeEditar && setFolha({ pessoa })} disabled={!podeEditar} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition enabled:hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                    <span className="min-w-0 flex-1 basis-56">
                      <span className="block truncate text-[0.8125rem] font-medium text-[#282525]">
                        {pessoa.nome}{pessoa.nome_artistico && <span className="font-normal text-black/45"> · {pessoa.nome_artistico}</span>}
                      </span>
                      <span className="block truncate text-[0.6875rem] text-black/45">{[pessoa.email, pessoa.telefone].filter(Boolean).join(" · ") || "Sem contato"}</span>
                    </span>
                    <span className="text-[0.6875rem] text-black/55">{rotuloDoTipoDePessoa(pessoa.tipo)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DetailPageContent>

      {importando && organizationId && <ImportarPessoasSheet organizationId={organizationId} existentes={(pessoas ?? []).map(pessoa => ({ nome: pessoa.nome, email: pessoa.email }))} onClose={() => setImportando(false)} onImported={() => setVersao(atual => atual + 1)} />}
      {folha && organizationId && <PessoaSheet organizationId={organizationId} pessoa={folha.pessoa} onClose={() => setFolha(null)} onSaved={() => setVersao(atual => atual + 1)} />}
    </div>
  );
}
