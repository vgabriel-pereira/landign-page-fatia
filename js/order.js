// Fluxo local de orçamento: nenhuma escrita no Firebase ou armazenamento local.
const form = document.getElementById('form-pedido');
const tipos = new Map([['bolo', 'Bolo'], ['torta', 'Torta'], ['doces', 'Doces'], ['outro', 'Outra ideia']]);
const estilos = new Map([['sugestao', 'Quero uma sugestão'], ['simples', 'Simples e delicada'], ['tematica', 'Temática / personalizada']]);
const recebimentos = new Map([['retirada', 'Retirada'], ['entrega', 'Entrega'], ['combinar', 'A combinar']]);

function hoje() {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function texto(campo, limite) {
  const valor = campo.value.trim();
  campo.setCustomValidity(valor.length > limite || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(valor)
    ? 'Revise o texto: há caracteres inválidos ou o limite foi ultrapassado.' : '');
  return valor;
}

if (form) {
  const campo = nome => form.elements.namedItem(nome);
  const resumo = document.getElementById('pedido-resumo');
  const erro = document.getElementById('pedido-erro');
  const data = campo('data');

  function atualizar() {
    erro.hidden = true;
    const tipo = campo('tipo').value;
    const decoracao = tipo === 'bolo' || tipo === 'torta';
    const entrega = campo('recebimento').value === 'entrega';
    document.getElementById('pedido-acabamento-campo').hidden = !decoracao;
    campo('acabamento').disabled = !decoracao;
    document.getElementById('pedido-regiao-campo').hidden = !entrega;
    campo('regiao').disabled = !entrega;
    campo('regiao').required = entrega;
    campo('ideia').required = tipo === 'outro';
    document.getElementById('pedido-quantidade-label').textContent = tipo === 'doces' ? 'Quantidade de doces (unidades)' : tipo === 'bolo' || tipo === 'torta' ? 'Para quantas pessoas?' : 'Número de pessoas ou unidades';
    data.min = hoje();
    for (const nome of ['tipo', 'acabamento', 'recebimento', 'quantidade', 'data', 'ideia', 'regiao']) campo(nome).setCustomValidity('');
    if (tipo && !tipos.has(tipo)) campo('tipo').setCustomValidity('Escolha um tipo válido.');
    if (decoracao && !estilos.has(campo('acabamento').value)) campo('acabamento').setCustomValidity('Escolha um estilo válido.');
    if (campo('recebimento').value && !recebimentos.has(campo('recebimento').value)) campo('recebimento').setCustomValidity('Escolha uma forma de recebimento válida.');
    const quantidade = campo('quantidade').value;
    if (quantidade && (!/^\d+$/.test(quantidade) || Number(quantidade) < 1 || Number(quantidade) > 10000)) campo('quantidade').setCustomValidity('Informe um número inteiro entre 1 e 10000.');
    const sabor = texto(campo('sabor'), 120);
    const ideia = texto(campo('ideia'), 600);
    const regiao = texto(campo('regiao'), 100);
    if (tipo === 'outro' && !ideia) campo('ideia').setCustomValidity('Descreva a ideia do seu pedido.');
    if (entrega && !regiao) campo('regiao').setCustomValidity('Informe o bairro ou região da entrega.');
    const valorData = data.value;
    if (valorData && (!/^\d{4}-\d{2}-\d{2}$/.test(valorData) || valorData < hoje() || valorData > '9999-12-31')) data.setCustomValidity('Escolha uma data válida a partir de hoje.');
    const linhas = [
      `Tipo: ${tipos.get(tipo) || 'A escolher'}`,
      `${tipo === 'doces' ? 'Unidades' : 'Pessoas / unidades'}: ${quantidade || 'Quero uma sugestão'}`,
      `Sabores e recheios: ${sabor || 'Quero uma sugestão'}`,
      decoracao ? `Decoração: ${estilos.get(campo('acabamento').value) || 'A escolher'}` : '',
      ideia ? `Ideia e observações: ${ideia}` : '',
      `Data desejada: ${valorData ? valorData.split('-').reverse().join('/') : 'A escolher'}`,
      `Recebimento: ${recebimentos.get(campo('recebimento').value) || 'A escolher'}`,
      entrega ? `Região: ${regiao || 'A informar'}` : ''
    ].filter(Boolean);
    resumo.textContent = linhas.join('\n');
    return linhas;
  }

  form.addEventListener('input', atualizar);
  form.addEventListener('change', atualizar);
  // Desativa apenas a validação automática: submit valida novamente inclusive dados alterados por script.
  form.noValidate = true;
  form.addEventListener('submit', evento => {
    evento.preventDefault();
    const linhas = atualizar();
    if (!form.reportValidity()) return;
    try {
      // Origem e destinatário fixos; conteúdo externo só entra como parâmetro de texto.
      const destino = new URL('https://wa.me/556193166448');
      destino.searchParams.set('text', ['Olá! Gostaria de um orçamento personalizado.', '', ...linhas, '', 'Podemos confirmar o valor e a disponibilidade?'].join('\n'));
      window.location.assign(destino.href);
    } catch {
      erro.textContent = 'Não foi possível abrir o WhatsApp. Tente novamente ou use o botão de contato do site.';
      erro.hidden = false;
    }
  });
  atualizar();
  form.hidden = false;
}
