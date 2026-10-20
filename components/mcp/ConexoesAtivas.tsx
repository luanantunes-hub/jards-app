"use client";

import type { ReactNode } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { assistenteDaChave, ehConexaoOAuth, type ChaveMcp } from "@/lib/mcp/conexoes";
import { normalizarModulosDaChave } from "@/lib/mcp/modulos";
import { ClaudeMark, OpenAIMark } from "@/components/icons/AiLogos";
import type { Verificacao } from "@/components/mcp/PassosConexao";

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

function Etiqueta({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span className="rounded border bg-white px-1.5 py-0.5 text-[0.625rem] font-medium" style={{ borderColor: cor + "47", color: cor }}>
      {children}
    </span>
  );
}

function Icone({ chave }: { chave: ChaveMcp }) {
  const assistente = assistenteDaChave(chave.label);
  return (
    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded border border-black/15 bg-white">
      {assistente === "claude" ? (
        <ClaudeMark size={15} />
      ) : assistente === "chatgpt" ? (
        <OpenAIMark size={14} />
      ) : (
        <KeyRound size={14} className="text-black/50" aria-hidden="true" />
      )}
    </span>
  );
}

/** Nome sem o sufixo técnico: "Claude (OAuth)" vira "Claude". */
export function nomeDaConexao(chave: ChaveMcp): string {
  return (chave.label ?? "").replace(/\s*\(oauth\)\s*$/i, "").trim() || "Sem nome";
}

interface Props {
  chaves: ChaveMcp[];
  verificacao: Verificacao;
  onRevogar: (chave: ChaveMcp) => void;
  onTentarDeNovo: () => void;
}

/** Tudo que tem acesso ao Jards agora: o Claude e o ChatGPT conectados e as chaves manuais. */
export function ConexoesAtivas({ chaves, verificacao, onRevogar, onTentarDeNovo }: Props) {
  const ativas = chaves.filter((c) => !c.revoked_at);

  return (
    <section aria-labelledby="titulo-conexoes" className="mt-10">
      <h2 id="titulo-conexoes" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/60">
        Conexões ativas
      </h2>
      <p className="mt-1 text-xs text-black/60">Claude, ChatGPT e chaves manuais. Desconecte para encerrar o acesso na hora.</p>

      {verificacao === "carregando" ? (
        <div className="mt-3 space-y-2" aria-hidden="true">
          <div className="h-14 animate-pulse rounded bg-black/[.04]" />
          <div className="h-14 animate-pulse rounded bg-black/[.04]" />
        </div>
      ) : verificacao === "erro" && ativas.length === 0 ? (
        <p className="mt-3 text-sm text-black/70">
          Não foi possível carregar as conexões.{" "}
          <button
            type="button"
            onClick={onTentarDeNovo}
            className="underline underline-offset-2 hover:text-[#282525] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
          >
            Tentar de novo
          </button>
        </p>
      ) : ativas.length === 0 ? (
        <p className="mt-3 text-sm text-black/70">Nenhuma conexão ainda. Siga os passos de uma das abas acima.</p>
      ) : (
        <ul className="mt-3 divide-y divide-black/10 rounded border border-black/10 bg-white">
          {ativas.map((c) => {
            const oauth = ehConexaoOAuth(c.label);
            const nome = nomeDaConexao(c);
            return (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <Icone chave={c} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="min-w-0 break-words">{nome}</span>
                    <Etiqueta cor={c.scope === "write" ? "#D94A4A" : "#2D72B0"}>
                      {c.scope === "write" ? "leitura + criação" : "somente leitura"}
                    </Etiqueta>
                    {normalizarModulosDaChave(c.modulos).includes("prestacao") && <Etiqueta cor="#6B6565">prestação de contas</Etiqueta>}
                    {!oauth && c.expirada && <Etiqueta cor="#D94A4A">expirada</Etiqueta>}
                  </p>
                  <p className="mt-0.5 text-xs text-black/60">
                    {oauth
                      ? `Login pelo Jards · atividade em ${data(c.last_used_at ?? c.created_at)}`
                      : [
                          `${c.key_prefix}…`,
                          `criada em ${data(c.created_at)}`,
                          c.expires_at ? `expira em ${data(c.expires_at)}` : null,
                          c.last_used_at ? `usada em ${data(c.last_used_at)}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRevogar(c)}
                  title={oauth ? "Desconectar" : "Revogar"}
                  aria-label={oauth ? `Desconectar ${nome}` : `Revogar a chave ${nome}`}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded text-[#D94A4A] transition hover:bg-black/[.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98]"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
