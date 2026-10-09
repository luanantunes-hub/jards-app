"use client";

import type { StatusConexao } from "@/lib/mcp/conexoes";
import { CaixaCopiavel } from "@/components/mcp/BotaoCopiar";
import { Detalhes } from "@/components/mcp/Detalhes";
import { ListaDeCliques, PassosConexao, type Verificacao } from "@/components/mcp/PassosConexao";
import { useCopiado } from "@/components/mcp/useCopiado";

const CONECTORES_DO_CLAUDE = "https://claude.ai/customize/connectors";
const CONECTORES_DA_ORGANIZACAO = "https://claude.ai/admin-settings/connectors";

interface Props {
  status: StatusConexao;
  verificacao: Verificacao;
  urlServidor: string | null;
  aoInteragir: () => void;
}

export function ConectarClaude({ status, verificacao, urlServidor, aoInteragir }: Props) {
  const { copiado, copiar } = useCopiado();
  const comandoClaudeCode = urlServidor ? `claude mcp add --transport http jards ${urlServidor}` : "";

  return (
    <PassosConexao
      assistente="Claude"
      status={status}
      verificacao={verificacao}
      urlServidor={urlServidor}
      abrirHref={CONECTORES_DO_CLAUDE}
      abrirRotulo="Abrir o Claude"
      tituloAbrir="Adicione o Jards como conector"
      passoAbrir={
        <ListaDeCliques>
          <li>
            Clique em <strong>+ Add</strong> e escolha <strong>Add custom connector</strong>.
          </li>
          <li>
            Nome: <strong>Jards</strong>. Endereço: cole o que você copiou.
          </li>
          <li>
            Avance com <strong>Continue</strong>, sem mudar nada, e finalize em <strong>Add</strong>.
          </li>
        </ListaDeCliques>
      }
      tituloConectar="Entre com a sua conta do Jards"
      passoConectar={
        <>
          <p>
            O Claude abre a tela de login do Jards: entre e autorize. Se ele só mostrar o Jards na lista, clique em{" "}
            <strong>Connect</strong>.
          </p>
          <p className="mt-1 text-xs text-black/60">
            Por padrão o Claude só lê. Para ele também criar registros (empresas, contatos, negociações, atividades e
            mais), marque a permissão extra na tela de autorização.
          </p>
        </>
      }
      tituloUsar="Peça algo ao Claude"
      passoUsar={
        <p>
          Numa conversa nova, clique no <strong>+</strong> do chat, abra <strong>Connectors</strong> e ative o{" "}
          <strong>Jards</strong>. Depois peça, por exemplo: &ldquo;liste meus projetos em captação&rdquo;.
        </p>
      }
      aoInteragir={aoInteragir}
    >
      <Detalhes titulo="Claude Code e contas de empresa">
        <div>
          <p className="font-medium text-[#282525]">No Claude Code</p>
          <CaixaCopiavel
            texto={comandoClaudeCode}
            carregando={!urlServidor}
            copiado={copiado === "cmd"}
            rotulo="Copiar o comando do Claude Code"
            onCopiar={() => {
              void copiar("cmd", comandoClaudeCode);
              aoInteragir();
            }}
          />
          <p className="mt-2">
            Depois, no Claude Code, rode <code className="text-xs">/mcp</code>, escolha <strong>jards</strong> e autorize.
          </p>
        </div>
        <div className="border-t border-black/10 pt-4">
          <p className="font-medium text-[#282525]">Claude Team ou Enterprise</p>
          <p className="mt-1">
            Quem é Owner adiciona o conector uma vez, em{" "}
            <a
              href={CONECTORES_DA_ORGANIZACAO}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-[#282525] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
            >
              Organization settings → Connectors
            </a>
            : <strong>Add</strong> → <strong>Custom</strong> → <strong>Web</strong>, com o mesmo nome e endereço. Se
            pedir como o Claude se identifica, use <strong>Register automatically</strong>. Depois, cada pessoa só
            clica em <strong>Connect</strong> em Customize → Connectors e entra com a própria conta do Jards.
          </p>
        </div>
      </Detalhes>
    </PassosConexao>
  );
}
