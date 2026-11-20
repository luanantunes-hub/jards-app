# Plugin do WordPress: Jards Ingressos

Mostra, num site WordPress, os ingressos da loja da Ticketeria. É uma casca fina: o bloco e o shortcode desenham um **iframe** de `https://jards.com.br/embed/ingressos/{chave da loja}` e um JS de 15 linhas ajusta a altura. Tudo o que importa (dados, preço, disponibilidade, compra) é do Jards; o plugin não faz chamada de rede do servidor do site.

```
integracoes/wordpress/jards-ingressos/
  jards-ingressos.php            o plugin: configurações, shortcode, bloco
  uninstall.php                  apaga as duas opções ao apagar o plugin
  readme.txt                     o texto do diretório do WordPress.org (inclui "Serviço externo")
  assets/jards-ingressos.js      ajusta a altura do iframe
  blocks/ingressos/              o bloco "Ingressos Jards" (block.json, editor.js, editor.asset.php)
```

## Gerar o zip

```bash
scripts/empacotar-plugin-wordpress.sh ~/Downloads   # imprime o caminho de jards-ingressos-<versão>.zip
```

## Antes de publicar (ainda não feito)

Este código **nunca rodou num WordPress**: foi escrito sem PHP nem WordPress na máquina. O PHP passou por um analisador de sintaxe e os testes (`tests/ticketeria-plugin-wordpress.test.ts`) conferem o texto, mas falta o teste de verdade:

1. Instale o zip num WordPress de teste (Plugins > Adicionar novo > Enviar plugin) e ative.
2. Em Configurações > Jards Ingressos, cole a chave da loja (Jards > Ingressos > Integrações).
3. Crie uma página com o bloco "Ingressos Jards" e outra com `[jards_ingressos]`; veja a lista, a altura (sem barra de rolagem) e o botão Comprar (abre em outra aba).
4. Teste uma chave errada (a configuração recusa e mantém a anterior) e o filtro `evento="..."`.
5. Ative o modo de depuração (`WP_DEBUG`) e confira que não há aviso nem erro do PHP.

## Publicar no diretório do WordPress.org (passo do dono)

1. Crie (ou use) uma conta em wordpress.org; o nome de usuário vai no campo `Contributors` do `readme.txt`.
2. Confira `Tested up to` (a versão atual do WordPress na hora) e a versão (`Version`, `JARDS_INGRESSOS_VERSION`, `Stable tag`, `editor.asset.php`: os testes exigem que sejam iguais).
3. Envie o zip em https://wordpress.org/plugins/developers/add/ . A revisão é **manual** e costuma pedir ajustes; responda pelo e-mail da revisão.
4. Aprovado, o diretório cria um repositório SVN do plugin; publique ali o conteúdo de `jards-ingressos/` em `trunk/` e uma cópia em `tags/<versão>/`.
5. Para uma versão nova: suba `Version` nos quatro lugares, acrescente ao Changelog do `readme.txt` e publique de novo.

Sem a publicação no diretório, o zip também funciona instalado à mão em qualquer site.
