<?php
/**
 * Plugin Name:       Jards Ingressos
 * Plugin URI:        https://jards.com.br/ticketeria
 * Description:       Mostra os ingressos da sua loja da Ticketeria (Jards) no seu site WordPress, com um bloco ou um shortcode. A compra termina na página segura do Jards.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Jards
 * Author URI:        https://jards.com.br
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       jards-ingressos
 *
 * @package JardsIngressos
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'JARDS_INGRESSOS_VERSION', '1.0.0' );
define( 'JARDS_INGRESSOS_ORIGEM_PADRAO', 'https://jards.com.br' );

/**
 * A chave pública da loja é "tkp_" mais 32 letras e números minúsculos.
 *
 * @param mixed $chave Valor a conferir.
 * @return bool
 */
function jards_ingressos_chave_valida( $chave ) {
	return is_string( $chave ) && 1 === preg_match( '/^tkp_[a-f0-9]{32}$/', $chave );
}

/**
 * O id de um evento é um UUID.
 *
 * @param mixed $id Valor a conferir.
 * @return bool
 */
function jards_ingressos_evento_valido( $id ) {
	return is_string( $id ) && 1 === preg_match( '/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/', $id );
}

/**
 * O endereço do Jards tem de ser só a origem: https, um nome de site, sem usuário, senha, caminho ou parâmetros.
 *
 * @param mixed $url Valor a conferir.
 * @return bool
 */
function jards_ingressos_origem_valida( $url ) {
	if ( ! is_string( $url ) || '' === $url || strlen( $url ) > 200 ) {
		return false;
	}
	$partes = wp_parse_url( $url );
	if ( ! is_array( $partes ) || ! isset( $partes['scheme'], $partes['host'] ) || 'https' !== $partes['scheme'] ) {
		return false;
	}
	if ( isset( $partes['user'] ) || isset( $partes['pass'] ) || isset( $partes['query'] ) || isset( $partes['fragment'] ) ) {
		return false;
	}
	if ( isset( $partes['path'] ) && '' !== trim( $partes['path'], '/' ) ) {
		return false;
	}
	return 1 === preg_match( '/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i', $partes['host'] );
}

/**
 * O endereço do Jards em uso: o configurado, se for válido; senão, o padrão.
 *
 * @return string
 */
function jards_ingressos_origem() {
	$configurada = get_option( 'jards_ingressos_origem', '' );
	if ( is_string( $configurada ) && jards_ingressos_origem_valida( $configurada ) ) {
		return untrailingslashit( $configurada );
	}
	return JARDS_INGRESSOS_ORIGEM_PADRAO;
}

/**
 * Limpa a chave digitada: aceita só uma chave válida; senão, avisa e mantém a que já estava.
 *
 * @param mixed $valor Texto digitado.
 * @return string
 */
function jards_ingressos_sanitizar_chave( $valor ) {
	$valor = is_string( $valor ) ? strtolower( trim( sanitize_text_field( $valor ) ) ) : '';
	if ( '' === $valor || jards_ingressos_chave_valida( $valor ) ) {
		return $valor;
	}
	add_settings_error( 'jards_ingressos_chave', 'chave_invalida', __( 'A chave não parece certa: ela começa com tkp_ e tem 32 letras e números. Copie de novo em Jards > Ingressos > Integrações.', 'jards-ingressos' ) );
	$atual = get_option( 'jards_ingressos_chave', '' );
	return is_string( $atual ) ? $atual : '';
}

/**
 * Limpa o endereço do Jards digitado: só https e só a origem; vazio volta ao padrão.
 *
 * @param mixed $valor Texto digitado.
 * @return string
 */
function jards_ingressos_sanitizar_origem( $valor ) {
	$valor = is_string( $valor ) ? trim( sanitize_text_field( $valor ) ) : '';
	if ( '' === $valor ) {
		return '';
	}
	if ( jards_ingressos_origem_valida( $valor ) ) {
		return untrailingslashit( esc_url_raw( $valor, array( 'https' ) ) );
	}
	add_settings_error( 'jards_ingressos_origem', 'origem_invalida', __( 'O endereço do Jards tem de ser só o site, começando com https:// (por exemplo, https://jards.com.br).', 'jards-ingressos' ) );
	$atual = get_option( 'jards_ingressos_origem', '' );
	return is_string( $atual ) ? $atual : '';
}

/**
 * Registra as duas opções do plugin.
 */
function jards_ingressos_registrar_opcoes() {
	register_setting(
		'jards_ingressos',
		'jards_ingressos_chave',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'jards_ingressos_sanitizar_chave',
			'default'           => '',
		)
	);
	register_setting(
		'jards_ingressos',
		'jards_ingressos_origem',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'jards_ingressos_sanitizar_origem',
			'default'           => '',
		)
	);
}
add_action( 'admin_init', 'jards_ingressos_registrar_opcoes' );

/**
 * O item do menu Configurações.
 */
function jards_ingressos_menu() {
	add_options_page(
		__( 'Jards Ingressos', 'jards-ingressos' ),
		__( 'Jards Ingressos', 'jards-ingressos' ),
		'manage_options',
		'jards-ingressos',
		'jards_ingressos_pagina'
	);
}
add_action( 'admin_menu', 'jards_ingressos_menu' );

/**
 * A página de configuração: a chave da loja e, escondido, o endereço do Jards.
 */
function jards_ingressos_pagina() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$chave  = get_option( 'jards_ingressos_chave', '' );
	$origem = get_option( 'jards_ingressos_origem', '' );
	?>
	<div class="wrap">
		<h1><?php echo esc_html__( 'Jards Ingressos', 'jards-ingressos' ); ?></h1>
		<p><?php echo esc_html__( 'Mostre os ingressos da sua loja da Ticketeria neste site. Copie a chave da loja em Jards > Ingressos > Integrações e cole abaixo.', 'jards-ingressos' ); ?></p>
		<form method="post" action="options.php">
			<?php settings_fields( 'jards_ingressos' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="jards_ingressos_chave"><?php echo esc_html__( 'Chave da loja', 'jards-ingressos' ); ?></label></th>
					<td>
						<input name="jards_ingressos_chave" id="jards_ingressos_chave" type="text" class="regular-text code" value="<?php echo esc_attr( is_string( $chave ) ? $chave : '' ); ?>" placeholder="tkp_..." autocomplete="off" spellcheck="false" />
						<p class="description"><?php echo esc_html__( 'A chave só identifica a sua loja: não dá acesso a vendas nem a dados de quem comprou.', 'jards-ingressos' ); ?></p>
					</td>
				</tr>
			</table>
			<details>
				<summary><?php echo esc_html__( 'Avançado', 'jards-ingressos' ); ?></summary>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="jards_ingressos_origem"><?php echo esc_html__( 'Endereço do Jards', 'jards-ingressos' ); ?></label></th>
						<td>
							<input name="jards_ingressos_origem" id="jards_ingressos_origem" type="url" class="regular-text code" value="<?php echo esc_attr( is_string( $origem ) ? $origem : '' ); ?>" placeholder="<?php echo esc_attr( JARDS_INGRESSOS_ORIGEM_PADRAO ); ?>" />
							<p class="description"><?php echo esc_html__( 'Deixe em branco, a não ser que o suporte do Jards peça outro endereço.', 'jards-ingressos' ); ?></p>
						</td>
					</tr>
				</table>
			</details>
			<?php submit_button(); ?>
		</form>
		<h2><?php echo esc_html__( 'Como usar', 'jards-ingressos' ); ?></h2>
		<ul>
			<li><?php echo esc_html__( 'No editor de blocos, adicione o bloco "Ingressos Jards".', 'jards-ingressos' ); ?></li>
			<li><?php echo esc_html__( 'Ou escreva o shortcode abaixo onde os ingressos devem aparecer:', 'jards-ingressos' ); ?> <code>[jards_ingressos]</code></li>
			<li><?php echo esc_html__( 'Para mostrar só um evento, use o id dele:', 'jards-ingressos' ); ?> <code>[jards_ingressos evento="ID-DO-EVENTO"]</code></li>
		</ul>
	</div>
	<?php
}

/**
 * Um link "Configurações" na lista de plugins.
 *
 * @param array $links Links atuais.
 * @return array
 */
function jards_ingressos_links_do_plugin( $links ) {
	$link = '<a href="' . esc_url( admin_url( 'options-general.php?page=jards-ingressos' ) ) . '">' . esc_html__( 'Configurações', 'jards-ingressos' ) . '</a>';
	array_unshift( $links, $link );
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'jards_ingressos_links_do_plugin' );

/**
 * O HTML dos ingressos: um iframe da página do Jards (só dados públicos), que avisa a própria altura.
 * Sem chave configurada, só quem administra o site vê um aviso; o visitante não vê nada.
 *
 * @param string $evento Id do evento, para mostrar só ele (opcional).
 * @return string
 */
function jards_ingressos_html( $evento = '' ) {
	$chave = get_option( 'jards_ingressos_chave', '' );
	if ( ! jards_ingressos_chave_valida( $chave ) ) {
		if ( current_user_can( 'manage_options' ) ) {
			return '<p>' . esc_html__( 'Jards Ingressos: informe a chave da loja em Configurações > Jards Ingressos.', 'jards-ingressos' ) . '</p>';
		}
		return '';
	}
	$origem = jards_ingressos_origem();
	$url    = $origem . '/embed/ingressos/' . $chave;
	if ( is_string( $evento ) && jards_ingressos_evento_valido( $evento ) ) {
		$url = add_query_arg( 'evento', strtolower( $evento ), $url );
	}
	wp_enqueue_script( 'jards-ingressos', plugins_url( 'assets/jards-ingressos.js', __FILE__ ), array(), JARDS_INGRESSOS_VERSION, true );
	return sprintf(
		'<iframe class="jards-ingressos" src="%1$s" title="%2$s" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerpolicy="strict-origin" data-origem="%3$s" style="width:100%%;border:0;display:block;height:240px;background:transparent"></iframe>',
		esc_url( $url ),
		esc_attr__( 'Ingressos', 'jards-ingressos' ),
		esc_attr( $origem )
	);
}

/**
 * O shortcode [jards_ingressos evento="..."].
 *
 * @param array $atributos Atributos do shortcode.
 * @return string
 */
function jards_ingressos_shortcode( $atributos ) {
	$a = shortcode_atts( array( 'evento' => '' ), $atributos, 'jards_ingressos' );
	return jards_ingressos_html( $a['evento'] );
}
add_shortcode( 'jards_ingressos', 'jards_ingressos_shortcode' );

/**
 * O bloco "Ingressos Jards" (a tela do bloco está em blocks/ingressos; o visitante vê o mesmo HTML do shortcode).
 *
 * @param array $atributos Atributos do bloco.
 * @return string
 */
function jards_ingressos_bloco( $atributos ) {
	$evento = isset( $atributos['evento'] ) && is_string( $atributos['evento'] ) ? $atributos['evento'] : '';
	return jards_ingressos_html( $evento );
}

/**
 * Registra o bloco.
 */
function jards_ingressos_registrar_bloco() {
	register_block_type(
		__DIR__ . '/blocks/ingressos',
		array( 'render_callback' => 'jards_ingressos_bloco' )
	);
}
add_action( 'init', 'jards_ingressos_registrar_bloco' );
