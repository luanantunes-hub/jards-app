import assert from "node:assert/strict";
import test from "node:test";
import { contatosSugeridosDoPatrocinador, rotuloContato, semContatosJaSalvos } from "../lib/contatos-sugeridos";

const responsavel = (id: string, nome: string, extra: Partial<{ email: string | null; cargo: string | null; mascarado: boolean }> = {}) => ({
  id, nome, cargo: extra.cargo ?? null, email: extra.email ?? null, linkedin_url: null, mascarado: extra.mascarado ?? false,
});
const sugestao = (id: string, nome: string, extra: Partial<{ email: string | null; responsavel_id: string | null; telefone: string | null }> = {}) => ({
  id, nome, cargo: null, email: extra.email ?? null, linkedin_url: null, telefone: extra.telefone ?? null, responsavel_id: extra.responsavel_id ?? null,
});

test("sem acesso aos contatos, nada é oferecido", () => {
  assert.deepEqual(contatosSugeridosDoPatrocinador([responsavel("r1", "Ana Souza")], [sugestao("s1", "Bia")], false), []);
});

test("responsável que o banco devolveu mascarado nunca é oferecido", () => {
  const lista = contatosSugeridosDoPatrocinador([responsavel("r1", "A** S****", { mascarado: true }), responsavel("r2", "Carla Dias")], [], true);
  assert.deepEqual(lista.map(c => c.nome), ["Carla Dias"]);
  assert.equal(lista[0].responsavel_id, "r2");
});

test("responsáveis vêm antes das sugestões da comunidade, sem repetir a mesma pessoa", () => {
  const lista = contatosSugeridosDoPatrocinador(
    [responsavel("r1", "Ana Souza", { email: "ana@empresa.com" })],
    [
      sugestao("s1", "Ana Souza", { responsavel_id: "r1" }),
      sugestao("s2", "Ana S.", { email: "ANA@empresa.com" }),
      sugestao("s3", "Bruno Lima", { telefone: "11 99999-0000" }),
    ],
    true,
  );
  assert.deepEqual(lista.map(c => c.chave), ["responsavel:r1", "sugestao:s3"]);
  assert.equal(lista[1].telefone, "11 99999-0000");
});

test("quem já está nos contatos salvos da empresa sai da sugestão", () => {
  const sugeridos = contatosSugeridosDoPatrocinador(
    [responsavel("r1", "Ana Souza"), responsavel("r2", "Carla Dias", { email: "carla@empresa.com" }), responsavel("r3", "Dênis Rocha")],
    [],
    true,
  );
  const restantes = semContatosJaSalvos(sugeridos, [
    { nome: "Outro nome", email: null, responsavel_id: "r1" },
    { nome: "Carla", email: "Carla@Empresa.com" },
    { nome: "denis  rocha", email: null },
  ]);
  assert.deepEqual(restantes, []);
});

test("rótulo mostra o cargo quando existe", () => {
  assert.equal(rotuloContato({ nome: "Ana", cargo: "Marketing" }), "Ana · Marketing");
  assert.equal(rotuloContato({ nome: "Ana", cargo: null }), "Ana");
});

test("o responsável já salvo nos contatos é reconhecido", async () => {
  const { contatoSalvoCorrespondente } = await import("../lib/contatos-sugeridos");
  const [principal] = contatosSugeridosDoPatrocinador([responsavel("r1", "Ana Souza")], [], true);
  assert.equal(contatoSalvoCorrespondente(principal, [{ id: "c9", nome: "Ana Souza", email: null, responsavel_id: "r1" }])?.id, "c9");
  assert.equal(contatoSalvoCorrespondente(principal, [{ id: "c8", nome: "Outra Pessoa", email: null }]), null);
});
