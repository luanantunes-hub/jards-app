import { readFile } from "node:fs/promises";
import path from "node:path";

// Página do módulo Prestação de contas (menu Produto).
export async function GET() {
  const html = await readFile(path.join(process.cwd(), "public/prestacao-de-contas.html"), "utf8");
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
