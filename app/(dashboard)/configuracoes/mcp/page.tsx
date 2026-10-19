"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCreditos } from "@/contexts/CreditosContext";
import { useOrganizationRole } from "@/contexts/OrganizationContext";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { AcessoContatosModal } from "@/components/modals/AcessoContatosModal";
import { ClaudeMark, OpenAIMark } from "@/components/icons/AiLogos";
import { ehConexaoOAuth, type Assistente, type ChaveMcp } from "@/lib/mcp/conexoes";
import { AbasAssistente, idDaAba, idDoPainel } from "@/components/mcp/AbasAssistente";
import { ConectarChatGpt } from "@/components/mcp/ConectarChatGpt";
import { ConectarClaude } from "@/components/mcp/ConectarClaude";
import { ConexoesAtivas, nomeDaConexao } from "@/components/mcp/ConexoesAtivas";
import { useConexoesMcp } from "@/components/mcp/useConexoesMcp";

function assistenteDaUrl(): Assistente | null {
  const valor = new URLSearchParams(window.location.search).get("assistente");
  return valor === "claude" || valor === "chatgpt" ? valor : null;
}

export default function ConfiguracoesMcpPage() {
  const router = useRouter();
  const { confirmDelete } = useDeleteConfirm();
  const { assinatura, loading: loadingAssinatura } = useCreditos();
  const papel = useOrganizationRole();
  const [assistente, setAssistente] = useState<Assistente>("claude");
  const [origem, setOrigem] = useState<string | null>(null);
  const { chaves, status, verificacao, carregar, aguardarConexao } = useConexoesMcp(assistente);

  useEffect(() => {
    setOrigem(window.location.origin); // eslint-disable-line react-hooks/set-state-in-effect
    const daUrl = assistenteDaUrl();
    if (daUrl) setAssistente(daUrl);
  }, []);

  function trocarAssistente(proximo: Assistente) {
    setAssistente(proximo);
    const url = new URL(window.location.href);
    url.searchParams.set("assistente", proximo);
    window.history.replaceState(null, "", url);
  }

  function revogar(chave: ChaveMcp) {
    const conexao = ehConexaoOAuth(chave.label);
    confirmDelete({
      title: conexao ? `Desconectar ${nomeDaConexao(chave)}?` : "Revogar esta chave?",
      description: conexao
        ? "Esse assistente perde o acesso ao Jards imediatamente. Para voltar a usar, é só conectar de novo pelos passos acima."
        : "Assistentes que usam esta chave perdem o acesso ao Jards imediatamente. Esta ação não pode ser desfeita.",
      confirmLabel: conexao ? "Desconectar" : "Revogar",
      pendingLabel: conexao ? "Desconectando…" : "Revogando…",
      illustration: false,
      onConfirm: async () => {
        const res = await fetch(`/api/mcp/keys?id=${encodeURIComponent(chave.id)}`, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? (conexao ? "Não foi possível desconectar. Tente novamente." : "Não foi possível revogar a chave. Tente novamente."));
        }
        await carregar();
      },
    });
  }

  const urlServidor = origem ? `${origem}/api/mcp/server` : null;

  if (loadingAssinatura) return null;

  // Organização paga, mas o conector é de quem a administra (o servidor nega aos demais).
  if (assinatura?.ativa && papel !== "admin") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link href="/configuracoes" className="mb-6 inline-flex items-center gap-2 text-[0.75rem] font-medium text-black/50 transition hover:text-black/70">
          <ArrowLeft size={14} aria-hidden="true" /> Configurações
        </Link>
        <p className="text-[0.8125rem] text-black/55">A conexão com o Claude e o ChatGPT é de quem administra a organização.</p>
      </div>
    );
  }

  if (!assinatura?.ativa) {
    return (
      <AcessoContatosModal
        variant="mcp_gpt"
        onClose={() => router.push("/configuracoes?section=ferramentas")}
        onPrimary={() => router.push("/meu-plano?acao=assinar")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/configuracoes" className="mb-6 inline-flex items-center gap-2 text-[0.75rem] font-medium text-black/50 transition hover:text-black/70">
        <ArrowLeft size={14} aria-hidden="true" /> Configurações
      </Link>
      <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <span className="flex h-7 w-7 items-center justify-center rounded border border-black/15 bg-white">
          <ClaudeMark size={15} />
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded border border-black/15 bg-white">
          <OpenAIMark size={14} />
        </span>
        Claude e ChatGPT (MCP)
      </h1>
      <p className="mt-2 text-sm text-black/60">
        Conecte um assistente de IA aos dados do Jards. Ele só acessa as organizações de que você é membro, o mesmo
        que você já vê logado no Jards, e cada pessoa conecta com a própria conta.
      </p>

      <div className="mt-8">
        <AbasAssistente
          ativa={assistente}
          conectados={{ claude: status.claude.conectado, chatgpt: status.chatgpt.conectado }}
          onChange={trocarAssistente}
        />
        <div
          role="tabpanel"
          id={idDoPainel(assistente)}
          aria-labelledby={idDaAba(assistente)}
          className="mt-3 rounded border border-black/10 bg-white p-5"
        >
          {assistente === "claude" ? (
            <ConectarClaude status={status.claude} verificacao={verificacao} urlServidor={urlServidor} aoInteragir={aguardarConexao} />
          ) : (
            <ConectarChatGpt
              status={status.chatgpt}
              verificacao={verificacao}
              origem={origem}
              urlServidor={urlServidor}
              aoInteragir={aguardarConexao}
              aoCriarChave={carregar}
            />
          )}
        </div>
      </div>

      <ConexoesAtivas chaves={chaves} verificacao={verificacao} onRevogar={revogar} onTentarDeNovo={() => void carregar()} />
    </div>
  );
}
