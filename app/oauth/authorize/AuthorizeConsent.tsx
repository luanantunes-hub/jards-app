"use client";

import { useState } from "react";

interface Props {
  email: string;
  organizacoes: string[];
  scope: "read" | "write";
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

export function AuthorizeConsent({
  email,
  organizacoes,
  scope,
  clientId,
  redirectUri,
  state,
  codeChallenge,
  codeChallengeMethod,
}: Props) {
  const [enviando, setEnviando] = useState<"allow" | "deny" | null>(null);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <div className="w-full rounded border border-black/10 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight">Autorizar acesso ao Jards</h1>
        <p className="mt-2 text-sm text-black/60">
          Um assistente do ChatGPT está pedindo permissão para acessar os dados do Jards usando a sua conta (
          <span className="font-medium text-black">{email}</span>).
        </p>

        <div className="mt-4 rounded border border-black/10 bg-black/[0.02] p-3 text-sm">
          <p className="font-medium text-black">Vai poder:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-black/70">
            <li>Ler projetos, propostas, tarefas, empresas e contatos das suas organizações</li>
            {scope === "write" && <li>Criar contatos e tarefas</li>}
            {scope === "write" && <li>Desbloquear contatos de empresas (consome créditos da organização)</li>}
          </ul>
          {organizacoes.length > 0 && (
            <p className="mt-2 text-xs text-black/50">Organizações: {organizacoes.join(", ")}</p>
          )}
        </div>

        <p className="mt-3 text-xs text-black/50">
          Os dados pedidos em cada pergunta são enviados aos servidores da OpenAI para gerar a resposta — inclui
          dados de terceiros quando o escopo permite contatos. Saiba mais na{" "}
          <a href="/privacidade#s3" className="text-[#7259B5] hover:underline">política de privacidade</a>.
        </p>
        <p className="mt-2 text-xs text-black/50">
          Você pode revogar esse acesso a qualquer momento em Configurações → Acesso por API.
        </p>

        <form
          method="POST"
          action="/api/mcp/oauth/consent"
          className="mt-5 flex gap-2"
          onSubmit={(e) => setEnviando((e.nativeEvent as SubmitEvent).submitter?.getAttribute("name") === "deny" ? "deny" : "allow")}
        >
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="scope" value={scope} />
          {codeChallenge && <input type="hidden" name="code_challenge" value={codeChallenge} />}
          {codeChallengeMethod && <input type="hidden" name="code_challenge_method" value={codeChallengeMethod} />}

          <button
            type="submit"
            name="deny"
            value="1"
            disabled={enviando !== null}
            className="flex-1 rounded border border-black/15 bg-white px-4 py-2.5 text-sm text-black/70 hover:bg-black/5 disabled:opacity-50"
          >
            Negar
          </button>
          <button
            type="submit"
            name="allow"
            value="1"
            disabled={enviando !== null}
            className="flex-1 rounded bg-[#2E8932] px-4 py-2.5 text-sm text-white hover:bg-[#26752A] disabled:opacity-50"
          >
            {enviando === "allow" ? "Autorizando…" : "Permitir"}
          </button>
        </form>
      </div>
    </div>
  );
}
