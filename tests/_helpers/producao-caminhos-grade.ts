/**
 * A grade de caminhos que as duas pontas do caminho dos arquivos da produção (PD0.14) têm de julgar do mesmo jeito:
 * o app e a função de borda (supabase/functions/_shared/producao-caminho.ts) e o banco (`fn_producao_caminho_partes`,
 * no teste supabase/tests/producao_arquivos.test.sql, que repete os modelos abaixo, linha por linha).
 * tests/producao-armazenamento.test.ts confere o app contra ela; tests/producao-arquivos-sql.test.ts confere que o
 * teste do banco tem os mesmos modelos, na mesma ordem e com o mesmo veredito.
 *
 * Um modelo escreve os identificadores como {o} (organização), {t} (temporada) e {a} (arquivo) em minúsculas, e como
 * {O}, {T} e {A} em maiúsculas. Fica fora dela o que não cabe numa linha de SQL sem escape (quebra de linha no fim).
 */

export const ORGANIZACAO = "a1b2c3d4-aaaa-4bbb-8ccc-0123456789ab";
export const TEMPORADA = "b2c3d4e5-bbbb-4ccc-8ddd-123456789abc";
export const ARQUIVO = "c3d4e5f6-cccc-4ddd-8eee-23456789abcd";

export type ModeloDeCaminho = { modelo: string; valido: boolean; porque: string };

const valido = (modelo: string, porque: string): ModeloDeCaminho => ({ modelo, valido: true, porque });
const recusado = (modelo: string, porque: string): ModeloDeCaminho => ({ modelo, valido: false, porque });

export const MODELOS_DE_CAMINHO: readonly ModeloDeCaminho[] = [
  // O que o app monta: uma linha por pasta e algumas extensões, inclusive as que são prefixo de outra (xls/xlsx, jpg/jpeg, tif/tiff).
  valido("{o}/producoes/{t}/datas/{a}.pdf", "pasta datas"),
  valido("{o}/producoes/{t}/pessoas/{a}.pdf", "pasta pessoas"),
  valido("{o}/producoes/{t}/acordos/{a}.pdf", "pasta acordos"),
  valido("{o}/producoes/{t}/plantas/{a}.pdf", "pasta plantas"),
  valido("{o}/producoes/{t}/itens/{a}.pdf", "pasta itens"),
  valido("{o}/producoes/{t}/documentos/{a}.pdf", "pasta documentos"),
  valido("{o}/producoes/{t}/deslocamentos/{a}.pdf", "pasta deslocamentos"),
  valido("{o}/producoes/{t}/hospedagem/{a}.pdf", "pasta hospedagem"),
  valido("{o}/producoes/{t}/recebidos/{a}.pdf", "pasta recebidos"),
  valido("{o}/producoes/{t}/acordos/{a}.jpg", "extensão jpg"),
  valido("{o}/producoes/{t}/acordos/{a}.jpeg", "extensão jpeg"),
  valido("{o}/producoes/{t}/acordos/{a}.xls", "extensão xls"),
  valido("{o}/producoes/{t}/acordos/{a}.xlsx", "extensão xlsx"),
  valido("{o}/producoes/{t}/plantas/{a}.dwg", "extensão dwg"),
  valido("{o}/producoes/{t}/itens/{a}.tif", "extensão tif"),
  valido("{o}/producoes/{t}/itens/{a}.tiff", "extensão tiff"),
  valido("{o}/producoes/{t}/deslocamentos/{a}.mp4", "extensão mp4"),
  valido("{o}/producoes/{t}/recebidos/{a}.zip", "extensão zip"),
  // A raiz: só `producoes`, e em minúsculas. A prestação e os fornecedores são de outro lugar.
  recusado("{o}/producao/{t}/acordos/{a}.pdf", "raiz no singular"),
  recusado("{o}/Producoes/{t}/acordos/{a}.pdf", "raiz com maiúscula"),
  recusado("{o}/prestacoes/{t}/comprovantes/{a}.pdf", "caminho da prestação"),
  recusado("{o}/fornecedores/{t}/{a}.pdf", "caminho de fornecedores"),
  recusado("{o}/outros/{t}/acordos/{a}.pdf", "outra raiz"),
  recusado("{o}/producoes/{a}.pdf", "arquivo solto na raiz"),
  // Os identificadores: UUID em minúsculas, no lugar certo.
  recusado("producoes/{t}/acordos/{a}.pdf", "sem a organização"),
  recusado("{O}/producoes/{t}/acordos/{a}.pdf", "organização em maiúsculas"),
  recusado("a1b2c3d4-aaaa-4bbb-8ccc-0123456789a/producoes/{t}/acordos/{a}.pdf", "organização truncada"),
  recusado("g1b2c3d4-aaaa-4bbb-8ccc-0123456789ab/producoes/{t}/acordos/{a}.pdf", "organização que não é hexadecimal"),
  recusado("{o}/producoes/acordos/{a}.pdf", "sem a temporada"),
  recusado("{o}/producoes/{T}/acordos/{a}.pdf", "temporada em maiúsculas"),
  recusado("{o}/producoes/{t}/acordos/nota.pdf", "arquivo sem identificador"),
  recusado("{o}/producoes/{t}/acordos/{A}.pdf", "arquivo em maiúsculas"),
  // A pasta: uma das nove fixas, em minúsculas.
  recusado("{o}/producoes/{t}/{a}.pdf", "sem a pasta"),
  recusado("{o}/producoes/{t}//{a}.pdf", "pasta vazia"),
  recusado("{o}/producoes/{t}/financeiro/{a}.pdf", "pasta desconhecida"),
  recusado("{o}/producoes/{t}/Acordos/{a}.pdf", "pasta com maiúscula"),
  recusado("{o}/producoes/{t}/acordos/sub/{a}.pdf", "pasta a mais"),
  // A extensão: uma das aceitas, em minúsculas, sem nada depois.
  recusado("{o}/producoes/{t}/acordos/{a}", "sem extensão"),
  recusado("{o}/producoes/{t}/acordos/{a}.", "extensão vazia"),
  recusado("{o}/producoes/{t}/acordos/.pdf", "só a extensão"),
  recusado("{o}/producoes/{t}/acordos/{a}.PDF", "extensão em maiúsculas"),
  recusado("{o}/producoes/{t}/acordos/{a}.html", "html abriria como página"),
  recusado("{o}/producoes/{t}/acordos/{a}.svg", "svg abriria como página"),
  recusado("{o}/producoes/{t}/acordos/{a}.exe", "executável"),
  recusado("{o}/producoes/{t}/acordos/{a}.js", "script"),
  recusado("{o}/producoes/{t}/acordos/{a}.bin", "extensão desconhecida"),
  recusado("{o}/producoes/{t}/acordos/{a}.pdf.exe", "extensão dupla"),
  recusado("{o}/producoes/{t}/acordos/{a}.p d f", "espaço na extensão"),
  recusado("{o}/producoes/{t}/acordos/{a}.pdf ", "espaço no fim"),
  recusado("{o}/producoes/{t}/acordos/{a}.pdf?x=1", "parâmetro de URL"),
  recusado("{o}/producoes/{t}/acordos/{a}.pdf#x", "âncora de URL"),
  // Subir de pasta e outras barras.
  recusado("{o}/producoes/{t}/acordos/../pessoas/{a}.pdf", "sobe uma pasta"),
  recusado("{o}/producoes/../prestacoes/{t}/comprovantes/{a}.pdf", "sobe para a prestação"),
  recusado("{o}/producoes/{t}/./acordos/{a}.pdf", "pasta ponto"),
  recusado("{o}/producoes/{t}/acordos/%2e%2e/{a}.pdf", "ponto-ponto codificado"),
  recusado("{o}/producoes/{t}/acordos/{a}.pdf/../{a}.pdf", "sobe depois do arquivo"),
  recusado("{o}/producoes/{t}/acordos/{a}.pdf/", "barra no fim"),
  recusado("/{o}/producoes/{t}/acordos/{a}.pdf", "barra no começo"),
  recusado("{o}//producoes/{t}/acordos/{a}.pdf", "barra dupla"),
  recusado("{o}\\producoes\\{t}\\acordos\\{a}.pdf", "barras invertidas"),
  recusado(" {o}/producoes/{t}/acordos/{a}.pdf", "espaço no começo"),
  recusado("", "vazio"),
];

/** O modelo com os identificadores no lugar. */
export function expandirCaminho(modelo: string): string {
  return modelo
    .replaceAll("{o}", ORGANIZACAO).replaceAll("{t}", TEMPORADA).replaceAll("{a}", ARQUIVO)
    .replaceAll("{O}", ORGANIZACAO.toUpperCase()).replaceAll("{T}", TEMPORADA.toUpperCase()).replaceAll("{A}", ARQUIVO.toUpperCase());
}
