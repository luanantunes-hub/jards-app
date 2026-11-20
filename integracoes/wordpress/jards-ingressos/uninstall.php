<?php
/**
 * Ao apagar o plugin, apaga as opções que ele guardou.
 *
 * @package JardsIngressos
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'jards_ingressos_chave' );
delete_option( 'jards_ingressos_origem' );
