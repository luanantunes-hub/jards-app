"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, Copy, Check } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { useCreditos } from "@/contexts/CreditosContext";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { AcessoContatosModal } from "@/components/modals/AcessoContatosModal";
import { ClaudeMark, OpenAIMark } from "@/components/icons/AiLogos";

interface ChaveMcp {
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

function CaixaCopiavel({ texto, rotulo, copiado, onCopiar }: { texto: string; rotulo: string; copiado: boolean; onCopiar: () => void }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded border border-black/10 bg-black/[0.02] px-3 py-2.5 text-xs">{texto}</code>
      <button
        type="button"
        onClick={onCopiar}
        title={rotulo}
        aria-label={rotulo}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded border border-black/15 bg-white hover:bg-black/5"
      >
        {copiado ? <Check size={16} className="text-[#2E8932]" /> : <Copy size={16} />}
      </button>
    </div>
  );
}

export default function ConfiguracoesMcpPage() {
  const router = useRouter();
  const { confirmDelete } = useDeleteConfirm();
  const { assinatura, loading: loadingAssinatura } = useCreditos();
  const [chaves, setChaves] = useState<ChaveMcp[]>([]);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"read" | "write">("read");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [chaveGerada, setChaveGerada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [origem, setOrigem] = useState("");
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch("/api/mcp/keys");
    const data = await res.json();
    if (res.ok) {
      const agora = Date.now();
      setChaves(
        (data.chaves ?? []).map((c: ChaveMcp) => ({
          ...c,
          expirada: c.expires_at ? new Date(c.expires_at).getTime() <= agora : false,
        }))
      );
    }
    setCarregando(false);
  }, []);

  useEffect(() => { void carregar(); }, [carregar]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { setOrigem(window.location.origin); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  async function criarChave() {
    setCriando(true);
    setErro(null);
    setChaveGerada(null);
    const res = await fetch("/api/mcp/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim() || null, scope, expires_in_days: Number(expiresInDays) }),
    });
    const data = await res.json();
    setCriando(false);
    if (!res.ok) {
      setErro(data.error ?? "Erro ao gerar chave");
      return;
    }
    setChaveGerada(data.chave);
    setLabel("");
    await carregar();
  }

  function revogar(id: string) {
    confirmDelete({
      title: "Revogar esta chave?",
      description: "Assistentes que usam esta chave perdem o acesso ao Jards imediatamente. Esta ação não pode ser desfeita.",
      confirmLabel: "Revogar",
      pendingLabel: "Revogando…",
      illustration: false,
      onConfirm: async () => {
        const res = await fetch(`/api/mcp/keys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Não foi possível revogar a chave. Tente novamente.");
        }
        await carregar();
      },
    });
  }

  async function copiar() {
    if (!chaveGerada) return;
    await navigator.clipboard.writeText(chaveGerada);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function copiarTexto(id: string, texto: string) {
    await navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId((atual) => (atual === id ? null : atual)), 2000);
  }

  const urlServidor = `${origem}/api/mcp/server`;
  const comandoClaudeCode = `claude mcp add --transport http jards ${urlServidor}`;
  const chavesAtivas = chaves.filter((c) => !c.revoked_at);

  if (loadingAssinatura) return null;

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
      <Link href="/configuracoes" className="mb-6 inline-flex items-center gap-2 text-[0.75rem] font-medium text-black/40 transition hover:text-black/65">
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

      <section aria-labelledby="titulo-claude" className="mt-8 rounded border border-black/10 bg-white p-4">
        <h2 id="titulo-claude" className="flex items-center gap-2 text-[0.9375rem] font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded border border-black/15 bg-white">
            <ClaudeMark size={15} />
          </span>
          Conectar o Claude
        </h2>
        <p className="mt-2 text-sm text-black/60">
          Funciona no claude.ai, no Claude Desktop e no Claude Code. Não precisa de chave: você entra na sua conta do
          Jards e autoriza.
        </p>

        <p className="mt-4 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/50">Endereço do servidor</p>
        <CaixaCopiavel
          texto={urlServidor}
          rotulo="Copiar endereço do servidor"
          copiado={copiadoId === "url"}
          onCopiar={() => void copiarTexto("url", urlServidor)}
        />

        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-black/70">
          <li>No Claude, abra Configurações → Conectores e escolha Adicionar conector personalizado.</li>
          <li>Cole o endereço acima, dê o nome Jards e confirme.</li>
          <li>Clique em Conectar, entre na sua conta do Jards e autorize.</li>
          <li>Pronto: peça, por exemplo, &ldquo;liste meus projetos em captação&rdquo;.</li>
        </ol>

        <p className="mt-4 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/50">No Claude Code</p>
        <CaixaCopiavel
          texto={comandoClaudeCode}
          rotulo="Copiar comando do Claude Code"
          copiado={copiadoId === "cmd"}
          onCopiar={() => void copiarTexto("cmd", comandoClaudeCode)}
        />
        <p className="mt-2 text-sm text-black/70">Depois, no Claude Code, rode /mcp, escolha jards e autorize.</p>

        <p className="mt-4 text-xs text-black/50">
          O Claude só lê por padrão. Para criar contatos e tarefas, ou ver os contatos de uma empresa (consome
          crédito), marque a permissão extra na tela de autorização. Para desconectar, revogue a conexão &ldquo;Claude
          (OAuth)&rdquo; em Chaves ativas, abaixo.
        </p>
      </section>

      <h2 className="mt-10 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded border border-black/15 bg-white">
          <OpenAIMark size={14} />
        </span>
        ChatGPT
      </h2>
      <p className="mt-2 rounded border border-[#B07A14]/25 bg-white p-3 text-sm text-[#8a5f0f]">
        O jeito recomendado é a Custom GPT do time com <strong>OAuth</strong> (veja o card abaixo): cada pessoa entra
        com a própria conta ao autorizar, sem gerar chave. Gere uma chave manual só para uma GPT própria sem OAuth, e
        nunca compartilhe uma GPT configurada com a sua chave.
      </p>

      <div className="mt-8 rounded border border-black/10 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/50">
              Nome da chave (opcional)
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ex. Claude Desktop, GPT prospecção"
              className="mt-2 h-10 w-full rounded border border-black/15 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#684DB0]"
            />
          </div>
          <div>
            <label className="block text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/50">Permissão</label>
            <div className="mt-2">
              <Select value={scope} onChange={(e) => setScope(e.target.value as "read" | "write")} className="h-10">
                <option value="read">Somente leitura</option>
                <option value="write">Leitura e criação (contatos, tarefas)</option>
              </Select>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/50">Expira em</label>
          <div className="mt-2 max-w-[12.5rem]">
            <Select value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} className="h-10">
              <option value="7">7 dias</option>
              <option value="30">30 dias</option>
              <option value="90">90 dias</option>
              <option value="365">1 ano</option>
            </Select>
          </div>
        </div>

        <button
          onClick={criarChave}
          disabled={criando}
          className="mt-4 rounded bg-[#0D0D0D] px-4 py-2.5 text-sm text-white hover:bg-black/80 disabled:opacity-50"
        >
          {criando ? "Gerando…" : "Gerar chave"}
        </button>
        {erro && <p className="mt-2 text-sm text-[#D94A4A]">{erro}</p>}

        {chaveGerada && (
          <div className="mt-4 rounded border border-[#2E8932]/30 bg-white p-3">
            <p className="text-sm font-medium text-[#26752A]">
              Copie agora — por segurança, essa chave não será mostrada de novo.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded border border-black/10 bg-white px-2 py-1.5 text-xs">
                {chaveGerada}
              </code>
              <button
                onClick={copiar}
                className="flex h-9 w-9 items-center justify-center rounded border border-black/15 bg-white hover:bg-black/5"
                title="Copiar"
                aria-label="Copiar chave"
              >
                {copiado ? <Check size={16} className="text-[#2E8932]" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/50">Chaves ativas</h2>
        <p className="mt-1 text-xs text-black/50">Inclui as conexões do Claude e do ChatGPT. Revogue para desconectar.</p>
        {carregando ? (
          <p className="mt-3 text-sm text-black/50">Carregando…</p>
        ) : chavesAtivas.length === 0 ? (
          <p className="mt-3 text-sm text-black/50">Nenhuma chave ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/10 rounded border border-black/10 bg-white">
            {chavesAtivas.map((c) => {
              const expirada = c.expirada ?? false;
              return (
                <li key={c.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {c.label || "Sem nome"}
                      <span
                        className="rounded border bg-white px-1.5 py-0.5 text-[0.625rem] font-medium"
                        style={{
                          borderColor: (c.scope === "write" ? "#D94A4A" : "#2D72B0") + "47",
                          color: c.scope === "write" ? "#D94A4A" : "#2D72B0",
                        }}
                      >
                        {c.scope === "write" ? "leitura + criação" : "somente leitura"}
                      </span>
                      {expirada && (
                        <span className="rounded border border-[#D94A4A]/30 bg-white px-1.5 py-0.5 text-[0.625rem] font-medium text-[#D94A4A]">
                          expirada
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-black/50">
                      {c.key_prefix}… · criada em {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      {c.expires_at ? ` · expira em ${new Date(c.expires_at).toLocaleDateString("pt-BR")}` : ""}
                      {c.last_used_at ? ` · usada em ${new Date(c.last_used_at).toLocaleDateString("pt-BR")}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => revogar(c.id)}
                    className="flex h-9 w-9 items-center justify-center rounded text-[#D94A4A] hover:bg-black/[.04]"
                    title="Revogar"
                    aria-label="Revogar chave"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-8 rounded border border-[#684DB0]/25 bg-white p-4 text-sm text-black/70">
        <p className="flex items-center gap-2 font-medium text-black">
          <OpenAIMark size={14} />
          Opção recomendada — Custom GPT do time com OAuth
        </p>
        <p className="mt-1">
          Uma única GPT compartilhada, onde cada pessoa autoriza com a própria conta Jards (sem chave manual, sem
          risco de herdar o acesso de outra pessoa). Configuração feita uma vez por quem cria a GPT:
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>Explorar GPTs → Criar → aba Configurar → Actions → Criar nova ação.</li>
          <li>
            Importe o schema: <code className="text-xs">{"{seu domínio}"}/api/mcp/openapi.json</code>
          </li>
          <li>
            Em autenticação, escolha <strong>OAuth</strong> e preencha:
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>
                Authorization URL: <code className="text-xs">{"{seu domínio}"}/oauth/authorize</code>
              </li>
              <li>
                Token URL: <code className="text-xs">{"{seu domínio}"}/api/mcp/oauth/token</code>
              </li>
              <li>Client ID / Client Secret: os valores de OAUTH_CHATGPT_CLIENT_ID / OAUTH_CHATGPT_CLIENT_SECRET do ambiente</li>
              <li>Scope: <code className="text-xs">read</code> ou <code className="text-xs">write</code></li>
            </ul>
          </li>
          <li>Ao usar a GPT pela primeira vez, cada pessoa autoriza com a própria conta na tela de consentimento.</li>
        </ol>
      </div>

      <div className="mt-4 rounded border border-black/10 bg-black/[0.02] p-4 text-sm text-black/70">
        <p className="flex items-center gap-2 font-medium text-black">
          <OpenAIMark size={14} />
          Alternativa — GPT pessoal com chave manual
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>Crie sua própria GPT (não compartilhe) em Explorar GPTs → Criar, aba Configurar → Actions.</li>
          <li>
            Importe o schema: <code className="text-xs">{"{seu domínio}"}/api/mcp/openapi.json</code>
          </li>
          <li>Em autenticação, escolha API Key / Bearer e cole a chave gerada acima.</li>
        </ol>
      </div>
    </div>
  );
}
