import assert from "node:assert/strict";
import test from "node:test";
import { decidirEntrada, ehDeDentro, textoDoMotivo, type EventoDoCalendario } from "../lib/reunioes/regra-do-calendario";

const instituicao = { emailDaConta: "luan@platibanda.com", emailsDosMembros: ["ana@platibanda.com", "bruno.freela@gmail.com"] };
const aberta = { emailDaConta: "luan@gmail.com", emailsDosMembros: ["luan@gmail.com", "ana@gmail.com"] };
const evento = (mudanca: Partial<EventoDoCalendario> = {}): EventoDoCalendario => ({
  id: "e1", titulo: "Reunião", diaInteiro: false, linkDeVideo: "https://meet.google.com/abc-defg-hij", minhaResposta: "aceitou",
  convidados: [{ email: "luan@platibanda.com" }, { email: "ana@platibanda.com" }], ...mudanca,
});

test("de dentro: membros da organização e o domínio da instituição; em conta aberta, só a lista de membros", () => {
  assert.equal(ehDeDentro("outra@PLATIBANDA.com", instituicao), true, "mesmo domínio, sem diferença de maiúsculas");
  assert.equal(ehDeDentro("bruno.freela@gmail.com", instituicao), true, "membro com e-mail aberto");
  assert.equal(ehDeDentro("alguem@gmail.com", instituicao), false, "gmail de quem não é membro é de fora");
  assert.equal(ehDeDentro("ana@gmail.com", aberta), true);
  assert.equal(ehDeDentro("carlos@gmail.com", aberta), false, "conta aberta: o domínio gmail não torna ninguém de dentro");
  assert.equal(ehDeDentro("x@vale.com", instituicao), false);
});

test("entra só com convidado de fora, e diz quem", () => {
  const d = decidirEntrada(evento({ convidados: [{ email: "luan@platibanda.com" }, { email: "Maria@Vale.com" }, { email: "maria@vale.com" }, { email: "joao@vale.com" }] }), instituicao);
  assert.deepEqual([d.entra, d.motivo, d.externos], [true, "tem_convidado_de_fora", ["maria@vale.com", "joao@vale.com"]]);
  assert.equal(textoDoMotivo(d), "tem convidado de fora: maria@vale.com, joao@vale.com");
  assert.equal(textoDoMotivo({ ...d, externos: ["a@x.com", "b@x.com", "c@x.com", "d@x.com"] }), "tem convidado de fora: a@x.com, b@x.com e mais 2");
});

test("não entra: só gente de dentro, sem convidados, sala do calendário, sem link, dia inteiro e convite recusado", () => {
  assert.equal(decidirEntrada(evento(), instituicao).motivo, "so_gente_de_dentro");
  assert.equal(decidirEntrada(evento({ convidados: [] }), instituicao).motivo, "sem_convidados");
  assert.equal(decidirEntrada(evento({ convidados: [{ email: "sala-3@resource.calendar.google.com", recurso: true }] }), instituicao).motivo, "sem_convidados", "a sala não é convidado");
  assert.equal(decidirEntrada(evento({ convidados: [{ email: "sala@vale.com", recurso: true }, { email: "ana@platibanda.com" }] }), instituicao).motivo, "so_gente_de_dentro");
  assert.equal(decidirEntrada(evento({ linkDeVideo: null, convidados: [{ email: "x@vale.com" }] }), instituicao).motivo, "sem_link");
  assert.equal(decidirEntrada(evento({ diaInteiro: true, convidados: [{ email: "x@vale.com" }] }), instituicao).motivo, "dia_inteiro");
  assert.equal(decidirEntrada(evento({ minhaResposta: "recusou", convidados: [{ email: "x@vale.com" }] }), instituicao).motivo, "recusou");
  for (const motivo of ["so_gente_de_dentro", "sem_convidados", "sem_link", "dia_inteiro", "recusou"] as const) assert.ok(textoDoMotivo({ entra: false, motivo, externos: [] }).length > 0);
});

test("talvez e sem resposta ainda entram (só a recusa tira a reunião)", () => {
  for (const minhaResposta of ["talvez", "sem_resposta", null] as const) {
    assert.equal(decidirEntrada(evento({ minhaResposta, convidados: [{ email: "x@vale.com" }] }), instituicao).entra, true);
  }
});
