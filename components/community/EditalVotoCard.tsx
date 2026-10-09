"use client";
import { useState, useEffect, useCallback } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  editalId: string;
  votosFunciona: number;
  votosNaoFunciona: number;
};

type Counts = { sim: number; nao: number };

function VotoRow({
  pergunta,
  meuVoto,
  counts,
  onVoto,
}: {
  pergunta: string;
  meuVoto: boolean | null;
  counts: Counts;
  onVoto: (v: boolean) => void;
}) {
  const total = counts.sim + counts.nao;
  const pct   = total > 0 ? Math.round((counts.sim / total) * 100) : null;

  function btnStyle(lado: boolean) {
    const voted  = meuVoto === lado;
    const color  = lado ? "#2E8932" : "#D94E4E";
    const neutral: React.CSSProperties = {
      borderColor: "rgba(13,13,13,.12)",
      color: "rgba(13,13,13,.45)",
      background: "white",
    };
    const active: React.CSSProperties = {
      borderColor: color,
      color,
      background: "white",
    };
    return voted ? active : neutral;
  }

  return (
    <div className="space-y-2">
      <p className="text-[0.6875rem] text-black/45">{pergunta}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onVoto(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-[0.6875rem] font-semibold transition hover:bg-black/[.02]"
          style={btnStyle(true)}
        >
          <ThumbsUp size={11} /> Sim
        </button>
        <button
          onClick={() => onVoto(false)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-[0.6875rem] font-semibold transition hover:bg-black/[.02]"
          style={btnStyle(false)}
        >
          <ThumbsDown size={11} /> Não
        </button>
      </div>
      {pct !== null && (
        <p className="text-[0.625rem] text-black/30">
          <span className={`font-semibold tabular-nums ${pct === 0 ? "text-black/30" : "text-[#0D0D0D]"}`}>
            {pct}% positivo
          </span>
          {" "}· {total} {total === 1 ? "voto" : "votos"}
        </p>
      )}
    </div>
  );
}

export function EditalVotoCard({ editalId, votosFunciona, votosNaoFunciona }: Props) {
  const supabase = createClient();
  const [meuFunciona, setMeuFunciona]           = useState<boolean | null>(null);
  const [meuPrincipal, setMeuPrincipal]         = useState<boolean | null>(null);
  const [countsF, setCountsF]                   = useState<Counts>({ sim: votosFunciona, nao: votosNaoFunciona });
  const [countsP, setCountsP]                   = useState<Counts>({ sim: 0, nao: 0 });
  const [erro, setErro]                         = useState<string | null>(null);

  const refreshCounts = useCallback(async () => {
    const { data, error } = await supabase.from("edital_votos").select("funciona, principal_selecao").eq("edital_id", editalId);
    if (error) { setErro(error.message); return; }
    if (!data) return;
    setCountsF({
      sim: data.filter((v: any) => v.funciona === true).length,
      nao: data.filter((v: any) => v.funciona === false).length,
    });
    setCountsP({
      sim: data.filter((v: any) => v.principal_selecao === true).length,
      nao: data.filter((v: any) => v.principal_selecao === false).length,
    });
  }, [editalId, supabase]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("edital_votos")
        .select("funciona, principal_selecao")
        .eq("edital_id", editalId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setMeuFunciona((data as any).funciona ?? null);
        setMeuPrincipal((data as any).principal_selecao ?? null);
      }
      refreshCounts();
    }
    init();
  }, [editalId, supabase, refreshCounts]);

  const handleFunciona = useCallback(async (valor: boolean) => {
    setErro(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await (supabase as any).from("edital_votos").upsert(
      { edital_id: editalId, user_id: user.id, funciona: valor },
      { onConflict: "edital_id,user_id" }
    );
    if (error) { setErro(error.message); return; }
    setMeuFunciona(valor);
    await refreshCounts();
  }, [editalId, supabase, refreshCounts]);

  const handlePrincipal = useCallback(async (valor: boolean) => {
    setErro(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await (supabase as any).rpc("fn_votar_edital_principal", {
      p_edital_id: editalId,
      p_valor: valor,
    });
    if (error) { setErro(error.message); return; }
    setMeuPrincipal(valor);
    await refreshCounts();
  }, [editalId, supabase, refreshCounts]);

  return (
    <div className="grid grid-cols-2 gap-6">
      <VotoRow
        pergunta="Esse edital funciona?"
        meuVoto={meuFunciona}
        counts={countsF}
        onVoto={handleFunciona}
      />
      <VotoRow
        pergunta="Essa é a principal forma de seleção de projetos?"
        meuVoto={meuPrincipal}
        counts={countsP}
        onVoto={handlePrincipal}
      />
      {erro && <p role="alert" className="col-span-2 text-[0.625rem] leading-4 text-[#D94E4E]">Não foi possível salvar este voto: {erro}</p>}
    </div>
  );
}
