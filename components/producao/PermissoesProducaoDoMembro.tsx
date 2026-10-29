"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal } from "lucide-react";
import PermissoesProducaoModal from "@/components/modals/PermissoesProducaoModal";
import type { ModuloId } from "@/lib/modulos";
import {
  lerParaEditar,
  MENSAGEM_LEITURA_DAS_PERMISSOES,
  ofertaDePermissoes,
  resumoDasPermissoes,
  type FuncaoNaProducao,
  type FuncoesPorPessoa,
  type MembroParaPermissoes,
} from "@/lib/producao/permissoes";

/**
 * "Permissões da produção" na linha do membro, em Configurações → Equipe (PD0.7b):
 * o botão que abre o modal, com o resumo do que a pessoa tem hoje ao lado. Só o
 * administrador a vê, para colaborador e leitor que usam a produção numa
 * organização que a tem (ofertaDePermissoes); em qualquer outro caso não desenha
 * nada, e a linha fica como era.
 *
 * O resumo vem do que a página já leu, mas o modal abre com uma leitura nova
 * (lerParaEditar): enquanto ela não volta o botão espera, e se falhar o modal não
 * abre e a pessoa pode tentar de novo. Assim nunca se salva em cima de um valor
 * velho nem por cima de uma função que não se conseguiu ler.
 */
export function PermissoesProducaoDoMembro({ organizationId, membro, souAdmin, modulosDaOrganizacao, funcao, recarregar, onSaved }: {
  organizationId: string | null;
  membro: MembroParaPermissoes;
  souAdmin: boolean;
  /** Módulos em vigor na organização. */
  modulosDaOrganizacao: readonly ModuloId[];
  /** O que a página sabe da pessoa, só para o resumo; null = sem registro (ou ainda sem leitura). */
  funcao: FuncaoNaProducao | null;
  /** Lê de novo as funções da organização; devolve null quando a leitura falha. */
  recarregar: () => Promise<FuncoesPorPessoa | null>;
  onSaved: (funcao: FuncaoNaProducao) => void;
}) {
  const [aberta, setAberta] = useState<{ atual: FuncaoNaProducao | null } | null>(null);
  const [lendo, setLendo] = useState(false);
  const [leituraFalhou, setLeituraFalhou] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const oferta = ofertaDePermissoes({ souAdmin, modulosDaOrganizacao, membro });
  if (!oferta || !organizationId) return null;

  const resumo = resumoDasPermissoes(funcao, oferta.alcada);

  async function abrir() {
    if (lendo) return;
    setLendo(true);
    setLeituraFalhou(false);
    const leitura = await lerParaEditar(recarregar, membro.user_id);
    setLendo(false);
    if (!leitura.ok) {
      setLeituraFalhou(true);
      return;
    }
    setAberta({ atual: leitura.atual });
  }

  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <button
          ref={botao}
          type="button"
          // O rótulo visível continua o começo do nome; o nome da pessoa distingue um botão do outro para quem navega por leitor de tela.
          aria-label={`Permissões da produção de ${membro.full_name || membro.email || "membro"}`}
          aria-busy={lendo}
          disabled={lendo}
          onClick={() => void abrir()}
          className="inline-flex items-center gap-1.5 rounded border border-black/10 bg-white px-2 py-1.5 text-left text-[0.625rem] font-medium leading-snug text-black/60 transition hover:bg-black/[.04] hover:text-black/80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:cursor-wait disabled:opacity-50"
        >
          {/* A coluna do nome é estreita no celular: o rótulo quebra de linha como o das etiquetas de módulo, e o ícone não encolhe. */}
          <SlidersHorizontal size={10} className="shrink-0" aria-hidden="true" />
          Permissões da produção
        </button>
        {leituraFalhou
          ? <span role="alert" className="text-[0.625rem] font-medium text-[#D94E4E]">{MENSAGEM_LEITURA_DAS_PERMISSOES}</span>
          : resumo && <span className="text-[0.625rem] text-black/45">{resumo}</span>}
      </div>
      {aberta && createPortal(
        <PermissoesProducaoModal
          organizationId={organizationId}
          membro={membro}
          atual={aberta.atual}
          comAlcada={oferta.alcada}
          // Fechar devolve o foco ao botão que abriu o modal (quem navega pelo teclado não perde o lugar).
          onClose={() => { setAberta(null); botao.current?.focus(); }}
          onSaved={onSaved}
        />,
        document.body,
      )}
    </>
  );
}
