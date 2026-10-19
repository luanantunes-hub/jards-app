import { readFile } from "node:fs/promises";
import path from "node:path";

// Página do CRM, a parte de operação do módulo de captação de recursos (menu Produto).
export async function GET() {
  const html = await readFile(path.join(process.cwd(), "public/crm.html"), "utf8");
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
