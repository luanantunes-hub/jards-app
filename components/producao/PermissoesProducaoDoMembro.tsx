"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal } from "lucide-react";
import PermissoesProducaoModal from "@/components/modals/PermissoesProducaoModal";
import type { ModuloId } from "@/lib/modulos";
import {
  ofertaDePermissoes,
  resumoDasPermissoes,
  type FuncaoNaProducao,
  type MembroParaPermissoes,
} from "@/lib/producao/permissoes";

/**
 * "Permissões da produção" na linha do membro, em Configurações → Equipe (PD0.7b):
 * o botão que abre o modal, com o resumo do que a pessoa tem hoje ao lado. Só o
 * administrador a vê, para colaborador e leitor que usam a produção numa
 * organização que a tem (ofertaDePermissoes); em qualquer outro caso não desenha
 * nada, e a linha fica como era.
 */
export function PermissoesProducaoDoMembro({ organizationId, membro, souAdmin, modulosDaOrganizacao, funcao, onSaved }: {
  organizationId: string | null;
  membro: MembroParaPermissoes;
  souAdmin: boolean;
  /** Módulos em vigor na organização. */
  modulosDaOrganizacao: readonly ModuloId[];
  /** O que a pessoa tem hoje; null = sem registro; undefined = a leitura não terminou (a edição espera). */
  funcao: FuncaoNaProducao | null | undefined;
  onSaved: (funcao: FuncaoNaProducao) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const oferta = ofertaDePermissoes({ souAdmin, modulosDaOrganizacao, membro });
  if (!oferta || !organizationId) return null;

  const resumo = resumoDasPermissoes(funcao, oferta.alcada);

  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <button
          ref={botao}
          type="button"
          disabled={funcao === undefined}
          onClick={() => setAberto(true)}
          className="inline-flex items-center gap-1.5 rounded border border-black/10 bg-white px-2 py-1.5 text-left text-[0.625rem] font-medium leading-snug text-black/60 transition hover:bg-black/[.04] hover:text-black/80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:cursor-wait disabled:opacity-50"
        >
          {/* A coluna do nome é estreita no celular: o rótulo quebra de linha como o das etiquetas de módulo, e o ícone não encolhe. */}
          <SlidersHorizontal size={10} className="shrink-0" aria-hidden="true" />
          Permissões da produção
        </button>
        {resumo && <span className="text-[0.625rem] text-black/45">{resumo}</span>}
      </div>
      {aberto && funcao !== undefined && createPortal(
        <PermissoesProducaoModal
          organizationId={organizationId}
          membro={membro}
          atual={funcao}
          comAlcada={oferta.alcada}
          // Fechar devolve o foco ao botão que abriu o modal (quem navega pelo teclado não perde o lugar).
          onClose={() => { setAberto(false); botao.current?.focus(); }}
          onSaved={onSaved}
        />,
        document.body,
      )}
    </>
  );
}
