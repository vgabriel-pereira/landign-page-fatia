const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { test } = require('node:test');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/order.js'), 'utf8');

// DOM mínimo: testa os handlers reais sem abrir o WhatsApp nem acessar o Firebase.
function ambiente(falharNavegacao = false) {
  const campos = Object.fromEntries(['tipo', 'quantidade', 'sabor', 'acabamento', 'ideia', 'data', 'recebimento', 'regiao'].map(nome => [nome, {
    value: nome === 'acabamento' ? 'sugestao' : '', required: ['tipo', 'data', 'recebimento'].includes(nome),
    disabled: false, erro: '', setCustomValidity(valor) { this.erro = valor; }
  }]));
  const eventos = {};
  const form = {
    elements: { namedItem: nome => campos[nome] }, hidden: true,
    addEventListener: (nome, handler) => { eventos[nome] = handler; },
    reportValidity: () => Object.values(campos).every(c => c.disabled || (!c.erro && (!c.required || c.value)))
  };
  const elementos = new Map([['form-pedido', form]]);
  for (const id of ['pedido-resumo', 'pedido-erro', 'pedido-acabamento-campo', 'pedido-regiao-campo', 'pedido-quantidade-label']) {
    const elemento = { textContent: '', hidden: false };
    Object.defineProperty(elemento, 'innerHTML', { set() { throw Error('HTML dinâmico proibido'); } });
    elementos.set(id, elemento);
  }
  let destino;
  const document = { getElementById: id => elementos.get(id) };
  class DataFixa extends Date { constructor(...args) { super(...(args.length ? args : ['2026-11-09T12:00:00-03:00'])); } }
  vm.runInNewContext(source, { document, window: { location: { assign: url => { if (falharNavegacao) throw Error('Falha simulada'); destino = url; } } }, Date: DataFixa, URL });
  return { campos, elementos, form, eventos, enviar() { eventos.submit({ preventDefault() {} }); return destino; } };
}
function valido() {
  const a = ambiente();
  a.campos.tipo.value = 'bolo'; a.campos.data.value = '2026-11-20'; a.campos.recebimento.value = 'retirada';
  return a;
}

test('inicializa sem depender do Firebase e bloqueia formulário vazio', () => {
  const a = ambiente(); assert.equal(a.form.hidden, false); assert.equal(a.enviar(), undefined);
});
test('orçamento válido monta mensagem com origem e destinatário fixos', () => {
  const a = valido(); a.campos.quantidade.value = '20';
  const url = new URL(a.enviar());
  assert.equal(url.origin, 'https://wa.me'); assert.equal(url.pathname, '/556193166448');
  assert.match(url.searchParams.get('text'), /20\/11\/2026/);
  assert.match(url.searchParams.get('text'), /Quero uma sugestão/);
});
test('entrega exige região e retirada exclui região anterior da mensagem', () => {
  const a = valido(); a.campos.recebimento.value = 'entrega';
  assert.equal(a.enviar(), undefined); assert.equal(a.campos.regiao.required, true);
  a.campos.regiao.value = 'Águas Claras'; assert.ok(a.enviar());
  a.campos.recebimento.value = 'retirada';
  assert.doesNotMatch(new URL(a.enviar()).searchParams.get('text'), /Águas Claras/);
});
test('doces oculta decoração e troca unidade; outra ideia exige descrição', () => {
  const a = valido(); a.campos.tipo.value = 'doces'; a.eventos.change();
  assert.equal(a.campos.acabamento.disabled, true);
  assert.equal(a.elementos.get('pedido-quantidade-label').textContent, 'Quantidade de doces (unidades)');
  a.campos.tipo.value = 'outro'; assert.equal(a.enviar(), undefined);
  a.campos.ideia.value = '  '; assert.equal(a.enviar(), undefined);
  a.campos.ideia.value = 'Uma mesa de sobremesas'; assert.ok(a.enviar());
});
test('bloqueia datas passadas, números inválidos, opções adulteradas e texto excessivo', () => {
  for (const [nome, valor] of [['data', '2026-11-08'], ['data', 'javascript:alert(1)'], ['quantidade', '0'], ['quantidade', '1.5'], ['quantidade', '10001'], ['tipo', '__proto__'], ['recebimento', 'https://evil.test'], ['acabamento', '<script>'], ['sabor', 'a'.repeat(121)], ['ideia', 'a'.repeat(601)], ['sabor', 'abc\u0001']]) {
    const a = valido(); a.campos[nome].value = valor; assert.equal(a.enviar(), undefined, `${nome}: ${valor}`);
  }
});
test('HTML, scripts e URLs permanecem texto literal, sem trocar o destino', () => {
  const a = valido(); const ataque = '<img src=x onerror=alert(1)> & text=novo # javascript:alert(1) https://evil.test';
  a.campos.ideia.value = ataque; a.eventos.input();
  assert.ok(a.elementos.get('pedido-resumo').textContent.includes(ataque));
  const url = new URL(a.enviar()); assert.equal(url.hostname, 'wa.me');
  assert.ok(url.searchParams.get('text').includes(ataque)); assert.equal([...url.searchParams].length, 1);
});
test('recupera validação após correção e informa falha de navegação', () => {
  const a = valido(); a.campos.quantidade.value = '-1'; assert.equal(a.enviar(), undefined);
  a.campos.quantidade.value = '10'; assert.ok(a.enviar());
  const b = ambiente(true); b.campos.tipo.value = 'bolo'; b.campos.data.value = '2026-11-20'; b.campos.recebimento.value = 'retirada';
  assert.equal(b.enviar(), undefined); assert.equal(b.elementos.get('pedido-erro').hidden, false);
  assert.match(b.elementos.get('pedido-erro').textContent, /Não foi possível/);
});
test('HTML mantém IDs únicos e referências locais existentes', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const m of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    if (m[1] && !/^(?:https?:|#)/.test(m[1])) assert.ok(fs.existsSync(path.join(root, m[1])), m[1]);
  }
  for (const m of html.matchAll(/\bfor="([^"]+)"/g)) assert.ok(ids.includes(m[1]), m[1]);
  for (const m of source.matchAll(/getElementById\('([^']+)'\)/g)) assert.ok(ids.includes(m[1]), m[1]);
});
