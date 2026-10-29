/**
 * Limitador em memória, mesmo padrão do proxy.ts raiz — mas aqui é
 * necessário um módulo à parte porque as rotas /api/mcp/* são autenticadas
 * por Bearer token (chave de API), não por cookie/IP, então o proxy global
 * não consegue identificar "quem" está chamando para aplicar o limite por
 * usuário. É por-instância (não distribuído); suficiente para conter abuso
 * e scripts descontrolados, não para garantir um teto exato sob múltiplas
 * instâncias.
 */

const WINDOW_MS = 60_000;
const MAX_ENTRIES = 10_000;

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

/** Soma uma ocorrência na janela da chave e devolve o total. */
function contar(key: string, windowMs: number): number {
  cleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    if (!entry && store.size >= MAX_ENTRIES) {
      const oldestKey = store.keys().next().value as string | undefined;
      if (oldestKey) store.delete(oldestKey);
    }
    store.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }

  entry.count += 1;
  return entry.count;
}

/** true = requisição deve ser bloqueada com 429. Conta a própria requisição. */
export function isRateLimited(key: string, limit: number, windowMs = WINDOW_MS): boolean {
  return contar(key, windowMs) > limit;
}

/** true = a chave já registrou `limite` ocorrências na janela. Só consulta, não conta. */
export function estaNoLimite(key: string, limite: number): boolean {
  cleanup();
  const entry = store.get(key);
  if (!entry || Date.now() > entry.resetAt) return false;
  return entry.count >= limite;
}

/** Registra uma ocorrência (ex.: uma tentativa com chave que não existe) sem decidir nada. */
export function registrarOcorrencia(key: string, windowMs = WINDOW_MS): void {
  contar(key, windowMs);
}
