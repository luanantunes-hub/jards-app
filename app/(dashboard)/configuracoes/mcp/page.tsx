"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, Copy, Check } from "lucide-react";
import { Select } from "@/components/ui/Select";

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

export default function ConfiguracoesMcpPage() {
  const [chaves, setChaves] = useState<ChaveMcp[]>([]);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"read" | "write">("read");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [chaveGerada, setChaveGerada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

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

  async function revogar(id: string) {
    await fetch(`/api/mcp/keys?id=${id}`, { method: "DELETE" });
    await carregar();
  }

  async function copiar() {
    if (!chaveGerada) return;
    await navigator.clipboard.writeText(chaveGerada);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const chavesAtivas = chaves.filter((c) => !c.revoked_at);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">Acesso por API (MCP / ChatGPT)</h1>
      <p className="mt-2 text-sm text-black/60">
        Gere uma chave pessoal para usar os dados do Jards em um assistente externo (Claude, Custom GPT). A chave dá
        acesso apenas às organizações das quais você é membro — o mesmo que você já vê logado no Jards.
      </p>
      <p className="mt-2 rounded border border-[#B07A14]/25 bg-[#B07A14]/5 p-3 text-sm text-[#8a5f0f]">
        Importante se for usar no ChatGPT: a chave fica guardada na sua Custom GPT e é compartilhada por qualquer
        pessoa que usar essa mesma GPT. Não publique nem compartilhe a GPT configurada com sua chave — cada pessoa do
        time deve criar a própria GPT com a própria chave.
      </p>

      <div className="mt-8 rounded border border-black/10 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-[.08em] text-black/50">
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
            <label className="block text-[10px] font-medium uppercase tracking-[.08em] text-black/50">Permissão</label>
            <div className="mt-2">
              <Select value={scope} onChange={(e) => setScope(e.target.value as "read" | "write")} className="h-10">
                <option value="read">Somente leitura</option>
                <option value="write">Leitura e criação (contatos, tarefas)</option>
              </Select>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-[10px] font-medium uppercase tracking-[.08em] text-black/50">Expira em</label>
          <div className="mt-2 max-w-[200px]">
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
          <div className="mt-4 rounded border border-[#2E8932]/30 bg-[#2E8932]/5 p-3">
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
        <h2 className="text-[10px] font-medium uppercase tracking-[.08em] text-black/50">Chaves ativas</h2>
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
                        className="rounded border bg-white px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          borderColor: (c.scope === "write" ? "#D94A4A" : "#2D72B0") + "47",
                          color: c.scope === "write" ? "#D94A4A" : "#2D72B0",
                        }}
                      >
                        {c.scope === "write" ? "leitura + criação" : "somente leitura"}
                      </span>
                      {expirada && (
                        <span className="rounded border border-[#D94A4A]/30 bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#D94A4A]">
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
                    className="flex h-9 w-9 items-center justify-center rounded text-[#D94A4A] hover:bg-[#D94A4A]/10"
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

      <div className="mt-8 rounded border border-black/10 bg-black/[0.02] p-4 text-sm text-black/70">
        <p className="font-medium text-black">Configurar no Custom GPT</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>Crie uma GPT em Explorar GPTs → Criar, aba Configurar → Actions → Criar nova ação.</li>
          <li>
            Importe o schema pela URL: <code className="text-xs">{"{seu domínio}"}/api/mcp/openapi.json</code>
          </li>
          <li>Em autenticação, escolha API Key / Bearer e cole a chave gerada acima.</li>
        </ol>
      </div>
    </div>
  );
}
