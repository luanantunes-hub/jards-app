// GET /api/indices/poupanca?de=AAAA-MM-DD&ate=AAAA-MM-DD (P4.4): a
// rentabilidade da caderneta de poupança por data de aniversário (série 195 do
// Banco Central), para atualizar as devoluções. Só para quem está logado; a
// consulta vai pelo servidor porque a política de conteúdo do app não libera o
// Banco Central no navegador.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { janelasDaConsulta, taxasDaSerie } from "@/lib/prestacao/devolucoes";

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const SERIE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.195/dados";
const br = (iso: string) => iso.split("-").reverse().join("/");

export async function GET(req: NextRequest) {
  const de = req.nextUrl.searchParams.get("de") ?? "";
  const ate = req.nextUrl.searchParams.get("ate") ?? "";
  if (!DATA.test(de) || !DATA.test(ate) || de > ate || de < "1991-01-01") {
    return NextResponse.json({ error: "periodo_invalido" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });

  try {
    const blocos = await Promise.all(janelasDaConsulta(de, ate).map(async j => {
      const url = `${SERIE}?formato=json&dataInicial=${br(j.de)}&dataFinal=${br(j.ate)}`;
      const resposta = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
      // Sem dado no período, o Banco Central responde 404: período vazio, não falha.
      if (resposta.status === 404) return [];
      if (!resposta.ok) throw new Error(`Banco Central respondeu ${resposta.status}`);
      return taxasDaSerie(await resposta.json());
    }));
    return NextResponse.json({ taxas: blocos.flat(), fonte: "Banco Central do Brasil, SGS, série 195" }, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    console.error("[indices/poupanca]", e);
    return NextResponse.json({ error: "indice_indisponivel" }, { status: 502 });
  }
}
