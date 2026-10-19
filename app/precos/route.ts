import { readFile } from "node:fs/promises";
import path from "node:path";

// Página de preços dos módulos (Captação de recursos e Prestação de contas).
export async function GET() {
  const html = await readFile(path.join(process.cwd(), "public/precos.html"), "utf8");
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
