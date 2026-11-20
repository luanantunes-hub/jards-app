"use client";

import { useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { AcessoDaFolha } from "@/components/producao/AcessoDaFolha";
import { lerPessoa, ROTULO_DO_TIPO_DE_PESSOA, rotuloDoTipoDePessoa, TIPOS_DE_PESSOA } from "@/lib/producao/equipe";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

export type PessoaEditavel = { id: string; nome: string; nome_artistico: string | null; email: string | null; telefone: string | null; tipo: string; arquivada: boolean };

/** Cadastro e edição de uma pessoa da equipe. Documentos, banco e saúde não entram: esperam a política de dados pessoais. */
export function PessoaSheet({ organizationId, pessoa, onClose, onSaved }: {
  organizationId: string;
  pessoa?: PessoaEditavel;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(pessoa?.nome ?? "");
  const [nomeArtistico, setNomeArtistico] = useState(pessoa?.nome_artistico ?? "");
  const [email, setEmail] = useState(pessoa?.email ?? "");
  const [telefone, setTelefone] = useState(pessoa?.telefone ?? "");
  const [tipo, setTipo] = useState(pessoa?.tipo ?? "equipe");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void, mudanca?: { arquivada: boolean }) {
    const leitura = lerPessoa({ nome, nomeArtistico, email, telefone, tipo });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = pessoa
      ? await producao.from("producao_pessoas").update({ ...leitura.pessoa, ...mudanca }).eq("id", pessoa.id)
      : await producao.from("producao_pessoas").insert({ ...leitura.pessoa, organization_id: organizationId });
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode salvar esta pessoa." : "Não foi possível salvar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  const opcoesDeTipo = [...TIPOS_DE_PESSOA.map(item => ({ value: item as string, label: ROTULO_DO_TIPO_DE_PESSOA[item] })),
    ...(pessoa && !(TIPOS_DE_PESSOA as readonly string[]).includes(pessoa.tipo) ? [{ value: pessoa.tipo, label: rotuloDoTipoDePessoa(pessoa.tipo) }] : [])];

  return (
    <TopSheet
      titulo={pessoa ? "Editar pessoa" : "Nova pessoa"}
      onClose={onClose}
      footer={fechar => (
        <>
          {pessoa && (
            <button type="button" onClick={() => void salvar(fechar, { arquivada: !pessoa.arquivada })} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50">
              {pessoa.arquivada ? "Desarquivar" : "Arquivar"}
            </button>
          )}
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">
            {salvando ? "Salvando…" : pessoa ? "Salvar" : "Criar pessoa"}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <label className={ROTULO} htmlFor="pessoa-nome">Nome</label>
          <input id="pessoa-nome" autoFocus className={CAMPO} value={nome} onChange={event => setNome(event.target.value)} maxLength={200} disabled={salvando} />
        </div>
        <div>
          <label className={ROTULO} htmlFor="pessoa-artistico">Nome artístico (opcional)</label>
          <input id="pessoa-artistico" className={CAMPO} value={nomeArtistico} onChange={event => setNomeArtistico(event.target.value)} maxLength={200} disabled={salvando} />
        </div>
        <div>
          <span className={ROTULO}>Tipo</span>
          <Dropdown ariaLabel="Tipo da pessoa" value={tipo} onChange={setTipo} disabled={salvando} options={opcoesDeTipo} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={ROTULO} htmlFor="pessoa-email">E-mail (opcional)</label>
            <input id="pessoa-email" type="email" className={CAMPO} value={email} onChange={event => setEmail(event.target.value)} maxLength={254} disabled={salvando} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="pessoa-telefone">Telefone (opcional)</label>
            <input id="pessoa-telefone" type="tel" className={CAMPO} value={telefone} onChange={event => setTelefone(event.target.value)} maxLength={40} disabled={salvando} />
          </div>
        </div>
        {pessoa && !pessoa.arquivada && <AcessoDaFolha organizationId={organizationId} pessoaId={pessoa.id} email={pessoa.email} />}
        <p className="text-[0.6875rem] text-black/40">Documentos, banco e dados de saúde ainda não são cadastrados aqui.</p>
      </div>
    </TopSheet>
  );
}
