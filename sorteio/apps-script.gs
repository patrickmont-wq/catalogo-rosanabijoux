/**
 * Sorteio Black Friday · Rosana Bijoux — recebe os cadastros da página
 * links.rosanabijoux.com/sorteio e grava na planilha.
 *
 * Como publicar: ver LEIA-ME.md, nesta mesma pasta.
 *
 * O que ele faz:
 *  - acao 'cadastro': grava uma linha na aba "Cadastros". Se o WhatsApp já
 *    estiver lá, NÃO duplica (responde ok + duplicado), porque vale um cadastro
 *    por número.
 *  - acao 'grupo': marca na linha daquele WhatsApp quando a pessoa clicou no
 *    botão do grupo VIP. Isso é o clique, não prova que ela entrou — a
 *    conferência de quem está no grupo é feita no WhatsApp, no dia do sorteio.
 */

// Fim dos cadastros, com o fuso de Brasília. null = aberto.
// Tem que ser igual ao FIM_CADASTROS (ou à DATA_SORTEIO) do CONFIG da página.
// Exemplo: '2026-11-28T20:00:00-03:00'
const FIM_CADASTROS = null;

const ABA = 'Cadastros';
const CABECALHO = [
  'Data do cadastro', 'Nome', 'WhatsApp', 'E-mail', 'Compra para',
  'Aceitou regulamento (versão)', 'Clicou no grupo VIP em',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'Página',
];
const COL_WHATS = 3;   // coluna C
const COL_GRUPO = 7;   // coluna G

function doPost(e) {
  const trava = LockService.getScriptLock();
  // dois cadastros ao mesmo tempo não podem duplicar o número; sem a trava em
  // 10 s (pico de acessos), a página pede para tentar de novo. Fica bem abaixo
  // dos 30 s que a página espera, para a resposta chegar antes dela desistir.
  if (!trava.tryLock(10000)) return resposta_({ ok: false, erro: 'ocupado' });
  try {
    const dados = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const aba = abaDeCadastros_();

    let r;
    if (dados.acao === 'cadastro') r = cadastrar_(aba, dados);
    else if (dados.acao === 'grupo') r = marcarGrupo_(aba, dados);
    else r = { ok: false, erro: 'acao desconhecida' };
    // grava de fato ANTES de soltar a trava: a próxima execução tem que ver
    // esta linha ao procurar número repetido
    SpreadsheetApp.flush();
    return resposta_(r);
  } catch (err) {
    console.error(err); // aparece em Apps Script → Execuções
    return resposta_({ ok: false, erro: 'falha' });
  } finally {
    trava.releaseLock();
  }
}

const COMPRA_PARA = { uso_proprio: 'Uso próprio', revenda: 'Revenda' };
// mesmas regras da página: DDD + celular com 9, ou fixo de 8 dígitos
const WHATSAPP_VALIDO = /^[1-9][1-9](9\d{8}|[2-5]\d{7})$/;

// Abrir a URL no navegador mostra isto — serve para testar se publicou certo.
function doGet() {
  return resposta_({ ok: true, servico: 'sorteio-black-friday' });
}

function cadastrar_(aba, d) {
  if (FIM_CADASTROS) {
    const fim = new Date(FIM_CADASTROS).getTime();
    // data escrita errada fecha (e avisa no painel) em vez de deixar aberto para sempre
    if (isNaN(fim)) { console.error('FIM_CADASTROS inválido: ' + FIM_CADASTROS); return { ok: false, erro: 'encerrado' }; }
    if (Date.now() >= fim) return { ok: false, erro: 'encerrado' };
  }

  const whatsapp = String(d.whatsapp || '').replace(/\D/g, '');
  const nome = String(d.nome || '').trim().replace(/\s+/g, ' ');
  const email = String(d.email || '').trim().toLowerCase();
  const compraPara = Object.prototype.hasOwnProperty.call(COMPRA_PARA, d.compra_para) ? COMPRA_PARA[d.compra_para] : null;

  if (!WHATSAPP_VALIDO.test(whatsapp)) return { ok: false, erro: 'whatsapp invalido' };
  if (!/\S+ \S+/.test(nome) || nome.length > 80) return { ok: false, erro: 'nome invalido' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return { ok: false, erro: 'email invalido' };
  if (!compraPara) return { ok: false, erro: 'compra_para invalido' };
  if (!d.aceite_regulamento) return { ok: false, erro: 'sem aceite' };

  if (linhaDoWhatsapp_(aba, whatsapp)) return { ok: true, duplicado: true };

  const o = d.origem || {};
  aba.appendRow([
    new Date(),
    seguro_(nome),
    "'" + whatsapp,                 // apóstrofo: a planilha não vira número nem tira o zero
    seguro_(email),
    compraPara,
    texto_(d.aceite_regulamento),
    '',
    texto_(o.utm_source), texto_(o.utm_medium), texto_(o.utm_campaign),
    texto_(o.utm_content), texto_(o.utm_term),
    seguro_(d.pagina),
  ]);
  return { ok: true };
}

function marcarGrupo_(aba, d) {
  const whatsapp = String(d.whatsapp || '').replace(/\D/g, '');
  const linha = linhaDoWhatsapp_(aba, whatsapp);
  if (!linha) return { ok: false, erro: 'cadastro nao encontrado' };
  const celula = aba.getRange(linha, COL_GRUPO);
  if (!celula.getValue()) celula.setValue(new Date()); // guarda o PRIMEIRO toque
  return { ok: true };
}

function abaDeCadastros_() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  let aba = planilha.getSheetByName(ABA);
  if (!aba) {
    aba = planilha.insertSheet(ABA);
    aba.appendRow(CABECALHO);
    aba.setFrozenRows(1);
    aba.getRange(1, 1, 1, CABECALHO.length).setFontWeight('bold');
  }
  return aba;
}

function linhaDoWhatsapp_(aba, whatsapp) {
  const ultima = aba.getLastRow();
  if (ultima < 2 || !whatsapp) return 0;
  const valores = aba.getRange(2, COL_WHATS, ultima - 1, 1).getValues();
  for (let i = 0; i < valores.length; i++) {
    if (String(valores[i][0]).replace(/\D/g, '') === whatsapp) return i + 2;
  }
  return 0;
}

// Texto que começa com = + - @ vira fórmula na planilha; o apóstrofo impede.
function seguro_(v) {
  const s = String(v == null ? '' : v).slice(0, 300);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

// Sempre texto: UTM como "2026-11-01" ou "1e5" não pode virar data ou número.
function texto_(v) {
  const s = seguro_(v);
  return s && s.charAt(0) !== "'" ? "'" + s : s;
}

function resposta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
