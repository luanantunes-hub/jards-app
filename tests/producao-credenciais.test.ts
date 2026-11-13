import assert from "node:assert/strict";
import test from "node:test";
import { formatarCodigo, lerCodigo, lerRespostaDaPorta, mensagemDaCredencial, presencaDaSessao, textoDaPorta } from "../lib/producao/credenciais";

test("código: grupos de 4 e leitura tolerante (traço, espaço, caixa), só 16 letras e números", () => {
  assert.equal(formatarCodigo("818FC8357146C13F"), "818F-C835-7146-C13F");
  assert.equal(lerCodigo(" 818f-c835 7146-c13f "), "818FC8357146C13F");
  assert.equal(lerCodigo("818FC8357146C13"), null);
  assert.equal(lerCodigo("818FC8357146C13FF"), null);
  assert.equal(lerCodigo("818FC8357146C13Z"), null, "Z não é do código: sobra 15 caracteres");
  assert.equal(lerCodigo(""), null);
});

test("resposta da porta: só as três respostas conhecidas; o resto vira null, não libera", () => {
  assert.equal(lerRespostaDaPorta(null), null);
  assert.equal(lerRespostaDaPorta([]), null);
  assert.equal(lerRespostaDaPorta({ resultado: "talvez" }), null);
  assert.equal(lerRespostaDaPorta({ resultado: 1 }), null);
  const r = lerRespostaDaPorta({ resultado: "permitido", motivo: null, nome: "Rita", afiliacao: "Jornal", tipo: "Imprensa", lugares: 2, entradas: 1, restantes: 1 });
  assert.equal(r?.resultado, "permitido");
  assert.equal(r?.restantes, 1);
});

test("textos da porta: pode entrar (e quantos faltam), já entrou e os motivos de negado", () => {
  const base = { motivo: null, nome: "Rita", afiliacao: "Jornal", tipo: "Imprensa", lugares: 2, entradas: 1, restantes: 1 };
  const ok = textoDaPorta({ ...base, resultado: "permitido" });
  assert.equal(ok.tom, "bom");
  assert.match(ok.detalhe, /Rita · Jornal \(Imprensa\)\. Ainda falta 1 pessoa/);
  assert.match(textoDaPorta({ ...base, resultado: "permitido", restantes: 0 }).detalhe, /Todos os lugares/);
  assert.match(textoDaPorta({ ...base, resultado: "permitido", restantes: 3 }).detalhe, /faltam 3 pessoas/);
  const ja = textoDaPorta({ ...base, resultado: "ja_entrou", entradas: 2, restantes: 0 });
  assert.equal(ja.tom, "atencao");
  assert.match(ja.detalhe, /Os 2 lugares deste convite já foram usados/);
  const sem = { resultado: "negado" as const, motivo: "desconhecida", nome: null, afiliacao: null, tipo: null, lugares: null, entradas: null, restantes: null };
  assert.equal(textoDaPorta(sem).tom, "ruim");
  assert.match(textoDaPorta(sem).detalhe, /não existe para esta sessão/);
  assert.match(textoDaPorta({ ...sem, motivo: "revogada", nome: "Sol" }).detalhe, /Sol foi cancelada/);
  assert.match(textoDaPorta({ ...sem, motivo: "nao_confirmado", nome: "Sol" }).detalhe, /não está confirmado/);
  assert.match(textoDaPorta({ ...sem, motivo: "qualquer" }).detalhe, /não aceita/);
});

test("presença: lugares que entraram, confirmados, e quem ainda não tem credencial", () => {
  const convidados = [
    { id: "a", quantidade: 2, situacao: "confirmado" }, { id: "b", quantidade: 1, situacao: "confirmado" },
    { id: "c", quantidade: 1, situacao: "pedido" }, { id: "d", quantidade: 4, situacao: "confirmado" },
  ];
  const credenciais = [{ convidado_id: "a", entradas: 2, revogada_em: null }, { convidado_id: "b", entradas: 0, revogada_em: "2026-12-01T10:00:00Z" }];
  assert.deepEqual(presencaDaSessao(convidados, credenciais), { entraram: 2, confirmados: 7, comCredencial: 1, semCredencial: 2 });
});

test("mensagem da credencial: primeiro nome, código em grupos e quantas pessoas", () => {
  assert.equal(mensagemDaCredencial({ nome: "Rita Souza", sessao: "Peça de abertura, 05/12", codigo: "818FC8357146C13F", lugares: 2 }),
    "Oi, Rita! Sua credencial para Peça de abertura, 05/12: 818F-C835-7146-C13F (vale para 2 pessoas). Mostre este código na entrada.");
  assert.match(mensagemDaCredencial({ nome: "Tom", sessao: "X", codigo: "0000000000000001", lugares: 1 }), /vale para 1 pessoa\)/);
  assert.equal(mensagemDaCredencial({ nome: "Rita Souza", sessao: "Peça, 05/12", codigo: "818FC8357146C13F", lugares: 2, url: "https://x.test/credencial/818FC8357146C13F" }),
    "Oi, Rita! Sua credencial para Peça, 05/12 (vale para 2 pessoas): https://x.test/credencial/818FC8357146C13F\nMostre o QR da página na entrada. Se a câmera falhar, o código é 818F-C835-7146-C13F.");
});
