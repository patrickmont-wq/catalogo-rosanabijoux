/**
 * Simulador de frete da página de informações (links.rosanabijoux.com).
 *
 * A calculadora da loja (POST https://www.rosanabijoux.com/frete/) não deixa
 * outra página ler a resposta, e a Cloudflare da loja devolve 403 para o
 * servidor do Agente Disparo. Este script pergunta pela rede do Google e
 * devolve só a lista de opções.
 *
 * Uso: GET .../exec?cep=01310100&valor=150
 * Sem parâmetros: faz um teste com um CEP de São Paulo (abrir a URL no navegador).
 *
 * O valor do pedido vira uma quantidade de UMA peça de referência (o peso e o
 * frete grátis saem como no carrinho). A peça é escolhida sozinha: o brinco mais
 * barato de "Todos os brincos", relido a cada 6 h — se ela for apagada ou mudar
 * de preço, o script troca. Esgotar não importa: a loja calcula o frete de peça
 * sem estoque normalmente (medido 22/10); peça APAGADA dá resultado errado.
 */

var LOJA = 'https://www.rosanabijoux.com';
var VITRINE_DA_REFERENCIA = LOJA + '/todos-os-brincos/?sort_by=price-ascending';
// Só se a vitrine não puder ser lida: Brinco 2 Gotas entrelaçadas riscadas.
var REFERENCIA_RESERVA = { variante: '1548776590', preco: 2.9 };
var QUANTIDADE_MAXIMA = 500;
var CACHE_SEGUNDOS = 600;
var CACHE_REFERENCIA_SEGUNDOS = 6 * 3600;

function doGet(e) {
  var p = (e && e.parameter) || {};
  var teste = !p.cep && !p.valor && !p.quantidade;
  var cep = String(teste ? '01310100' : p.cep || '').replace(/\D/g, '');
  if (cep.length !== 8) return responder({ ok: false, motivo: 'cep' });

  // Página antiga (antes de mandar o valor): quantidade da peça de R$ 2,90.
  var valor = teste ? 0.01 : p.valor ? Number(p.valor) : Number(p.quantidade) * 2.9;
  if (!(valor > 0 && isFinite(valor))) return responder({ ok: false, motivo: 'pedido' });

  var ref = referencia();
  var quantidade = Math.min(QUANTIDADE_MAXIMA, Math.max(1, Math.round(valor / ref.preco)));

  var chave = 'frete:' + cep + ':' + ref.variante + ':' + quantidade;
  var cache = CacheService.getScriptCache();
  var guardada = cache.get(chave);
  if (guardada) return responder(JSON.parse(guardada));

  var resultado = simular(cep, ref.variante, quantidade);
  if (teste) { resultado.teste = true; resultado.referencia = ref; }
  if (resultado.ok || resultado.motivo === 'cep') cache.put(chave, JSON.stringify(resultado), CACHE_SEGUNDOS);
  return responder(resultado);
}

/** A peça de referência: { variante, preco }. Guardada por 6 h. */
function referencia() {
  var cache = CacheService.getScriptCache();
  var guardada = cache.get('referencia');
  if (guardada) return JSON.parse(guardada);
  var ref = lerReferencia();
  // A reserva fica guardada só 10 min: a vitrine pode voltar logo.
  cache.put('referencia', JSON.stringify(ref || REFERENCIA_RESERVA), ref ? CACHE_REFERENCIA_SEGUNDOS : CACHE_SEGUNDOS);
  return ref || REFERENCIA_RESERVA;
}

/** O primeiro brinco visível, com preço, da vitrine ordenada do mais barato. */
function lerReferencia() {
  try {
    var res = UrlFetchApp.fetch(VITRINE_DA_REFERENCIA, { muteHttpExceptions: true, followRedirects: false });
    if (res.getResponseCode() !== 200) return null;
    var blocos = res.getContentText('UTF-8').match(/data-variants="[^"]*"/g) || [];
    var reserva = null;
    for (var i = 0; i < blocos.length; i++) {
      var variantes;
      try { variantes = JSON.parse(decodificar(blocos[i].slice('data-variants="'.length, -1))); } catch (err) { continue; }
      for (var j = 0; j < variantes.length; j++) {
        var v = variantes[j];
        var preco = Number(v.price_number);
        if (!v.id || v.is_visible === false || !(preco >= 1)) continue;
        var ref = { variante: String(v.id), preco: preco };
        if (v.available !== false) return ref;
        if (!reserva) reserva = ref;
      }
    }
    return reserva;
  } catch (err) {
    return null;
  }
}

function simular(cep, variante, quantidade) {
  var res;
  try {
    res = UrlFetchApp.fetch(LOJA + '/frete/', {
      method: 'post',
      payload: { zipcode: cep, variant_id: variante, quantity: String(quantidade) },
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      followRedirects: false,
      muteHttpExceptions: true,
    });
  } catch (err) {
    return { ok: false, motivo: 'indisponivel', causa: 'erro-rede' };
  }
  var status = res.getResponseCode();
  if (status !== 200) return { ok: false, motivo: 'indisponivel', causa: 'http-' + status };

  var corpo;
  try { corpo = JSON.parse(res.getContentText('UTF-8')); } catch (err) {
    return { ok: false, motivo: 'indisponivel', causa: 'nao-json' };
  }
  if (corpo && corpo.success === false && corpo.error === 'invalid-zipcode') return { ok: false, motivo: 'cep' };
  if (!corpo || corpo.success !== true || typeof corpo.html !== 'string') {
    return { ok: false, motivo: 'indisponivel', causa: 'loja-' + String((corpo && corpo.error) || 'sem-html').slice(0, 40) };
  }
  var opcoes = lerOpcoes(corpo.html);
  return opcoes.length ? { ok: true, opcoes: opcoes } : { ok: false, motivo: 'indisponivel', causa: 'sem-opcoes' };
}

/** Mesma leitura de `lib/loja/simular-frete.ts` no Agente Disparo. */
function lerOpcoes(html) {
  var opcoes = [];
  var vistos = {};
  var tags = html.match(/<input\b[^>]*>/g) || [];
  for (var i = 0; i < tags.length; i++) {
    var tag = tags[i];
    var classe = atributo(tag, 'class') || '';
    if (!/\bjs-shipping-method\b/.test(classe)) continue;
    var nomeCompleto = (atributo(tag, 'data-name') || '').trim();
    var precoBruto = (atributo(tag, 'data-price') || '').trim();
    var preco = Number(precoBruto);
    if (!nomeCompleto || !precoBruto || !isFinite(preco) || preco < 0) continue;
    var chave = atributo(tag, 'data-code') || nomeCompleto;
    if (vistos[chave]) continue;
    vistos[chave] = true;
    var corte = nomeCompleto.search(/ - (Chega|Retirada)\b(?!.* - (Chega|Retirada)\b)/);
    opcoes.push({
      nome: corte > 0 ? nomeCompleto.slice(0, corte).trim() : nomeCompleto,
      prazo: corte > 0 ? nomeCompleto.slice(corte + 3).trim() : null,
      preco: preco,
      retirada: /\bjs-pickup-option\b/.test(classe),
    });
  }
  return opcoes;
}

function atributo(tag, nome) {
  var m = tag.match(new RegExp('\\s' + nome + '="([^"]*)"'));
  return m ? decodificar(m[1]) : null;
}

function decodificar(s) {
  var entidades = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return s
    .replace(/&#(\d+);/g, function (m, n) { return Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : m; })
    .replace(/&#x([0-9a-f]+);/gi, function (m, n) { return parseInt(n, 16) <= 0x10ffff ? String.fromCodePoint(parseInt(n, 16)) : m; })
    .replace(/&([a-z]+);/gi, function (m, nome) { return entidades[nome.toLowerCase()] || m; });
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
