/*
 * A tela do bloco "Ingressos Jards" no editor: um quadro com o que o bloco faz e, na barra lateral, o campo do id do evento (opcional).
 * No site, o bloco sai do servidor (render_callback em jards-ingressos.php).
 */
( function ( blocks, element, blockEditor, components, i18n ) {
	var el = element.createElement;
	var __ = i18n.__;

	blocks.registerBlockType( 'jards/ingressos', {
		edit: function ( props ) {
			var evento = props.attributes.evento || '';
			return el(
				'div',
				blockEditor.useBlockProps(),
				el(
					blockEditor.InspectorControls,
					null,
					el(
						components.PanelBody,
						{ title: __( 'Evento', 'jards-ingressos' ) },
						el( components.TextControl, {
							label: __( 'Id do evento (opcional)', 'jards-ingressos' ),
							help: __( 'Deixe em branco para mostrar todos os eventos da loja.', 'jards-ingressos' ),
							value: evento,
							onChange: function ( valor ) {
								props.setAttributes( { evento: valor.trim() } );
							}
						} )
					)
				),
				el( components.Placeholder, {
					icon: 'tickets-alt',
					label: __( 'Ingressos Jards', 'jards-ingressos' ),
					instructions: evento
						? __( 'Mostra os ingressos do evento escolhido.', 'jards-ingressos' )
						: __( 'Mostra os ingressos de todos os eventos da sua loja. Eles aparecem no site, não aqui.', 'jards-ingressos' )
				} )
			);
		},
		save: function () {
			return null;
		}
	} );
} )( window.wp.blocks, window.wp.element, window.wp.blockEditor, window.wp.components, window.wp.i18n );
