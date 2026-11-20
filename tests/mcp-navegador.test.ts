import assert from "node:assert/strict";
import test from "node:test";
import { pedidoDeNavegador } from "../lib/mcp/navegador";

test("navegador que abre o endereço é reconhecido", () => {
  assert.equal(pedidoDeNavegador("text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"), true);
  assert.equal(pedidoDeNavegador("TEXT/HTML"), true);
});

test("clientes MCP, curl e requisições sem Accept seguem recebendo o 405", () => {
  assert.equal(pedidoDeNavegador("text/event-stream"), false);
  assert.equal(pedidoDeNavegador("application/json, text/event-stream"), false);
  assert.equal(pedidoDeNavegador("text/html, text/event-stream"), false);
  assert.equal(pedidoDeNavegador("*/*"), false);
  assert.equal(pedidoDeNavegador("application/json"), false);
  assert.equal(pedidoDeNavegador(null), false);
  assert.equal(pedidoDeNavegador(""), false);
});
