/* ═══════════════════════════════════════════
   reviews.js — Sistema de avaliações públicas
   Exibe avaliações aprovadas + formulário de envio
═══════════════════════════════════════════ */

import { db } from './firebase.js';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ── Elementos ── */
const grid        = document.getElementById('avaliacoes-grid');
const form        = document.getElementById('form-avaliacao');
const estrelas    = document.querySelectorAll('.estrela-input');
const msgSucesso  = document.getElementById('avaliacao-sucesso');
const inputNome   = document.getElementById('av-nome');
const inputMsg    = document.getElementById('av-mensagem');
const contadorMsg = document.getElementById('contador-msg');

let estrelaSelecionada = 0;

/* ── Inicialização ── */
document.addEventListener('DOMContentLoaded', () => {
  carregarAvaliacoes();
  iniciarEstrelas();
  iniciarFormulario();
  iniciarContador();
});

/* ── Carregar avaliações aprovadas ── */
async function carregarAvaliacoes() {
  if (!grid) return;
  grid.innerHTML = `<div class="av-loading"><div class="spinner"></div></div>`;

  try {
    const q = query(
      collection(db, 'avaliacoes'),
      where('aprovada', '==', true),
      orderBy('criadaEm', 'desc')
    );
    const snapshot = await getDocs(q);
    const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    if (lista.length === 0) {
      grid.innerHTML = `<p class="av-vazio">Seja o primeiro a avaliar! ♥</p>`;
      return;
    }

    grid.innerHTML = lista.map(av => renderizarCard(av)).join('');

  } catch (err) {
    console.error('Erro ao carregar avaliações:', err);
    grid.innerHTML = `<p class="av-vazio">Não foi possível carregar as avaliações.</p>`;
  }
}

function renderizarCard(av) {
  const estrelas = renderizarEstrelas(av.estrelas);
  const data     = av.criadaEm?.toDate
    ? av.criadaEm.toDate().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : '';
  return `
    <article class="av-card">
      <div class="av-card__topo">
        <span class="av-card__estrelas" aria-label="${av.estrelas} de 5 estrelas">${estrelas}</span>
        <span class="av-card__data">${data}</span>
      </div>
      <p class="av-card__mensagem">"${escapar(av.mensagem)}"</p>
      <span class="av-card__autor">— ${escapar(av.nome)}</span>
    </article>`;
}

function renderizarEstrelas(n) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="${i < n ? 'estrela cheia' : 'estrela vazia'}" aria-hidden="true">${i < n ? '★' : '☆'}</span>`
  ).join('');
}

/* ── Seletor de estrelas interativo ── */
function iniciarEstrelas() {
  estrelas.forEach(btn => {
    btn.addEventListener('click', () => {
      estrelaSelecionada = parseInt(btn.dataset.valor);
      atualizarVisualizacaoEstrelas();
    });
    btn.addEventListener('mouseenter', () => destacarEstrelas(parseInt(btn.dataset.valor)));
    btn.addEventListener('mouseleave', () => atualizarVisualizacaoEstrelas());
  });
}

function destacarEstrelas(ate) {
  estrelas.forEach(btn => {
    btn.classList.toggle('hover', parseInt(btn.dataset.valor) <= ate);
  });
}

function atualizarVisualizacaoEstrelas() {
  estrelas.forEach(btn => {
    const val = parseInt(btn.dataset.valor);
    btn.classList.remove('hover');
    btn.classList.toggle('selecionada', val <= estrelaSelecionada);
    btn.setAttribute('aria-pressed', val <= estrelaSelecionada ? 'true' : 'false');
  });
}

/* ── Contador de caracteres ── */
function iniciarContador() {
  inputMsg?.addEventListener('input', () => {
    const n = inputMsg.value.length;
    if (contadorMsg) contadorMsg.textContent = `${n}/500`;
    contadorMsg?.classList.toggle('limite', n >= 480);
  });
}

/* ── Envio do formulário ── */
function iniciarFormulario() {
  form?.addEventListener('submit', async e => {
    e.preventDefault();

    const nome     = inputNome?.value.trim();
    const mensagem = inputMsg?.value.trim();
    const erroEl   = document.getElementById('avaliacao-erro');

    // Validações
    if (!nome) { mostrarErro(erroEl, 'Por favor, informe seu nome.'); return; }
    if (estrelaSelecionada === 0) { mostrarErro(erroEl, 'Selecione pelo menos 1 estrela.'); return; }
    if (!mensagem) { mostrarErro(erroEl, 'Escreva uma mensagem antes de enviar.'); return; }
    if (mensagem.length > 500) { mostrarErro(erroEl, 'A mensagem deve ter no máximo 500 caracteres.'); return; }

    erroEl && (erroEl.style.display = 'none');

    const btnEnviar = form.querySelector('[type="submit"]');
    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando…';

    try {
      await addDoc(collection(db, 'avaliacoes'), {
        nome,
        mensagem,
        estrelas:  estrelaSelecionada,
        aprovada:  false,           // Vai para moderação antes de aparecer
        criadaEm:  serverTimestamp()
      });

      // Mostra mensagem de sucesso e esconde o form
      form.style.display = 'none';
      msgSucesso?.classList.add('visivel');

    } catch (err) {
      console.error(err);
      mostrarErro(erroEl, 'Erro ao enviar. Tente novamente em instantes.');
      btnEnviar.disabled = false;
      btnEnviar.textContent = 'Enviar avaliação';
    }
  });
}

function mostrarErro(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

/* ── Helpers ── */
function escapar(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
