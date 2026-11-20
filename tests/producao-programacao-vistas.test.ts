import assert from "node:assert/strict";
import test from "node:test";
import { calendarioIcs, consultaDoFiltro, dobrarLinhaIcs, escaparIcs, filtrarProgramacao, filtroDoEndereco, momentoEmUtc, salasDaProgramacao } from "../lib/producao/programacao-vistas";
import type { DiaPublico } from "../lib/producao/programacao";

const dias: DiaPublico[] = [
  { dia: "2026-12-05", sessoes: [
    { inicio: "10:00", fim: "11:00", titulo: "Abertura", sala: "Sala Grande", marca: null },
    { inicio: "18:30", fim: "20:00", titulo: "Peça, com vírgula; e ponto", sala: "Sala 2", marca: { nome: "Banco Central", site: "https://bc.example.com", logo: null } },
  ] },
  { dia: "2026-12-06", sessoes: [{ inicio: "21:00", fim: "22:30", titulo: "Show", sala: "Sala Grande", marca: null }] },
];

test("as salas da programação saem sem repetir e em ordem natural", () => {
  assert.deepEqual(salasDaProgramacao(dias), ["Sala 2", "Sala Grande"]);
  assert.deepEqual(salasDaProgramacao([]), []);
});

test("o filtro deixa só a sala e o dia pedidos; o dia que fica vazio some; sem filtro, tudo", () => {
  assert.equal(filtrarProgramacao(dias, {}).length, 2);
  assert.deepEqual(filtrarProgramacao(dias, { sala: "Sala Grande" }).map(d => [d.dia, d.sessoes.length]), [["2026-12-05", 1], ["2026-12-06", 1]]);
  assert.deepEqual(filtrarProgramacao(dias, { sala: "Sala 2" }).map(d => d.dia), ["2026-12-05"]);
  assert.deepEqual(filtrarProgramacao(dias, { dia: "2026-12-06" }).map(d => d.dia), ["2026-12-06"]);
  assert.deepEqual(filtrarProgramacao(dias, { sala: "Sala 2", dia: "2026-12-06" }), []);
  assert.deepEqual(filtrarProgramacao(dias, { sala: "  ", dia: "" }).length, 2, "espaços contam como sem filtro");
});

test("o filtro do endereço: dia só no formato certo, sala até 80 letras, primeiro valor se vierem vários", () => {
  assert.deepEqual(filtroDoEndereco({ sala: "Sala Grande", dia: "2026-12-05" }), { sala: "Sala Grande", dia: "2026-12-05" });
  assert.deepEqual(filtroDoEndereco({ sala: ["A", "B"], dia: ["2026-12-05", "x"] }), { sala: "A", dia: "2026-12-05" });
  assert.deepEqual(filtroDoEndereco({ dia: "05/12/2026" }), { sala: "", dia: "" });
  assert.equal(filtroDoEndereco({ sala: "x".repeat(200) }).sala.length, 80);
  assert.deepEqual(filtroDoEndereco({}), { sala: "", dia: "" });
});

test("o endereço do filtro: vazio sem filtro e codificado com filtro", () => {
  assert.equal(consultaDoFiltro({}), "");
  assert.equal(consultaDoFiltro({ sala: "", dia: "" }), "");
  assert.equal(consultaDoFiltro({ sala: "Sala Grande", dia: "2026-12-05" }), "?sala=Sala+Grande&dia=2026-12-05");
});

test("a hora de Brasília vira UTC (mais três horas), passando para o dia seguinte quando cruza a meia-noite", () => {
  assert.equal(momentoEmUtc("2026-12-05", "18:30"), "20261205T213000Z");
  assert.equal(momentoEmUtc("2026-12-05", "22:00"), "20261206T010000Z");
  assert.equal(momentoEmUtc("2026-12-31", "21:30"), "20270101T003000Z");
});

test("o texto do iCal escapa barra, ponto e vírgula, vírgula e quebra de linha", () => {
  assert.equal(escaparIcs("a, b; c\\d\ne"), "a\\, b\\; c\\\\d\\ne");
});

test("as linhas do iCal têm no máximo 75 bytes, continuam com um espaço e não cortam uma letra de dois bytes", () => {
  const longa = `SUMMARY:${"ação ".repeat(40)}`;
  const dobrada = dobrarLinhaIcs(longa);
  const partes = dobrada.split("\r\n");
  assert.ok(partes.length > 1);
  for (const parte of partes) assert.ok(new TextEncoder().encode(parte).length <= 75, parte);
  assert.ok(partes.slice(1).every(parte => parte.startsWith(" ")));
  assert.equal(partes.map((parte, i) => (i === 0 ? parte : parte.slice(1))).join(""), longa, "juntando as partes volta ao texto original");
  assert.equal(dobrarLinhaIcs("curta"), "curta");
});

test("o calendário: um evento por sessão com início e fim em UTC, local, quem apresenta, e identificador fixo", () => {
  const ics = calendarioIcs({ titulo: "Em cartaz", espaco: "Teatro Central", dias, geradoEm: new Date(Date.UTC(2026, 10, 17, 12, 0, 0)) });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 3);
  assert.match(ics, /DTSTART:20261205T130000Z\r\nDTEND:20261205T140000Z/);
  assert.match(ics, /SUMMARY:Peça\\, com vírgula\\; e ponto/);
  assert.match(ics, /LOCATION:Sala Grande\\, Teatro Central/);
  assert.match(ics, /DESCRIPTION:Apresentada por Banco Central/);
  assert.match(ics, /DTSTAMP:20261117T120000Z/);
  assert.match(ics, /UID:2026-12-05-1000-sala-grande-abertura@jards\.com\.br/);
  const outra = calendarioIcs({ titulo: "Em cartaz", espaco: "Teatro Central", dias, geradoEm: new Date(Date.UTC(2027, 0, 1)) });
  assert.equal(ics.match(/UID:[^\r]+/g)?.join(), outra.match(/UID:[^\r]+/g)?.join(), "baixar de novo mantém os identificadores");
  assert.doesNotMatch(ics, /[^\r]\n/, "toda quebra de linha é CRLF");
});

test("o calendário só leva o que a programação pública já mostra: nada de nota, contato ou dinheiro", () => {
  const ics = calendarioIcs({ titulo: "Em cartaz", espaco: "Teatro Central", dias, geradoEm: new Date() });
  for (const proibido of ["notas", "telefone", "email", "valor", "https://bc.example.com"]) assert.equal(ics.includes(proibido), false, proibido);
});
