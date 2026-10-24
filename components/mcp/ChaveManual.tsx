"use client";

import { useId, useState } from "react";
import { Select } from "@/components/ui/Select";
import { NOME_DO_MODULO, type ModuloMcp } from "@/lib/mcp/modulos";
import { CaixaCopiavel } from "@/components/mcp/BotaoCopiar";
import { useCopiado } from "@/components/mcp/useCopiado";

const ROTULO = "block text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/60";

/** Gera uma chave manual (para uma GPT própria, sem OAuth). A chave só aparece uma vez, logo depois de criada. */
export function ChaveManual({ aoCriar, modulosDisponiveis }: { aoCriar: () => Promise<void>; modulosDisponiveis: readonly ModuloMcp[] }) {
  const idNome = useId();
  const idPermissao = useId();
  const idValidade = useId();
  const { copiado, copiar } = useCopiado();
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"read" | "write">("read");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [chaveGerada, setChaveGerada] = useState<string | null>(null);
  // Só a captação (o que a chave sempre foi) vem marcada; a prestação de contas é uma escolha explícita.
  const [modulos, setModulos] = useState<ModuloMcp[]>(["captacao"]);
  const escolhe = modulosDisponiveis.length > 1;
  // Com um módulo só, a chave é desse módulo; com mais de um, vale o que a pessoa marcou.
  const modulosDaChave: ModuloMcp[] = escolhe ? modulos.filter((modulo) => modulosDisponiveis.includes(modulo)) : [...modulosDisponiveis];

  function alternar(modulo: ModuloMcp) {
    setModulos((atual) => (atual.includes(modulo) ? atual.filter((m) => m !== modulo) : [...atual, modulo]));
  }

  async function criarChave() {
    if (modulosDaChave.length === 0) {
      setErro("Marque ao menos um módulo para a chave.");
      return;
    }
    setCriando(true);
    setErro(null);
    setChaveGerada(null);
    try {
      const res = await fetch("/api/mcp/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || null, scope, expires_in_days: Number(expiresInDays), ...(modulosDaChave.length > 0 ? { modulos: modulosDaChave } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error ?? "Erro ao gerar chave");
        return;
      }
      setChaveGerada(data.chave);
      setLabel("");
      await aoCriar();
    } catch {
      setErro("Não foi possível gerar a chave. Verifique a conexão e tente de novo.");
    } finally {
      setCriando(false);
    }
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={idNome} className={ROTULO}>
            Nome da chave (opcional)
          </label>
          <input
            id={idNome}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="ex. GPT prospecção"
            className="mt-2 h-10 w-full rounded border border-black/15 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#684DB0]"
          />
        </div>
        <div>
          <label htmlFor={idPermissao} className={ROTULO}>
            Permissão
          </label>
          <div className="mt-2">
            <Select id={idPermissao} value={scope} onChange={(e) => setScope(e.target.value as "read" | "write")} className="h-10">
              <option value="read">Somente leitura</option>
              <option value="write">Leitura e criação (empresas, contatos, negociações, atividades)</option>
            </Select>
          </div>
        </div>
      </div>

      {escolhe && (
        <fieldset className="mt-3">
          <legend className={ROTULO}>Módulos</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {modulosDisponiveis.map((modulo) => (
              <label key={modulo} className="flex items-center gap-2 text-sm text-black/75">
                <input
                  type="checkbox"
                  checked={modulos.includes(modulo)}
                  onChange={() => alternar(modulo)}
                  className="h-4 w-4 rounded border-black/30 accent-[#7259B5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
                />
                <span className="first-letter:uppercase">{NOME_DO_MODULO[modulo]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-3">
        <label htmlFor={idValidade} className={ROTULO}>
          Expira em
        </label>
        <div className="mt-2 max-w-[12.5rem]">
          <Select id={idValidade} value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} className="h-10">
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
            <option value="365">1 ano</option>
          </Select>
        </div>
      </div>

      <button
        type="button"
        onClick={criarChave}
        disabled={criando}
        className="mt-4 rounded bg-[#282525] px-4 py-2.5 text-sm text-white transition hover:bg-[#3A3535] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50"
      >
        {criando ? "Gerando…" : "Gerar chave"}
      </button>
      {erro && (
        <p className="mt-2 text-sm text-[#D94A4A]" role="alert">
          {erro}
        </p>
      )}

      {chaveGerada && (
        <div className="mt-4 rounded border bg-white p-3" style={{ borderColor: "#2E893247" }}>
          <p className="text-sm font-medium text-[#26752A]">Copie agora — por segurança, essa chave não será mostrada de novo.</p>
          <CaixaCopiavel texto={chaveGerada} copiado={copiado === "chave"} onCopiar={() => void copiar("chave", chaveGerada)} rotulo="Copiar a chave gerada" />
        </div>
      )}
    </div>
  );
}
