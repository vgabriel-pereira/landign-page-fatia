/* ═══════════════════════════════════════════
   catalog.js — Catálogo público
   Lê produtos do Firestore e monta o grid
═══════════════════════════════════════════ */

import { db } from './firebase.js';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ── Configuração ── */
const WPP_NUMBER  = "5561900000000"; // substituir pelo número real
const WPP_MSG_BASE = "Olá! Gostaria de encomendar: ";

/* ── Elementos do DOM ── */
const grid     = document.getElementById('produtos-grid');
const filtros  = document.querySelectorAll('.filtro-btn');
const lightbox = document.getElementById('lightbox');
const lbImg    = document.getElementById('lightbox-img');
const lbClose  = document.getElementById('lightbox-close');

/* ── Estado ── */
let todosOsProdutos = [];
let categoriaAtiva  = 'todos';

/* ── Inicialização ── */
document.addEventListener('DOMContentLoaded', async () => {
  await carregarProdutos();
  iniciarFiltros();
  iniciarLightbox();
});

/* ── Carregar produtos do Firestore ── */
async function carregarProdutos() {
  mostrarLoading();
  try {
    const q = query(
      collection(db, 'produtos'),
      where('disponivel', '==', true),
      orderBy('ordem', 'asc')
    );
    const snapshot = await getDocs(q);
    todosOsProdutos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderizarProdutos(todosOsProdutos);
  } catch (err) {
    console.error('Erro ao carregar produtos:', err);
    grid.innerHTML = `
      <p style="text-align:center;color:var(--ardosia);grid-column:1/-1;padding:3rem 0;">
        Não foi possível carregar o catálogo. Tente novamente em instantes.
      </p>`;
  }
}

/* ── Renderizar cards ── */
function renderizarProdutos(lista) {
  if (lista.length === 0) {
    grid.innerHTML = `
      <p style="text-align:center;color:var(--ardosia);grid-column:1/-1;padding:3rem 0;">
        Nenhum produto nesta categoria no momento. ♥
      </p>`;
    return;
  }

  grid.innerHTML = lista.map(p => `
    <article class="produto-card" data-id="${p.id}">
      <div class="produto-card__img-wrap" onclick="abrirLightbox('${p.imagemUrl}', '${escapar(p.nome)}')">
        <img
          src="${p.imagemUrl}"
          alt="${escapar(p.nome)}"
          loading="lazy"
          onerror="this.src='assets/placeholder.jpg'"
        />
        ${p.destaque
          ? `<span class="produto-card__badge">🔥 Mais pedido</span>`
          : p.disponivel === 'encomenda'
            ? `<span class="produto-card__badge encomenda">Sob encomenda</span>`
            : ''
        }
      </div>
      <div class="produto-card__body">
        <h3 class="produto-card__nome">${p.nome}</h3>
        <p class="produto-card__desc">${p.descricao || ''}</p>
        <div class="produto-card__footer">
          <span class="produto-card__cat">${p.categoria || ''}</span>
          <a
            class="produto-card__cta"
            href="${gerarLinkWpp(p.nome)}"
            target="_blank"
            rel="noopener"
            aria-label="Encomendar ${escapar(p.nome)} pelo WhatsApp"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Encomendar
          </a>
        </div>
      </div>
    </article>
  `).join('');
}

/* ── Filtros por categoria ── */
function iniciarFiltros() {
  filtros.forEach(btn => {
    btn.addEventListener('click', () => {
      filtros.forEach(b => b.classList.remove('ativo'));
      btn.classList.add('ativo');
      categoriaAtiva = btn.dataset.cat;

      const filtrados = categoriaAtiva === 'todos'
        ? todosOsProdutos
        : todosOsProdutos.filter(p => p.categoria === categoriaAtiva);

      renderizarProdutos(filtrados);
    });
  });
}

/* ── Lightbox ── */
function iniciarLightbox() {
  lbClose?.addEventListener('click', fecharLightbox);
  lightbox?.addEventListener('click', e => { if (e.target === lightbox) fecharLightbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharLightbox(); });
}

window.abrirLightbox = function(url, nome) {
  if (!lightbox || !lbImg) return;
  lbImg.src = url;
  lbImg.alt = nome;
  lightbox.classList.add('aberto');
  document.body.style.overflow = 'hidden';
};

function fecharLightbox() {
  lightbox?.classList.remove('aberto');
  document.body.style.overflow = '';
}

/* ── Helpers ── */
function gerarLinkWpp(nomeProduto) {
  const msg = encodeURIComponent(`${WPP_MSG_BASE}${nomeProduto} 🍰`);
  return `https://wa.me/${WPP_NUMBER}?text=${msg}`;
}

function escapar(str = '') {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function mostrarLoading() {
  grid.innerHTML = `<div class="produtos-grid--loading"><div class="spinner" aria-label="Carregando produtos…"></div></div>`;
}
