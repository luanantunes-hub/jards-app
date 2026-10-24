"use client";

import type { StatusConexao } from "@/lib/mcp/conexoes";
import type { ModuloMcp } from "@/lib/mcp/modulos";
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
  /** Módulos que a pessoa pode autorizar (a prestação de contas só aparece para quem a usa e está liberada). */
  modulosDisponiveis: readonly ModuloMcp[];
}

export function ConectarClaude({ status, verificacao, urlServidor, aoInteragir, modulosDisponiveis }: Props) {
  const { copiado, copiar } = useCopiado();
  const comandoClaudeCode = urlServidor ? `claude mcp add --transport http jards ${urlServidor}` : "";
  const comPrestacao = modulosDisponiveis.includes("prestacao");
  const conexaoSemPrestacao = comPrestacao && status.conectado && !status.modulos.includes("prestacao");

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
          {comPrestacao && (
            <p className="mt-1 text-xs text-black/60">
              Para o Claude cuidar também das prestações de contas, marque <strong>Prestação de contas</strong> na mesma
              tela. Tudo o que ele registrar lá fica anotado em &ldquo;Ações do assistente&rdquo;, e despesas e evidências
              entram como pendentes, para a equipe conferir.
            </p>
          )}
        </>
      }
      tituloUsar="Peça algo ao Claude"
      passoUsar={
        <p>
          Numa conversa nova, clique no <strong>+</strong> do chat, abra <strong>Connectors</strong> e ative o{" "}
          <strong>Jards</strong>. Depois peça, por exemplo: &ldquo;liste meus projetos em captação&rdquo;
          {comPrestacao ? <>, ou &ldquo;o que falta para enviar a prestação do meu projeto?&rdquo;</> : null}.
        </p>
      }
      aoInteragir={aoInteragir}
      mostrarModulos={comPrestacao}
      aviso={
        conexaoSemPrestacao ? (
          <p className="rounded border bg-white px-3 py-2 text-sm" style={{ borderColor: "#B07A1440", color: "#8a5f0f" }}>
            Esta conexão ainda não inclui a prestação de contas. Para incluir, desconecte o Claude em &ldquo;Conexões
            ativas&rdquo;, conecte de novo e marque <strong>Prestação de contas</strong> na tela de autorização.
          </p>
        ) : null
      }
    >
      {comPrestacao && (
        <Detalhes titulo="Mandar notas, recibos e fotos para a prestação">
          <p>
            O Claude não passa os anexos da conversa para o Jards. Quando você pedir para registrar uma nota ou uma foto,
            ele escolhe o caminho:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 marker:text-black/30">
            <li>
              <strong>XML da nota fiscal:</strong> cole o texto na conversa. O Claude lê e registra.
            </li>
            <li>
              <strong>PDF ou foto:</strong> ele dá um link do Jards. Abra no computador ou no celular, escolha os
              arquivos (ou tire a foto) e envie. O Jards confere cada arquivo na hora.
            </li>
            <li>
              <strong>Claude Code ou ambiente de código:</strong> ele envia os arquivos direto, sem você abrir nada.
            </li>
          </ul>
          <p>As despesas e evidências chegam como pendentes e aparecem com o selo &ldquo;Enviada pelo assistente&rdquo;.</p>
        </Detalhes>
      )}
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
