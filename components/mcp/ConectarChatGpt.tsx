"use client";

import type { StatusConexao } from "@/lib/mcp/conexoes";
import type { ModuloMcp } from "@/lib/mcp/modulos";
import { INSTRUCOES_PRESTACAO } from "@/lib/mcp/prestacao/instrucoes";
import { BotaoCopiar, CaixaCopiavel } from "@/components/mcp/BotaoCopiar";
import { ChaveManual } from "@/components/mcp/ChaveManual";
import { Detalhes } from "@/components/mcp/Detalhes";
import { ListaDeCliques, PassosConexao, type Verificacao } from "@/components/mcp/PassosConexao";
import { useCopiado } from "@/components/mcp/useCopiado";

const PLUGINS_DO_CHATGPT = "https://chatgpt.com/plugins";

interface Props {
  status: StatusConexao;
  verificacao: Verificacao;
  /** Endereço do site (ex.: https://jards.com.br); null enquanto ainda não foi lido. */
  origem: string | null;
  urlServidor: string | null;
  aoInteragir: () => void;
  aoCriarChave: () => Promise<void>;
  /** Módulos que a pessoa pode autorizar (a prestação de contas só aparece para quem a usa e está liberada). */
  modulosDisponiveis: readonly ModuloMcp[];
}

function CampoCopiavel({ rotulo, valor, id }: { rotulo: string; valor: string | null; id: string }) {
  const { copiado, copiar } = useCopiado();
  return (
    <div className="mt-2">
      <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/60">{rotulo}</p>
      <CaixaCopiavel
        texto={valor ?? ""}
        carregando={valor === null}
        copiado={copiado === id}
        rotulo={`Copiar ${rotulo}`}
        onCopiar={() => valor && void copiar(id, valor)}
      />
    </div>
  );
}

/** Texto comprido (as instruções da GPT) numa caixa que rola, com o botão Copiar. */
function TextoLongoCopiavel({ rotulo, valor, id }: { rotulo: string; valor: string; id: string }) {
  const { copiado, copiar } = useCopiado();
  return (
    <div className="mt-2">
      <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/60">{rotulo}</p>
      <textarea
        readOnly
        value={valor}
        rows={6}
        aria-label={rotulo}
        className="mt-2 w-full resize-y select-all rounded border border-black/10 bg-black/[0.02] px-3 py-2.5 text-[0.75rem] leading-relaxed text-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
      />
      <div className="mt-2">
        <BotaoCopiar copiado={copiado === id} onCopiar={() => void copiar(id, valor)} rotulo={`Copiar ${rotulo}`} />
      </div>
    </div>
  );
}

export function ConectarChatGpt({ status, verificacao, origem, urlServidor, aoInteragir, aoCriarChave, modulosDisponiveis }: Props) {
  const em = (caminho: string) => (origem ? `${origem}${caminho}` : null);
  const comPrestacao = modulosDisponiveis.includes("prestacao");

  return (
    <PassosConexao
      assistente="ChatGPT"
      status={status}
      verificacao={verificacao}
      urlServidor={urlServidor}
      abrirHref={PLUGINS_DO_CHATGPT}
      abrirRotulo="Abrir o ChatGPT"
      tituloAbrir="Adicione o Jards como servidor MCP"
      passoAbrir={
        <>
          <ListaDeCliques>
            <li>
              Clique no <strong>+</strong> e escolha <strong>Add custom MCP server</strong>.
            </li>
            <li>
              Nome: <strong>Jards</strong>, com uma descrição curta. Em <strong>Connection</strong>, escolha{" "}
              <strong>Public endpoint</strong> e cole o endereço.
            </li>
            <li>
              Em autenticação, escolha <strong>OAuth</strong>. Confirme o aviso (<strong>I understand and want to continue</strong>)
              e clique em <strong>Create as a plugin</strong>.
            </li>
          </ListaDeCliques>
          <p className="mt-3 text-xs text-black/60">
            Se a opção não aparecer, o seu plano do ChatGPT ou o administrador do workspace pode ter bloqueado servidores
            personalizados. Os nomes dos botões podem variar um pouco conforme o plano e o idioma.
          </p>
        </>
      }
      tituloConectar="Entre com a sua conta do Jards"
      passoConectar={
        <>
          <p>O ChatGPT abre a tela de login do Jards: entre e autorize.</p>
          <p className="mt-1 text-xs text-black/60">
            Por padrão o ChatGPT só lê. Para ele também criar registros (empresas, contatos, negociações, atividades e
            mais), marque a permissão extra na tela de autorização.
          </p>
        </>
      }
      tituloUsar="Peça algo ao ChatGPT"
      passoUsar={
        <p>
          Numa conversa nova, digite <strong>@</strong> e escolha <strong>Jards</strong> (pode ser preciso instalar o
          plugin antes). Depois peça, por exemplo: &ldquo;liste meus projetos em captação&rdquo;.
        </p>
      }
      aoInteragir={aoInteragir}
      mostrarModulos={comPrestacao}
    >
      <Detalhes titulo="Avançado: GPT personalizada (Actions)">
        <div>
          <p className="font-medium text-[#282525]">GPT do time, com o login de cada pessoa (OAuth)</p>
          <p className="mt-1">
            Uma única GPT compartilhada, em que cada pessoa autoriza com a própria conta do Jards, sem chave e sem herdar
            o acesso de outra pessoa. Quem cria a GPT configura uma vez:
          </p>
          <ol className="mt-3 list-decimal space-y-3 pl-5 marker:text-black/40">
            <li>
              Em Explorar GPTs → Criar → aba Configurar → Actions, clique em <strong>Criar nova ação</strong>.
            </li>
            <li>
              Importe o schema:
              <CampoCopiavel id="schema" rotulo="Endereço do schema" valor={em("/api/mcp/openapi.json")} />
            </li>
            <li>
              Em autenticação, escolha <strong>OAuth</strong> e preencha:
              <CampoCopiavel id="authorize" rotulo="Authorization URL" valor={em("/oauth/authorize")} />
              <CampoCopiavel id="token" rotulo="Token URL" valor={em("/api/mcp/oauth/token")} />
              <p className="mt-2 text-xs text-black/60">
                Client ID e Client Secret: os valores de OAUTH_CHATGPT_CLIENT_ID e OAUTH_CHATGPT_CLIENT_SECRET do
                ambiente. Scope: <code>read</code> ou <code>write</code>.
              </p>
            </li>
            <li>Ao usar a GPT pela primeira vez, cada pessoa autoriza com a própria conta na tela de consentimento.</li>
          </ol>
        </div>

        {comPrestacao && (
          <div className="border-t border-black/10 pt-4">
            <p className="font-medium text-[#282525]">GPT da prestação de contas, com arquivos pelo chat</p>
            <p className="mt-1">
              Uma segunda GPT, só da prestação: nela você anexa notas, recibos e fotos direto na conversa e o Jards
              recebe os arquivos. O que ela registrar fica anotado em &ldquo;Ações do assistente&rdquo;, e despesas e
              evidências entram como pendentes, para a equipe conferir. Cada pessoa autoriza com a própria conta, como na
              GPT acima.
            </p>
            <ol className="mt-3 list-decimal space-y-3 pl-5 marker:text-black/40">
              <li>
                Em Explorar GPTs → Criar → aba Configurar, cole estas instruções:
                <TextoLongoCopiavel id="instrucoes-prestacao" rotulo="Instruções da GPT" valor={INSTRUCOES_PRESTACAO} />
              </li>
              <li>
                Em Actions, clique em <strong>Criar nova ação</strong> e importe o schema da prestação:
                <CampoCopiavel id="schema-prestacao" rotulo="Endereço do schema" valor={em("/api/mcp/openapi.json?modulo=prestacao")} />
              </li>
              <li>
                Em autenticação, escolha <strong>OAuth</strong> com os mesmos Authorization URL, Token URL, Client ID e
                Client Secret da GPT acima. Scope: <code>read prestacao</code> para só consultar, ou{" "}
                <code>write prestacao</code> para também registrar despesas e evidências.
              </li>
              <li>Ao usar a GPT pela primeira vez, cada pessoa autoriza com a própria conta na tela de consentimento.</li>
            </ol>
          </div>
        )}

        <div className="border-t border-black/10 pt-4">
          <p className="font-medium text-[#282525]">GPT pessoal, com chave manual</p>
          <p className="mt-2 rounded border bg-white px-3 py-2 text-sm" style={{ borderColor: "#B07A1440", color: "#8a5f0f" }}>
            Gere uma chave manual só para uma GPT própria sem OAuth, e nunca compartilhe uma GPT configurada com a sua
            chave.
          </p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 marker:text-black/40">
            <li>Crie a sua própria GPT (não compartilhe) em Explorar GPTs → Criar, aba Configurar → Actions.</li>
            <li>Importe o mesmo schema de cima.</li>
            <li>
              Em autenticação, escolha <strong>API Key / Bearer</strong> e cole a chave gerada abaixo.
            </li>
          </ol>
          <div className="mt-4">
            <ChaveManual aoCriar={aoCriarChave} modulosDisponiveis={modulosDisponiveis} />
          </div>
        </div>
      </Detalhes>
    </PassosConexao>
  );
}
