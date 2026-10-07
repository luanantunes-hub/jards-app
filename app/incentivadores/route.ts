import { readFile } from "node:fs/promises";
import path from "node:path";

// Página de chegada dos anúncios de quem pesquisa VERSALIC, SALIC e o painel do Esporte.
export async function GET() {
  const html = await readFile(path.join(process.cwd(), "public/incentivadores.html"), "utf8");
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
