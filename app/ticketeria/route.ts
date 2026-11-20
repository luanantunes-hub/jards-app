import { readFile } from "node:fs/promises";
import path from "node:path";

// Página do produto Ticketeria (venda de ingressos). A tela do módulo dentro do
// app fica em /ingressos; este endereço é só a página pública.
export async function GET() {
  const html = await readFile(path.join(process.cwd(), "public/ticketeria.html"), "utf8");
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
