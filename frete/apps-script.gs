/**
 * Simulador de frete da página de informações (links.rosanabijoux.com).
 *
 * A calculadora da loja (POST https://www.rosanabijoux.com/frete/) não deixa
 * outra página ler a resposta, e a Cloudflare da loja devolve 403 para o
 * servidor do Agente Disparo. Este script pergunta pela rede do Google e
 * devolve só a lista de opções.
 *
 * Uso: GET .../exec?cep=01310100&quantidade=52
 * Sem parâmetros: faz um teste com um CEP de São Paulo (abrir a URL no navegador).
 */

var LOJA = 'https://www.rosanabijoux.com';
// Brinco Banhado Dourado - 2 Gotas entrelaçadas riscadas (R$ 2,90): a página
// converte o valor do pedido em quantidade desta peça.
var VARIANTE = '1548776590';
var QUANTIDADE_MAXIMA = 500;
var CACHE_SEGUNDOS = 600;

function doGet(e) {
  var p = (e && e.parameter) || {};
  var teste = !p.cep && !p.quantidade;
  var cep = String(teste ? '01310100' : p.cep || '').replace(/\D/g, '');
  var quantidade = teste ? 1 : Number(p.quantidade);
  if (cep.length !== 8) return responder({ ok: false, motivo: 'cep' });
  if (!(quantidade >= 1 && quantidade <= QUANTIDADE_MAXIMA && Math.floor(quantidade) === quantidade)) {
    return responder({ ok: false, motivo: 'pedido' });
  }

  var chave = 'frete:' + cep + ':' + quantidade;
  var cache = CacheService.getScriptCache();
  var guardada = cache.get(chave);
  if (guardada) return responder(JSON.parse(guardada));

  var resultado = simular(cep, quantidade);
  if (teste) resultado.teste = true;
  if (resultado.ok || resultado.motivo === 'cep') cache.put(chave, JSON.stringify(resultado), CACHE_SEGUNDOS);
  return responder(resultado);
}

function simular(cep, quantidade) {
  var res;
  try {
    res = UrlFetchApp.fetch(LOJA + '/frete/', {
      method: 'post',
      payload: { zipcode: cep, variant_id: VARIANTE, quantity: String(quantidade) },
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
