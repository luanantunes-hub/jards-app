-- Tipos de comprovante que a tela oferece (e que a leitura por IA sugere),
-- mas que o enum de produção não aceitava: salvar um RPA, extrato, invoice,
-- folha, guia, cartão de embarque ou print falhava no banco.
-- Só acrescenta valores; nada existente muda.

alter type public.tipo_comprovante add value if not exists 'extrato';
alter type public.tipo_comprovante add value if not exists 'invoice';
alter type public.tipo_comprovante add value if not exists 'cartao_embarque';
alter type public.tipo_comprovante add value if not exists 'print_screenshot';
alter type public.tipo_comprovante add value if not exists 'folha_pagamento';
alter type public.tipo_comprovante add value if not exists 'guia_tributo';
alter type public.tipo_comprovante add value if not exists 'rpa';
