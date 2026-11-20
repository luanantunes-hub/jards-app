=== Jards Ingressos ===
Contributors: jards
Tags: ingressos, eventos, tickets, ticketeria, jards
Requires at least: 5.8
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Mostre os ingressos da sua loja da Ticketeria (Jards) no seu site WordPress, com um bloco ou um shortcode.

== Description ==

O Jards Ingressos mostra, no seu site, a lista de eventos e sessões da sua loja da Ticketeria, com data, local, preço "a partir de" e o botão Comprar. A disponibilidade é a do momento: quando uma sessão esgota, o site mostra "Esgotado" sozinho.

* Um bloco do editor ("Ingressos Jards") e um shortcode (`[jards_ingressos]`).
* Mostre todos os eventos da loja ou só um (`[jards_ingressos evento="ID-DO-EVENTO"]`).
* O botão Comprar abre a página de compra do Jards em outra aba: o pagamento nunca acontece dentro do seu site e nenhum dado de cartão passa por ele.
* Usa as cores do site da sua loja no Jards.
* Sem conta de pagamento no WordPress, sem tabela nova no banco do seu site, sem rastreadores.

Você precisa de uma loja na Ticketeria (https://jards.com.br/ticketeria). A chave da loja fica em Jards > Ingressos > Integrações.

= Serviço externo =

Este plugin mostra, dentro de um iframe, uma página pública do serviço Jards (https://jards.com.br): `/embed/ingressos/{chave da loja}`. A página lista os eventos publicados da loja (nome, data, local, preço e disponibilidade). Quando o visitante abre a página, o navegador dele conecta ao Jards como em qualquer iframe, e o Jards recebe o endereço IP e os dados normais de uma visita. O plugin em si não envia nenhum dado do seu site nem dos seus visitantes ao Jards, além da chave da loja que você configurou na própria URL do iframe.

* Termos de uso: https://jards.com.br/termos
* Política de privacidade: https://jards.com.br/privacidade
* Termos de compra de ingressos: https://jards.com.br/termos-de-compra

== Installation ==

1. Envie a pasta `jards-ingressos` para `/wp-content/plugins/` ou instale pela tela de plugins do WordPress, e ative.
2. Em Configurações > Jards Ingressos, cole a chave da sua loja (Jards > Ingressos > Integrações).
3. Adicione o bloco "Ingressos Jards" a uma página, ou escreva `[jards_ingressos]` onde os ingressos devem aparecer.

== Frequently Asked Questions ==

= Onde acho a chave da loja? =

No Jards, em Ingressos > Integrações. Ela começa com `tkp_`.

= A chave é segredo? =

Não. Ela só diz de qual loja é o pedido de leitura, e só mostra o que já é público (eventos, datas, preços). Não dá acesso a vendas nem a dados de quem comprou. Se quiser, gere outra no Jards: a antiga deixa de valer na hora.

= Posso mostrar só um evento? =

Sim: `[jards_ingressos evento="ID-DO-EVENTO"]`, ou o campo "Id do evento" na barra lateral do bloco.

= Os dados do cartão passam pelo meu site? =

Não. A compra acontece na página do Jards (e o pagamento no cartão, na página segura do provedor de pagamento), em outra aba.

== Changelog ==

= 1.0.0 =
* Primeira versão: bloco, shortcode, página de configuração.
