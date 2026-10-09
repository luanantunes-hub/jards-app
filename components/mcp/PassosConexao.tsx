"use client";

import type { ReactNode } from "react";
import { Check, Circle, ExternalLink } from "lucide-react";
import type { StatusConexao } from "@/lib/mcp/conexoes";
import { CaixaCopiavel } from "@/components/mcp/BotaoCopiar";
import { useCopiado } from "@/components/mcp/useCopiado";

/** Como está a conferência das conexões: carregando a primeira vez, tudo certo ou falhou. */
export type Verificacao = "carregando" | "ok" | "erro";

function NumeroDoPasso({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border border-black/15 text-[0.6875rem] font-medium tabular-nums text-black/60">
      {n}
    </span>
  );
}

/** Estados sem conexão ficam como uma linha quieta; só a conexão feita ganha a caixa verde. */
function LinhaNeutra({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm text-black/60">
      <Circle size={10} className="flex-shrink-0 text-black/30" aria-hidden="true" />
      {children}
    </p>
  );
}

function StatusDaConexao({ assistente, status, verificacao }: { assistente: string; status: StatusConexao; verificacao: Verificacao }) {
  let conteudo: ReactNode;
  if (status.conectado) {
    const quando = status.ultimaAtividade ? new Date(status.ultimaAtividade).toLocaleDateString("pt-BR") : null;
    conteudo = (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border bg-white px-3 py-2 text-sm" style={{ borderColor: "#2E893247", color: "#26752A" }}>
        <Check size={14} className="flex-shrink-0 text-[#2E8932]" aria-hidden="true" />
        <span className="font-medium">{assistente} conectado</span>
        <span className="text-black/60">
          {quando ? `· atividade em ${quando} ` : ""}· {status.escrita ? "leitura e criação" : "somente leitura"}
        </span>
      </p>
    );
  } else if (verificacao === "carregando") {
    conteudo = <LinhaNeutra>Verificando a conexão…</LinhaNeutra>;
  } else if (verificacao === "erro") {
    conteudo = <LinhaNeutra>Não foi possível verificar se o {assistente} já está conectado. Os passos abaixo continuam valendo.</LinhaNeutra>;
  } else {
    conteudo = <LinhaNeutra>O {assistente} ainda não está conectado ao Jards.</LinhaNeutra>;
  }
  // A região fica sempre montada: quando a conexão acontece, o leitor de tela anuncia a troca do texto.
  return (
    <div role="status" aria-live="polite">
      {conteudo}
    </div>
  );
}

/** Lista curta do que clicar no assistente, na ordem em que aparece. */
export function ListaDeCliques({ children }: { children: ReactNode }) {
  return <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-black/70 marker:text-black/30">{children}</ul>;
}

interface Props {
  assistente: string;
  status: StatusConexao;
  verificacao: Verificacao;
  /** Endereço que se cola no assistente; null enquanto o endereço do site ainda não foi lido. */
  urlServidor: string | null;
  /** Página do assistente onde se adiciona o conector (abre em nova aba). */
  abrirHref: string;
  abrirRotulo: string;
  tituloAbrir: string;
  passoAbrir: ReactNode;
  tituloConectar: string;
  passoConectar: ReactNode;
  tituloUsar: string;
  passoUsar: ReactNode;
  /** Chamado quando a pessoa age (copia, abre): a tela passa a conferir se a conexão já aconteceu. */
  aoInteragir: () => void;
  children?: ReactNode;
}

/**
 * Os passos para conectar um assistente ao Jards: copiar o endereço, abrir o assistente (o clique já
 * deixa o endereço copiado), autorizar e usar. É o mesmo desenho para o Claude e para o ChatGPT.
 */
export function PassosConexao({
  assistente,
  status,
  verificacao,
  urlServidor,
  abrirHref,
  abrirRotulo,
  tituloAbrir,
  passoAbrir,
  tituloConectar,
  passoConectar,
  tituloUsar,
  passoUsar,
  aoInteragir,
  children,
}: Props) {
  const { copiado, copiar } = useCopiado();

  return (
    <div className="space-y-5">
      <StatusDaConexao assistente={assistente} status={status} verificacao={verificacao} />

      <ol className="space-y-5">
        <li className="flex gap-3">
          <NumeroDoPasso n={1} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#282525]">Copie o endereço do Jards</p>
            <CaixaCopiavel
              texto={urlServidor ?? ""}
              carregando={urlServidor === null}
              copiado={copiado === "url"}
              rotulo={`Copiar o endereço do Jards para colar no ${assistente}`}
              onCopiar={() => {
                if (urlServidor) void copiar("url", urlServidor);
                aoInteragir();
              }}
            />
          </div>
        </li>

        <li className="flex gap-3">
          <NumeroDoPasso n={2} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#282525]">{tituloAbrir}</p>
            <a
              href={abrirHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (urlServidor) void copiar("url", urlServidor);
                aoInteragir();
              }}
              className="mt-2 inline-flex h-11 items-center gap-2 rounded bg-[#282525] px-4 text-sm text-white transition hover:bg-[#3A3535] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98]"
            >
              {abrirRotulo}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
            <p className="mt-2 text-xs text-black/60">Ao clicar, o endereço do passo 1 já fica copiado: é só colar lá.</p>
            {passoAbrir}
          </div>
        </li>

        <li className="flex gap-3">
          <NumeroDoPasso n={3} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#282525]">{tituloConectar}</p>
            <div className="mt-1 text-sm text-black/70">{passoConectar}</div>
          </div>
        </li>

        <li className="flex gap-3">
          <NumeroDoPasso n={4} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#282525]">{tituloUsar}</p>
            <div className="mt-1 text-sm text-black/70">{passoUsar}</div>
          </div>
        </li>
      </ol>

      {children}
    </div>
  );
}
