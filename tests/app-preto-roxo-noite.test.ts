import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

/** A parte logada do app: painel, admin e componentes. */
const INTERNO = /^(app\/\(dashboard\)\/|app\/admin\/|components\/)/;

/** Fora do app (ou tela escura de propósito): segue em grafite. */
const FORA_DO_APP = /^(app\/(acerto|convite|enviar|nova-senha|redefinir-senha|alterar-senha|p\/|palco|presenca|embed|publicacoes|blog|login|cadastro|dominio)|components\/site\/|components\/producao\/(ProgramacaoPublicaView|PalcoAoVivo)\.tsx|components\/ticketeria\/(SiteView|CompraView|SairDaEspera|ListaDeEsperaView)\.tsx|app\/(comprar|pedido|espera)\/)/;

/** Preenchimento preto chapado (com opacidade é gráfico ou cinza, e pode). */
const PRETO = /bg-\[#(282525|0D0D0D|0d0d0d|171717|1a1a1a|000|000000)\](?!\/)|\bbg-black(?![/\w-])|hover:bg-\[#3A3535\]|background(Color)?: *[^,}\n]*"#(282525|0D0D0D|171717|1a1a1a|000)"/;

/** Gráficos chapados em grafite: roxo não é cor de dado. */
const GRAFICOS = [{ arquivo: "app/(dashboard)/producoes/pedidos/[id]/page.tsx", trecho: "`${proporcao}%`" }];

function arquivos(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) return item.name === "node_modules" ? [] : arquivos(caminho);
    return /\.(ts|tsx)$/.test(item.name) ? [caminho] : [];
  });
}

test("dentro do app, preenchimento escuro é roxo noite (#1C0E33), não preto", () => {
  const achados: string[] = [];
  for (const caminho of [...arquivos(join(RAIZ, "app")), ...arquivos(join(RAIZ, "components"))]) {
    const rel = relative(RAIZ, caminho).split("\\").join("/");
    if (!INTERNO.test(rel) || FORA_DO_APP.test(rel)) continue;
    readFileSync(caminho, "utf8").split("\n").forEach((linha, indice) => {
      if (!PRETO.test(linha)) return;
      if (GRAFICOS.some((grafico) => grafico.arquivo === rel && linha.includes(grafico.trecho))) return;
      achados.push(`${rel}:${indice + 1}`);
    });
  }
  assert.deepEqual(achados, [], "no app, use bg-[#1C0E33] com hover:bg-[#2D1A53]; gráfico fica em grafite (ex.: bg-[#282525]/70)");
});

test("fora do app o preto continua grafite: a regra não vaza para login, links públicos e site", () => {
  const login = readFileSync(join(RAIZ, "app/nova-senha/page.tsx"), "utf8");
  assert.ok(login.includes("bg-[#282525]"), "a autenticação segue em tinta");
  assert.ok(!login.includes("#1C0E33"));
});
