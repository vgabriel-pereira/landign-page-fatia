import { db } from './firebase.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const WPP_NUMBER = '556193166448';
const grid = document.getElementById('produtos-grid');
const filtros = document.querySelector('.filtros');
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lightbox-img');
const lbClose = document.getElementById('lightbox-close');
const lbPrev = document.getElementById('lightbox-prev');
const lbNext = document.getElementById('lightbox-next');
const lbCount = document.getElementById('lightbox-count');
const CATEGORIAS_PADRAO = [['bolo', 'Bolos'], ['torta', 'Tortas'], ['doce', 'Doces'], ['aniversario', 'Aniversário'], ['casamento', 'Casamento']];
let produtos = [], categorias = [], categoriaAtiva = 'todos', galeria = [], imagemAtual = 0;

document.addEventListener('DOMContentLoaded', async () => {
  await carregar();
  lbClose?.addEventListener('click', fechar);
  lightbox?.addEventListener('click', e => { if (e.target === lightbox) fechar(); });
  lbPrev?.addEventListener('click', () => mostrarImagem(imagemAtual - 1));
  lbNext?.addEventListener('click', () => mostrarImagem(imagemAtual + 1));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') fechar();
    if (lightbox?.classList.contains('aberto') && e.key === 'ArrowLeft') mostrarImagem(imagemAtual - 1);
    if (lightbox?.classList.contains('aberto') && e.key === 'ArrowRight') mostrarImagem(imagemAtual + 1);
  });
});

async function carregar() {
  grid.innerHTML = '<div class="produtos-grid--loading"><div class="spinner"></div></div>';
  try {
    const [produtosSnapshot, categoriasSnapshot] = await Promise.all([getDocs(collection(db, 'produtos')), getDocs(collection(db, 'categorias'))]);
    produtos = produtosSnapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.disponivel === true).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    categorias = categoriasSnapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    if (!categorias.length) categorias = CATEGORIAS_PADRAO.map(([slug, nome]) => ({ slug, nome }));
    renderizarFiltros();
    renderizar(produtos);
  } catch (e) {
    console.error(e);
    grid.innerHTML = '<p class="catalogo-erro">Não foi possível carregar o catálogo. Tente novamente em instantes.</p>';
  }
}

function renderizarFiltros() {
  if (!filtros) return;
  filtros.innerHTML = `<button class="filtro-btn ativo" data-cat="todos">Todos</button>${categorias.map(c => `<button class="filtro-btn" data-cat="${esc(c.slug)}">${esc(c.nome)}</button>`).join('')}`;
  filtros.querySelectorAll('.filtro-btn').forEach(btn => btn.addEventListener('click', () => {
    categoriaAtiva = btn.dataset.cat;
    filtros.querySelectorAll('.filtro-btn').forEach(item => item.classList.toggle('ativo', item === btn));
    renderizar(categoriaAtiva === 'todos' ? produtos : produtos.filter(p => p.categoria === categoriaAtiva));
  }));
}

function renderizar(lista) {
  if (!lista.length) { grid.innerHTML = '<p class="catalogo-erro">Nenhum produto nesta categoria no momento. ♥</p>'; return; }
  grid.innerHTML = lista.map(card).join('');
  grid.querySelectorAll('[data-carrossel]').forEach(iniciarCarrossel);
}

function card(p) {
  const imgs = imagens(p), nome = esc(p.nome), slides = imgs.map((url, i) => `<img class="produto-card__slide ${i ? '' : 'ativa'}" src="${esc(url)}" alt="${nome}" loading="lazy">`).join('');
  const nav = imgs.length > 1 ? `<button class="produto-card__nav produto-card__nav--anterior" type="button" aria-label="Imagem anterior">‹</button><button class="produto-card__nav produto-card__nav--proxima" type="button" aria-label="Próxima imagem">›</button><span class="produto-card__indicadores">${imgs.map((_, i) => `<i class="produto-card__indicador ${i ? '' : 'ativo'}"></i>`).join('')}</span>` : '';
  const meta = [p.preco ? `<strong class="produto-card__preco">${esc(p.preco)}</strong>` : '', p.prazo ? `<span>Encomende com ${esc(p.prazo)}</span>` : ''].join('');
  return `<article class="produto-card"><div class="produto-card__img-wrap" data-carrossel>${slides}${nav}${p.destaque ? '<span class="produto-card__badge">Mais pedido</span>' : ''}</div><div class="produto-card__body"><h3 class="produto-card__nome">${nome}</h3><p class="produto-card__desc">${esc(p.descricao || '')}</p>${meta ? `<div class="produto-card__meta">${meta}</div>` : ''}<div class="produto-card__footer"><span class="produto-card__cat">${esc(nomeCategoria(p.categoria))}</span><a class="produto-card__cta" href="${whats(p)}" target="_blank" rel="noopener">Pedir este produto</a></div></div></article>`;
}

function iniciarCarrossel(el) { const slides = [...el.querySelectorAll('.produto-card__slide')]; let atual = 0; const trocar = i => { atual = (i + slides.length) % slides.length; slides.forEach((slide, n) => slide.classList.toggle('ativa', n === atual)); el.querySelectorAll('.produto-card__indicador').forEach((dot, n) => dot.classList.toggle('ativo', n === atual)); }; el.querySelector('.produto-card__nav--anterior')?.addEventListener('click', e => { e.stopPropagation(); trocar(atual - 1); }); el.querySelector('.produto-card__nav--proxima')?.addEventListener('click', e => { e.stopPropagation(); trocar(atual + 1); }); el.addEventListener('click', e => { if (!e.target.closest('button')) abrir(slides.map(slide => slide.src), atual, slides[atual].alt); }); }
function abrir(urls, indice, nome) { galeria = urls; imagemAtual = indice; lbImg.alt = nome; mostrarImagem(indice); lightbox.classList.add('aberto'); document.body.style.overflow = 'hidden'; }
function mostrarImagem(indice) { if (!galeria.length) return; imagemAtual = (indice + galeria.length) % galeria.length; lbImg.src = galeria[imagemAtual]; lbCount.textContent = galeria.length > 1 ? `${imagemAtual + 1} de ${galeria.length}` : ''; lbPrev.hidden = lbNext.hidden = galeria.length < 2; }
function fechar() { lightbox?.classList.remove('aberto'); document.body.style.overflow = ''; }
function imagens(p) { return (Array.isArray(p.imagensUrls) ? p.imagensUrls : [p.imagemUrl]).filter(url => typeof url === 'string' && url); }
function nomeCategoria(slug) { return categorias.find(c => c.slug === slug)?.nome || slug || ''; }
function whats(p) { const extra = [p.preco && `Preço: ${p.preco}`, p.prazo && `Prazo: ${p.prazo}`].filter(Boolean).join(' | '); return `https://wa.me/${WPP_NUMBER}?text=${encodeURIComponent(`Olá! Gostaria de pedir: ${p.nome}${extra ? ` (${extra})` : ''} 🍰`)}`; }
function esc(value = '') { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
