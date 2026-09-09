UPDATE public.pitch_slides
SET notas = 'Organize este assunto.'
WHERE notas = 'Organize este assunto com suas próprias palavras.';

UPDATE public.pitch_cards
SET frente = regexp_replace(frente, '^Sem ler, explique: ', 'LEMBRE-SE\n\nAssunto: ')
WHERE frente LIKE 'Sem ler, explique: %';
