"use client";

import { useEffect, useState } from "react";
import { CAMPO_MODULOS_ESCOLHIDOS, campoDoModulo } from "@/lib/mcp/consentimento";
import type { ModuloMcp } from "@/lib/mcp/modulos";

export type ClienteConsentimento =
  | { tipo: "chatgpt" }
  | { tipo: "publico"; nome: string; provedor: string };

interface Props {
  email: string;
  organizacoes: string[];
  scope: "read" | "write";
  /** O scope como o assistente pediu (ex.: "write prestacao"): volta no formulário do ChatGPT, que decide os módulos por ele. */
  scopeDoPedido: string;
  /** Módulos que esta pessoa pode liberar agora (no ChatGPT, os que a Action pediu e ela pode liberar). */
  modulosDisponiveis: ModuloMcp[];
  /** Os que já vêm marcados na tela do Claude. */
  modulosMarcados: ModuloMcp[];
  cliente: ClienteConsentimento;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  resource?: string;
}

const MODULOS: Record<ModuloMcp, { nome: string; descricao: string; ler: string; gravar: string; gravarCurto: string }> = {
  captacao: {
    nome: "CRM de captação",
    descricao: "empresas, contatos, negociações, projetos, atividades e propostas",
    ler: "Ler o CRM das suas organizações: empresas, contatos, negociações, projetos, atividades, propostas e mais",
    gravar: "Criar registros no CRM: empresas, contatos, negociações, projetos, atividades, notas e follow-ups",
    gravarCurto: "no CRM: empresas, contatos, negociações, atividades, notas e mais",
  },
  prestacao: {
    nome: "Prestação de contas",
    descricao: "as prestações das organizações em que você usa o módulo: status, prazos, despesas e orçamento",
    ler: "Ler as prestações de contas das suas organizações: status, regime, prazos, pendências, despesas, orçamento, objeto e relatório",
    gravar: "Receber os arquivos que você enviar pelo chat e registrar despesas e evidências como pendentes, para a equipe conferir; lançar atividades, resultados das metas e textos do relatório do objeto",
    gravarCurto: "na prestação de contas: registrar despesas e evidências pendentes, lançar atividades, metas e relatório, e rodar a verificação",
  },
};

export function AuthorizeConsent({
  email,
  organizacoes,
  scope,
  scopeDoPedido,
  modulosDisponiveis,
  modulosMarcados,
  cliente,
  clientId,
  redirectUri,
  state,
  codeChallenge,
  codeChallengeMethod,
  resource,
}: Props) {
  const [enviando, setEnviando] = useState<"allow" | "deny" | null>(null);
  const [marcados, setMarcados] = useState<ModuloMcp[]>(modulosMarcados);
  const [escrita, setEscrita] = useState(false);
  const publico = cliente.tipo === "publico";
  // No ChatGPT a Action já decidiu os módulos e o escopo: a pessoa só permite ou nega.
  const modulos = publico ? modulosDisponiveis.filter((modulo) => marcados.includes(modulo)) : modulosDisponiveis;
  const gravar = publico ? escrita : scope === "write";
  const escolhaLivre = publico && modulosDisponiveis.length > 1;
  const semModulo = modulos.length === 0;

  // Voltar a esta tela pelo botão do navegador traz a página do cache; sem isto os botões ficariam travados em "Autorizando…".
  useEffect(() => {
    const destravar = (e: PageTransitionEvent) => {
      if (e.persisted) setEnviando(null);
    };
    window.addEventListener("pageshow", destravar);
    return () => window.removeEventListener("pageshow", destravar);
  }, []);

  const alternar = (modulo: ModuloMcp) =>
    setMarcados((atuais) => (atuais.includes(modulo) ? atuais.filter((m) => m !== modulo) : [...atuais, modulo]));

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <div className="w-full rounded border border-black/10 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight">Autorizar acesso ao Jards</h1>
        <p className="mt-2 text-sm text-black/60">
          {cliente.tipo === "publico" ? (
            <>O aplicativo &ldquo;<span className="font-medium text-[#282525]">{cliente.nome}</span>&rdquo; está pedindo permissão para acessar os dados do Jards usando a sua conta (</>
          ) : (
            <>Um assistente do ChatGPT está pedindo permissão para acessar os dados do Jards usando a sua conta (</>
          )}
          <span className="font-medium text-[#282525]">{email}</span>).
        </p>

        {escolhaLivre && (
          <fieldset className="mt-4 rounded border border-black/10 p-3">
            <legend className="px-1 text-sm font-medium text-[#282525]">O que o assistente pode usar</legend>
            <div className="space-y-2">
              {modulosDisponiveis.map((modulo) => (
                <label key={modulo} className="flex cursor-pointer items-start gap-2.5 text-sm text-black/70">
                  <input
                    type="checkbox"
                    name={campoDoModulo(modulo)}
                    form="consentimento"
                    checked={marcados.includes(modulo)}
                    onChange={() => alternar(modulo)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#282525]"
                  />
                  <span>
                    <span className="font-medium text-[#282525]">{MODULOS[modulo].nome}</span>{" "}
                    <span className="text-black/45">({MODULOS[modulo].descricao})</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="mt-4 rounded border border-black/10 bg-black/[0.02] p-3 text-sm">
          <p className="font-medium text-[#282525]">Vai poder:</p>
          {semModulo ? (
            <p className="mt-1 text-black/50">Marque ao menos um módulo para continuar.</p>
          ) : (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-black/70">
              {modulos.map((modulo) => (
                <li key={`ler-${modulo}`}>{MODULOS[modulo].ler}</li>
              ))}
              {!publico && gravar && modulos.map((modulo) => <li key={`gravar-${modulo}`}>{MODULOS[modulo].gravar}</li>)}
            </ul>
          )}
          {organizacoes.length > 0 && (
            <p className="mt-2 text-xs text-black/50">Organizações: {organizacoes.join(", ")}</p>
          )}
        </div>

        <p className="mt-3 text-xs text-black/50">
          Os dados pedidos em cada pergunta são enviados aos servidores{" "}
          {cliente.tipo === "publico" ? cliente.provedor : "da OpenAI"} para gerar a resposta — inclui dados de
          terceiros quando o acesso permite contatos.
          {modulos.includes("prestacao") && " Na prestação de contas, o que você pedir ao assistente (como valores, fornecedores e arquivos) também é enviado a esses servidores."}{" "}
          Saiba mais na{" "}
          <a href="/privacidade#s3" className="text-[#7259B5] hover:underline">política de privacidade</a>.
        </p>
        <p className="mt-2 text-xs text-black/50">
          Você pode revogar esse acesso a qualquer momento em Configurações → Minhas ferramentas → Claude e ChatGPT (MCP).
        </p>

        <form
          id="consentimento"
          method="POST"
          action="/api/mcp/oauth/consent"
          className="mt-5"
          onSubmit={(e) => setEnviando((e.nativeEvent as SubmitEvent).submitter?.getAttribute("name") === "deny" ? "deny" : "allow")}
        >
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <input type="hidden" name="state" value={state} />
          {!publico && <input type="hidden" name="scope" value={scopeDoPedido || scope} />}
          {codeChallenge && <input type="hidden" name="code_challenge" value={codeChallenge} />}
          {codeChallengeMethod && <input type="hidden" name="code_challenge_method" value={codeChallengeMethod} />}
          {resource && <input type="hidden" name="resource" value={resource} />}

          {publico && <input type="hidden" name={CAMPO_MODULOS_ESCOLHIDOS} value="1" />}
          {publico && !escolhaLivre && modulosDisponiveis.map((modulo) => <input key={modulo} type="hidden" name={campoDoModulo(modulo)} value="1" />)}

          {publico && (
            <label className="mb-4 flex cursor-pointer items-start gap-2.5 text-sm text-black/70">
              <input
                type="checkbox"
                name="escrita"
                checked={escrita}
                onChange={(e) => setEscrita(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#282525]"
              />
              <span>
                Permitir também criar e alterar registros
                {modulos.length > 0 && (
                  <>
                    {" "}
                    <span className="text-black/45">({modulos.map((modulo) => MODULOS[modulo].gravarCurto).join("; ")})</span>
                  </>
                )}
              </span>
            </label>
          )}

          <div className="flex gap-2">
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
              disabled={enviando !== null || semModulo}
              className="flex-1 rounded bg-[#2E8932] px-4 py-2.5 text-sm text-white hover:bg-[#26752A] disabled:opacity-50"
            >
              {enviando === "allow" ? "Autorizando…" : "Permitir"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
