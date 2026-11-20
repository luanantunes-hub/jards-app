import assert from "node:assert/strict";
import test from "node:test";
import { diaEHoraDoEvento } from "../lib/ticketeria/pagamento/ingressos";

// A formatação das sessões do bloco de ingressos usa o mesmo "dia e hora no fuso do local" do e-mail dos ingressos: o horário que o comprador vê é o do teatro.
test("a hora da sessão no site é a do fuso do local, e a primeira letra vai em maiúscula", () => {
  const quando = diaEHoraDoEvento("2026-11-21T23:00:00.000Z", "America/Sao_Paulo");
  assert.match(quando.charAt(0).toUpperCase() + quando.slice(1), /^Sábado, 21\/11\/2026 às 20:00$/);
  assert.match(diaEHoraDoEvento("2026-11-21T23:00:00.000Z", "America/Manaus"), /19:00/);
});
