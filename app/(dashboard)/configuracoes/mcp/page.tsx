"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, Copy, Check } from "lucide-react";

interface ChaveMcp {
  id: string;
  key_prefix: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export default function ConfiguracoesMcpPage() {
  const [chaves, setChaves] = useState<ChaveMcp[]>([]);
  const [label, setLabel] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [chaveGerada, setChaveGerada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch("/api/mcp/keys");
    const data = await res.json();
    if (res.ok) setChaves(data.chaves ?? []);
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
      body: JSON.stringify({ label: label.trim() || null }),
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">Acesso por API (MCP / ChatGPT)</h1>
      <p className="mt-2 text-sm text-black/60">
        Gere uma chave pessoal para usar os dados do Jards em um assistente externo (Claude, Custom GPT). A chave dá
        acesso apenas às organizações das quais você é membro — o mesmo que você já vê logado no Jards.
      </p>

      <div className="mt-8 rounded border border-black/10 bg-white p-4">
        <label className="block text-[10px] font-medium uppercase tracking-[.08em] text-black/50">
          Nome da chave (opcional)
        </label>
        <div className="mt-2 flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="ex. Claude Desktop, GPT prospecção"
            className="h-10 flex-1 rounded border border-black/15 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#684DB0]"
          />
          <button
            onClick={criarChave}
            disabled={criando}
            className="rounded bg-[#0D0D0D] px-4 py-2.5 text-sm text-white hover:bg-black/80 disabled:opacity-50"
          >
            {criando ? "Gerando…" : "Gerar chave"}
          </button>
        </div>
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
        ) : chaves.filter((c) => !c.revoked_at).length === 0 ? (
          <p className="mt-3 text-sm text-black/50">Nenhuma chave ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/10 rounded border border-black/10 bg-white">
            {chaves
              .filter((c) => !c.revoked_at)
              .map((c) => (
                <li key={c.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{c.label || "Sem nome"}</p>
                    <p className="text-xs text-black/50">
                      {c.key_prefix}… · criada em {new Date(c.created_at).toLocaleDateString("pt-BR")}
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
              ))}
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
