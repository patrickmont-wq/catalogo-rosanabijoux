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
 *    botão do grupo VIP. Isso é o clique, não prova que ela entrou.
 *  - menu "Sorteio" na planilha → "Conferir grupos VIP": lê, pela Evolution, os
 *    grupos com "VIP" no nome do WhatsApp conectado e marca em cada cadastro
 *    se a pessoa está em algum deles (e em quais). Ver o fim deste arquivo.
 */

// Fim dos cadastros, com o fuso de Brasília. null = aberto.
// Tem que ser igual ao FIM_CADASTROS (ou à DATA_SORTEIO) do CONFIG da página.
// Exemplo: '2026-11-28T20:00:00-03:00'
const FIM_CADASTROS = null;

const ABA = 'Cadastros';
const CABECALHO = [
  'Data do cadastro', 'Nome', 'WhatsApp', 'E-mail',
  'Se ganhar, vai usar para', 'Já comprou na Rosana',
  'Aceitou regulamento (versão)', 'Aceitou ofertas (versão)', 'Clicou no grupo VIP em',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'Página',
];
const COL_WHATS = CABECALHO.indexOf('WhatsApp') + 1;                // coluna C
const COL_GRUPO = CABECALHO.indexOf('Clicou no grupo VIP em') + 1;  // coluna I

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

const USO_PREMIO = { uso_proprio: 'Uso próprio', aumentar_estoque: 'Aumentar meu estoque', comecar_vender: 'Começar a vender' };
const JA_COMPROU = { nunca: 'Nunca', '1': '1 vez', '2+': '+2 vezes', '10+': '+10 vezes' };
const opcao_ = (mapa, v) => Object.prototype.hasOwnProperty.call(mapa, v) ? mapa[v] : null;
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
  const usoPremio = opcao_(USO_PREMIO, d.uso_premio);
  const jaComprou = opcao_(JA_COMPROU, d.ja_comprou);

  if (!WHATSAPP_VALIDO.test(whatsapp)) return { ok: false, erro: 'whatsapp invalido' };
  if (!/\S+ \S+/.test(nome) || nome.length > 80) return { ok: false, erro: 'nome invalido' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return { ok: false, erro: 'email invalido' };
  if (!usoPremio) return { ok: false, erro: 'uso_premio invalido' };
  if (!jaComprou) return { ok: false, erro: 'ja_comprou invalido' };
  if (!d.aceite_regulamento) return { ok: false, erro: 'sem aceite' };

  if (linhaDoWhatsapp_(aba, whatsapp)) return { ok: true, duplicado: true };

  const o = d.origem || {};
  aba.appendRow([
    new Date(),
    seguro_(nome),
    "'" + whatsapp,                 // apóstrofo: a planilha não vira número nem tira o zero
    seguro_(email),
    usoPremio,
    texto_(jaComprou),              // texto: "1 vez" e "+2 vezes" não podem virar número
    texto_(d.aceite_regulamento),
    d.aceite_ofertas ? texto_(d.aceite_ofertas) : '',  // vazio = NÃO aceitou ofertas
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
  // Aba criada por uma versão antiga do script (outras colunas): gravar nela
  // poria cada dado na coluna errada. Para — renomeie a aba antiga (ver LEIA-ME).
  const atual = aba.getRange(1, 1, 1, CABECALHO.length).getValues()[0].map(String);
  if (atual.join('|') !== CABECALHO.join('|')) {
    throw new Error('A aba "' + ABA + '" tem o cabeçalho de uma versão antiga. Renomeie-a (ex.: "Cadastros antigos") e a próxima inscrição cria a aba nova.');
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

/* ════════════════════════════════════════════════════════════════════
   CONFERIR GRUPOS VIP (no dia do sorteio)

   1. Conecte o WhatsApp que está nos grupos VIP numa instância SEPARADA da
      Evolution (QR code).
   2. Na planilha: menu Sorteio → "Configurar Evolution".
   3. Menu Sorteio → "Conferir grupos VIP": lê os grupos, mostra quais achou e
      quantos membros cada um tem, e SÓ DEPOIS de você confirmar preenche em
      Cadastros as colunas "Está no grupo VIP?" e "Grupos VIP", e reescreve a
      aba "Membros VIP". Pode rodar de novo quantas vezes quiser.
   4. Ao terminar: Sorteio → "Esquecer chave da Evolution".

   A chave fica nas Propriedades do script: NÃO aparece na planilha, mas
   qualquer EDITOR da planilha consegue vê-la em Apps Script → Configurações do
   projeto. Use só o token da instância separada — nunca a chave global.
   ════════════════════════════════════════════════════════════════════ */

const COL_NO_VIP = CABECALHO.length + 1;     // coluna P
const COL_QUAIS_VIP = CABECALHO.length + 2;  // coluna Q
const ABA_MEMBROS = 'Membros VIP';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Sorteio')
    .addItem('Conferir grupos VIP', 'conferirGruposVip')
    .addSeparator()
    .addItem('Configurar Evolution', 'configurarEvolution')
    .addItem('Esquecer chave da Evolution', 'esquecerChaveEvolution')
    .addToUi();
}

function configurarEvolution() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const campos = [
    ['EVOLUTION_URL', 'Endereço da Evolution, começando com https:// (ex.: https://evolution.seudominio.com)'],
    ['EVOLUTION_INSTANCIA', 'Nome da instância SEPARADA em que o seu WhatsApp está conectado'],
    ['EVOLUTION_CHAVE', 'Token (apikey) DESSA instância. Não use a chave global da Evolution.\nNão faça isso com a tela compartilhada: o que você digita aparece.'],
    ['FILTRO_GRUPOS', 'Texto que todo grupo VIP tem no nome (ex.: VIP)'],
  ];
  for (const [chave, pergunta] of campos) {
    const atual = props.getProperty(chave);
    const mostra = chave === 'EVOLUTION_CHAVE' && atual ? '(já configurado — deixe vazio para manter)' : (atual || '');
    const r = ui.prompt('Configurar Evolution', pergunta + '\nAtual: ' + mostra, ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return;
    const v = r.getResponseText().trim();
    if (!v) continue;
    // só https: o token vai no cabeçalho de cada chamada
    if (chave === 'EVOLUTION_URL' && !/^https:\/\/[^\s/]+/.test(v)) {
      ui.alert('O endereço precisa começar com https:// — nada foi salvo. Rode "Configurar Evolution" de novo.');
      return;
    }
    props.setProperty(chave, chave === 'EVOLUTION_URL' ? v.replace(/\/+$/, '') : v);
  }
  if (!props.getProperty('FILTRO_GRUPOS')) props.setProperty('FILTRO_GRUPOS', 'VIP');
  ui.alert('Pronto. Agora use Sorteio → Conferir grupos VIP.');
}

function esquecerChaveEvolution() {
  PropertiesService.getScriptProperties().deleteProperty('EVOLUTION_CHAVE');
  SpreadsheetApp.getUi().alert('Chave apagada do script. Apague também a instância na Evolution.');
}

function conferirGruposVip() {
  const ui = SpreadsheetApp.getUi();
  try {
    if (!cadastrosEncerrados_()) {
      const r = ui.alert('Os cadastros ainda estão abertos',
        'FIM_CADASTROS não está definido ou ainda não chegou: quem se cadastrar depois desta conferência fica com a coluna em branco. Conferir mesmo assim (teste)?',
        ui.ButtonSet.YES_NO);
      if (r !== ui.Button.YES) return;
    }
    const lido = lerGruposVip_();
    const resumo = lido.grupos.map((g) => '• ' + g.nome + ': ' + g.membros + ' membro(s)').join('\n');
    const ok = ui.alert('Confira os grupos antes de gravar',
      'Grupos com "' + lido.filtro + '" no nome:\n' + resumo +
      (lido.semNumero ? '\n\n' + lido.semNumero + ' participante(s) vieram SEM número (o WhatsApp escondeu o número): não dá para cruzar esses.' : '') +
      (lido.estrangeiros ? '\n' + lido.estrangeiros + ' número(s) de fora do Brasil ou em formato que não dá para cruzar.' : '') +
      '\n\nSão estes os grupos VIP do sorteio? (Se aparecer grupo que não é do sorteio, responda Não e use um filtro mais específico em Configurar Evolution.)',
      ui.ButtonSet.YES_NO);
    if (ok !== ui.Button.YES) return;
    const g = gravarConferencia_(lido);
    ui.alert('Conferência gravada',
      'Cadastros no VIP: ' + g.noVip + ' de ' + g.cadastros + '.\n' +
      'Coluna "Está no grupo VIP?" preenchida em Cadastros e aba "Membros VIP" atualizada.', ui.ButtonSet.OK);
  } catch (err) {
    console.error(err);
    ui.alert('Não deu para conferir', String(err && err.message || err), ui.ButtonSet.OK);
  }
}

function cadastrosEncerrados_() {
  if (!FIM_CADASTROS) return false;
  const fim = new Date(FIM_CADASTROS).getTime();
  return !isNaN(fim) && Date.now() >= fim;
}

// Só lê a Evolution; não grava nada. Qualquer resposta fora do esperado PARA
// tudo — um grupo lido pela metade marcaria NÃO em quem está nele.
function lerGruposVip_() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('EVOLUTION_URL');
  const inst = props.getProperty('EVOLUTION_INSTANCIA');
  const chave = props.getProperty('EVOLUTION_CHAVE');
  const filtro = props.getProperty('FILTRO_GRUPOS') || 'VIP';
  if (!url || !inst || !chave) throw new Error('Falta configurar: menu Sorteio → Configurar Evolution.');

  const pedir = (caminho) => {
    const resp = UrlFetchApp.fetch(url + caminho, { headers: { apikey: chave }, muteHttpExceptions: true });
    const cod = resp.getResponseCode();
    if (cod === 401 || cod === 403) throw new Error('A Evolution recusou a chave (' + cod + '). Confira em Configurar Evolution.');
    if (cod === 404) throw new Error('Não encontrado (404): confira o endereço da Evolution e o nome da instância "' + inst + '".');
    if (cod >= 300) throw new Error('A Evolution respondeu ' + cod + ': ' + resp.getContentText().slice(0, 200));
    try { return JSON.parse(resp.getContentText()); }
    catch (e) { throw new Error('A resposta não veio da API da Evolution (não é JSON). O endereço está certo?'); }
  };

  const todos = pedir('/group/fetchAllGroups/' + encodeURIComponent(inst) + '?getParticipants=false');
  if (!Array.isArray(todos)) throw new Error('Formato inesperado na lista de grupos da Evolution: ' + JSON.stringify(todos).slice(0, 200));
  const vips = todos.filter((g) => String(g.subject || '').toLowerCase().indexOf(filtro.toLowerCase()) !== -1);
  if (!vips.length) throw new Error('Nenhum grupo com "' + filtro + '" no nome. O WhatsApp conectado está nos grupos VIP?');

  const grupos = [];
  const membros = [];        // [numero, grupo, papel]
  let semNumero = 0, estrangeiros = 0;
  vips.forEach((g) => {
    const r = pedir('/group/participants/' + encodeURIComponent(inst) + '?groupJid=' + encodeURIComponent(g.id));
    const parts = r && r.participants;
    if (!Array.isArray(parts)) throw new Error('Formato inesperado nos participantes de "' + g.subject + '": ' + JSON.stringify(r).slice(0, 200));
    // a própria conta está no grupo: 0 participantes é leitura que falhou
    if (!parts.length) throw new Error('O grupo "' + g.subject + '" veio sem nenhum participante — leitura falhou, tente de novo.');
    parts.forEach((p) => {
      const num = numeroDoParticipante_(p);
      if (!num) { semNumero++; return; }
      // fora do Brasil, ou formato que não vira chave: contado, nunca some calado
      if (!/^55\d{10,11}$/.test(num) || !chavesDoParticipante_(num).length) { estrangeiros++; return; }
      membros.push([num, g.subject, p.admin ? 'admin' : '']);
    });
    grupos.push({ nome: g.subject, membros: parts.length });
  });
  return { filtro, grupos, membros, semNumero, estrangeiros };
}

function gravarConferencia_(lido) {
  const grupoDe = {};
  lido.membros.forEach(([num, grupo]) => {
    chavesDoParticipante_(num).forEach((k) => { (grupoDe[k] = grupoDe[k] || []).push(grupo); });
  });

  // ler C e gravar P/Q sob a mesma trava do formulário: nenhum cadastro entra no meio
  const trava = LockService.getScriptLock();
  trava.waitLock(30000);
  let resultado;
  try {
    const aba = abaDeCadastros_();
    const quando = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM HH:mm');
    aba.getRange(1, COL_NO_VIP, 1, 2).setValues([['Está no grupo VIP? (conferido ' + quando + ')', 'Grupos VIP']]).setFontWeight('bold');
    const ultima = aba.getLastRow();
    let noVip = 0;
    if (ultima >= 2) {
      const nums = aba.getRange(2, COL_WHATS, ultima - 1, 1).getValues();
      const saida = nums.map(([n]) => {
        const gs = grupoDe[chaveDoCadastro_(String(n))];
        if (gs) { noVip++; return ['SIM', Array.from(new Set(gs)).join(', ')]; }
        return ['NÃO', ''];
      });
      aba.getRange(2, COL_NO_VIP, saida.length, 2).setValues(saida);
    }
    SpreadsheetApp.flush();
    resultado = { noVip, cadastros: Math.max(0, ultima - 1) };
  } finally {
    trava.releaseLock();
  }

  // a aba de auditoria só muda depois que a marcação dos cadastros deu certo,
  // para as duas mostrarem sempre o mesmo retrato
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const abaM = planilha.getSheetByName(ABA_MEMBROS) || planilha.insertSheet(ABA_MEMBROS);
  abaM.clear();
  abaM.appendRow(['Número', 'Grupo', 'Papel']);
  if (lido.membros.length) abaM.getRange(2, 1, lido.membros.length, 3).setValues(lido.membros.map(([n, g, p]) => ["'" + n, g, p]));
  abaM.setFrozenRows(1);
  return resultado;
}

// O WhatsApp devolve o participante como "5511…@s.whatsapp.net" ou, quando
// esconde o número, como "…@lid" (com o número em phoneNumber, se souber).
function numeroDoParticipante_(p) {
  const cand = [p.phoneNumber, p.jid, p.id].filter(Boolean).map(String);
  for (const c of cand) {
    if (/@lid$/.test(c)) continue;
    const d = c.split('@')[0].replace(/\D/g, '');
    if (d.length >= 10) return d;
  }
  return '';
}

// Cadastro: só existe celular com 9 (11 dígitos) ou fixo (10, começa com 2–5).
function chaveDoCadastro_(n) {
  const d = String(n || '').replace(/\D/g, '');
  if (/^[1-9]{2}9\d{8}$/.test(d)) return 'C' + d.slice(0, 2) + d.slice(-8);
  if (/^[1-9]{2}[2-5]\d{7}$/.test(d)) return 'F' + d;
  return '';
}

// Participante (já com 55): o WhatsApp guarda muitos celulares antigos SEM o 9,
// e aí os 8 dígitos podem começar com qualquer algarismo — inclusive 2–5, igual
// a um fixo. Por isso um número de 8 dígitos vale nas DUAS chaves: só casaria
// errado um fixo e um celular do mesmo DDD com os mesmos 8 dígitos.
function chavesDoParticipante_(num) {
  const d = String(num).replace(/\D/g, '').replace(/^55/, '');
  if (/^[1-9]{2}9\d{8}$/.test(d)) return ['C' + d.slice(0, 2) + d.slice(-8)];
  if (/^[1-9]{2}\d{8}$/.test(d)) {
    const ks = ['C' + d.slice(0, 2) + d.slice(-8)];
    if (/^[1-9]{2}[2-5]/.test(d)) ks.push('F' + d);
    return ks;
  }
  return [];
}
