"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { ExternalLink } from "lucide-react";

type PropostaPublica = {
  titulo: string;
  pdf_url: string | null;
  pdf_nome: string | null;
};

export default function PropostaPublicaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug }    = use(params);
  const supabase    = createClient();
  const startTime   = useRef(Date.now());

  const [proposta, setProposta] = useState<PropostaPublica | null>(null);
  const [erro,     setErro]     = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);

  const fetchProposta = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("fn_proposta_publica", { p_slug: slug });
    if (error || !data) { setErro("Proposta não encontrada."); setLoading(false); return; }
    if (data.expirada)  { setErro("Esta proposta expirou.");   setLoading(false); return; }
    if (data.arquivada) { setErro("Esta proposta foi arquivada."); setLoading(false); return; }
    setProposta(data);
    setLoading(false);
  }, [slug, supabase]);

  useEffect(() => { fetchProposta(); }, [fetchProposta]);

  // Registra duração ao sair
  useEffect(() => {
    if (!proposta) return;
    function onUnload() {
      const duracao = Math.round((Date.now() - startTime.current) / 1000);
      if (duracao < 3) return;
      navigator.sendBeacon?.(
        `${window.location.origin}/api/proposta-track`,
        new Blob(
          [JSON.stringify({ slug, duracao_segundos: duracao })],
          { type: "application/json" }
        )
      );
    }
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [proposta, slug]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/50" />
      </div>
    );
  }

  if (erro || !proposta) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-white/50">{erro ?? "Proposta não disponível."}</p>
        <a href="https://jards.com.br" className="text-xs text-white/25 hover:text-white/50 transition">
          jards.com.br
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex flex-shrink-0 items-center justify-between px-5 py-3 border-b border-white/8">
        <div className="flex items-center gap-3">
          <a href="https://jards.com.br" target="_blank" rel="noopener noreferrer">
            <Image src="/jards-logo.svg" alt="Jards" width={68} height={20} className="h-5 w-auto opacity-60 hover:opacity-90 transition brightness-0 invert" />
          </a>
          <span className="h-4 w-px bg-white/12" />
          <p className="text-[0.8125rem] font-semibold text-white/70 truncate max-w-[15rem] sm:max-w-sm md:max-w-lg">
            {proposta.titulo}
          </p>
        </div>
        {proposta.pdf_url && (
          <a
            href={proposta.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[0.6875rem] font-semibold text-white/50 border border-white/12 hover:border-white/25 hover:text-white/80 transition"
          >
            <ExternalLink size={11} />
            Abrir PDF
          </a>
        )}
      </header>

      {/* PDF viewer */}
      <div className="flex-1 overflow-hidden">
        {proposta.pdf_url ? (
          <iframe
            src={`${proposta.pdf_url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
            className="h-full w-full border-0"
            title={proposta.titulo}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/30">
            <p className="text-sm">Nenhum arquivo disponível.</p>
          </div>
        )}
      </div>
    </div>
  );
}
