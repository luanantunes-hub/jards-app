import Link from "next/link";
import type { ReactNode } from "react";
import { ProjectIdentity, type IdentityType } from "@/components/ui/ProjectIdentity";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";

/** Campos do projeto que o resumo usa; o que faltar não aparece. */
export type ProjetoResumoDados = {
  nome: string;
  descricao?: string | null;
  proponente_nome?: string | null;
  proponente_cidade?: string | null;
  proponente_estado?: string | null;
  valor_alvo?: number | null;
  identidade_tipo?: IdentityType | null;
  identidade_valor?: string | null;
  identidade_logo_url?: string | null;
  identidade_cor?: string | null;
};

function texto(valor: string | null | undefined) {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

/**
 * Projeto da negociação ou da inscrição, no mesmo idioma da barra de
 * informações da página: rótulo cinza e valor em tinta, sem ícone decorativo.
 */
export function ProjetoResumo({ projetoId, projeto }: { projetoId: string | null; projeto: ProjetoResumoDados }) {
  const descricao = texto(projeto.descricao);
  const proponente = texto(projeto.proponente_nome);
  const local = [texto(projeto.proponente_cidade), texto(projeto.proponente_estado)].filter(Boolean).join(", ");
  const meta = projeto.valor_alvo != null && Number.isFinite(Number(projeto.valor_alvo)) && Number(projeto.valor_alvo) > 0 ? Number(projeto.valor_alvo) : null;

  const conteudo: ReactNode = (
    <>
      <div className="flex items-center gap-3">
        <ProjectIdentity
          nome={projeto.nome}
          tipo={projeto.identidade_tipo}
          valor={projeto.identidade_valor}
          logoUrl={projeto.identidade_logo_url}
          cor={projeto.identidade_cor}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-semibold text-[#0D0D0D]">{projeto.nome}</p>
          {descricao && <p className="mt-0.5 line-clamp-2 text-[0.75rem] text-black/45">{descricao}</p>}
        </div>
      </div>

      {(proponente || meta != null) && (
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-black/[.06] pt-4 sm:grid-cols-3">
          {proponente && (
            <div className="min-w-0">
              <dt className="mb-0.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Proponente</dt>
              <dd className="break-words text-[0.8125rem] font-medium text-[#0D0D0D]">{proponente}</dd>
              {local && <dd className="text-[0.6875rem] text-black/40">{local}</dd>}
            </div>
          )}
          {meta != null && (
            <div className="min-w-0">
              <dt className="mb-0.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Meta de captação</dt>
              <dd title={formatarValorCompleto(meta)} className="text-[0.8125rem] font-semibold tabular-nums text-[#0D0D0D]">{formatarValorCurto(meta)}</dd>
            </div>
          )}
        </dl>
      )}
    </>
  );

  const superficie = "block rounded border border-black/[.08] bg-white p-4 sm:p-5";
  if (!projetoId) return <div className={superficie}>{conteudo}</div>;
  return (
    <Link
      href={`/projetos/${projetoId}`}
      className={`${superficie} transition-colors duration-200 hover:border-black/[.16] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] motion-reduce:transition-none`}
    >
      {conteudo}
    </Link>
  );
}
