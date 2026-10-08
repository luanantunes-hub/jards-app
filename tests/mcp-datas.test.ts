import assert from "node:assert/strict";
import test from "node:test";
import { hojeEmSaoPaulo } from "../lib/mcp/datas";

test("a data de hoje segue o relógio de São Paulo, não o UTC", () => {
  // 02h30 UTC ainda é 23h30 do dia anterior em São Paulo.
  assert.equal(hojeEmSaoPaulo(new Date("2026-10-08T02:30:00Z")), "2026-10-07");
  assert.equal(hojeEmSaoPaulo(new Date("2026-10-08T12:00:00Z")), "2026-10-08");
  assert.equal(hojeEmSaoPaulo(new Date("2026-10-08T23:59:00Z")), "2026-10-08");
});

test("o formato é AAAA-MM-DD, o que o filtro de data do banco espera", () => {
  assert.match(hojeEmSaoPaulo(), /^\d{4}-\d{2}-\d{2}$/);
});
