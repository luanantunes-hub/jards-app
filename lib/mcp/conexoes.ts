export type Assistente = "claude" | "chatgpt";

export interface ChaveMcp {
  id: string;
  key_prefix: string;
  label: string | null;
  scope: "read" | "write";
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  expirada?: boolean;
}

export interface StatusConexao {
  conectado: boolean;
  /** Última atividade da conexão (último uso, ou a autorização se nunca foi usada). */
  ultimaAtividade: string | null;
  escrita: boolean;
}

// O assistente renova o acesso sozinho enquanto o refresh token vale (90 dias, ver OAUTH_REFRESH_TOKEN_TTL_MS).
const JANELA_CONEXAO_MS = 90 * 24 * 60 * 60_000;

/** Conexões por OAuth levam o nome do assistente no rótulo: "Claude (OAuth)", "ChatGPT (OAuth)". */
export function ehConexaoOAuth(label: string | null): boolean {
  return /\(oauth\)\s*$/i.test(label ?? "");
}

export function assistenteDaChave(label: string | null): Assistente | null {
  const nome = (label ?? "").trim().toLowerCase();
  if (nome.startsWith("claude")) return "claude";
  // O conector do ChatGPT pode se registrar como "ChatGPT" ou com o nome da empresa ("OpenAI …").
  if (nome.startsWith("chatgpt") || nome.startsWith("openai")) return "chatgpt";
  return null;
}

export function statusDoAssistente(chaves: ChaveMcp[], assistente: Assistente, agora: number = Date.now()): StatusConexao {
  const recentes = chaves
    .filter((c) => !c.revoked_at && ehConexaoOAuth(c.label) && assistenteDaChave(c.label) === assistente)
    .map((c) => ({ chave: c, atividade: c.last_used_at ?? c.created_at }))
    .filter(({ atividade }) => agora - new Date(atividade).getTime() <= JANELA_CONEXAO_MS)
    .sort((a, b) => new Date(b.atividade).getTime() - new Date(a.atividade).getTime());

  if (recentes.length === 0) return { conectado: false, ultimaAtividade: null, escrita: false };
  return {
    conectado: true,
    ultimaAtividade: recentes[0].atividade,
    escrita: recentes.some(({ chave }) => chave.scope === "write"),
  };
}
