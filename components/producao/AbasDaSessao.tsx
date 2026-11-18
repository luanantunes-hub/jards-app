import Link from "next/link";

/** As telas que trabalham por sessão, na ordem do dia: preparar a sala, convidar, garantir a acessibilidade, abrir a porta e fechar o borderô. */
export const TELAS_DA_SESSAO = [
  { id: "plateia", rotulo: "Plateia", href: "/producoes/plateia" },
  { id: "convidados", rotulo: "Convidados", href: "/producoes/convidados" },
  { id: "acessibilidade", rotulo: "Acessibilidade", href: "/producoes/acessibilidade" },
  { id: "porta", rotulo: "Porta", href: "/producoes/porta" },
  { id: "bordero", rotulo: "Borderô", href: "/producoes/bordero" },
] as const;

export type TelaDaSessao = (typeof TELAS_DA_SESSAO)[number]["id"];

/**
 * A barra que une as telas da sessão. Cada uma segue com o seu endereço (a porta precisa do dela: a câmera só é liberada em /producoes/porta);
 * a sessão escolhida fica lembrada ao trocar de aba (ver SeletorDeSessao).
 */
export function AbasDaSessao({ ativa }: { ativa: TelaDaSessao }) {
  return (
    <nav aria-label="Telas da sessão" className="-mx-1 mt-5 flex items-center gap-1 overflow-x-auto px-1 pb-1">
      {TELAS_DA_SESSAO.map(tela => {
        const marcada = tela.id === ativa;
        return (
          <Link
            key={tela.id}
            href={tela.href}
            prefetch={false}
            aria-current={marcada ? "page" : undefined}
            className={`flex h-9 shrink-0 items-center rounded border px-3.5 text-[0.75rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] ${
              marcada ? "border-[#1C0E33] bg-[#1C0E33] text-white" : "border-black/12 bg-white text-black/60 hover:bg-black/[.04]"
            }`}
          >
            {tela.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
