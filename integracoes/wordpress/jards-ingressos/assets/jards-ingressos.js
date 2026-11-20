/*
 * Jards Ingressos: ajusta a altura do iframe dos ingressos. O iframe avisa a própria altura por postMessage; aqui só se aceita o aviso que vem
 * do próprio iframe e do endereço do Jards configurado (data-origem), e a altura fica entre 120 e 4000 pixels.
 */
( function () {
	'use strict';
	window.addEventListener( 'message', function ( e ) {
		var d = e.data;
		if ( ! d || d.tipo !== 'jards-ticketeria-altura' || typeof d.altura !== 'number' || ! isFinite( d.altura ) ) {
			return;
		}
		var frames = document.querySelectorAll( 'iframe.jards-ingressos' );
		for ( var i = 0; i < frames.length; i++ ) {
			if ( frames[ i ].contentWindow === e.source && frames[ i ].getAttribute( 'data-origem' ) === e.origin ) {
				frames[ i ].style.height = Math.min( Math.max( Math.round( d.altura ), 120 ), 4000 ) + 'px';
			}
		}
	} );
} )();
