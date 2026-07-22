import { db } from './firebase.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const WPP_NUMBER = '556193166448';
const WPP_MSG_BASE = 'Olá! Gostaria de encomendar: ';
const grid = document.getElementById('produtos-grid');
const filtros = document.querySelectorAll('.filtro-btn');
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lightbox-img');
const lbClose = document.getElementById('lightbox-close');
let todosOsProdutos = [];

document.addEventListener('DOMContentLoaded', async () => {
  await carregarProdutos();
  iniciarFiltros();
  iniciarLightbox();
});

async function carregarProdutos() {
  mostrarLoading();
  try {
    // Sem where + orderBy: não exige índice composto no Firestore.
    const snapshot = await getDocs(collection(db, 'produtos'));
    todosOsProdutos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(produto => produto.disponivel === true)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    renderizarProdutos(todosOsProdutos);
  } catch (err) {
    console.error('Erro ao carregar produtos:', err);
    grid.innerHTML = '<p class="catalogo-erro">Não foi possível carregar o catálogo. Tente novamente em instantes.</p>';
  }
}

function renderizarProdutos(lista) {
  if (!lista.length) {
    grid.innerHTML = '<p class="catalogo-erro">Nenhum produto nesta categoria no momento. ♥</p>';
    return;
  }
  grid.innerHTML = lista.map(produto => criarCard(produto)).join('');
  iniciarCarrosseis();
}

function criarCard(p) {
  const imagens = obterImagens(p);
  const nome = escapar(p.nome);
  const slides = imagens.map((url, i) => `<img class="produto-card__slide ${i === 0 ? 'ativa' : ''}" src="${escapar(url)}" alt="${nome}" loading="lazy">`).join('');
  const controles = imagens.length > 1 ? `<button class="produto-card__nav produto-card__nav--anterior" type="button" aria-label="Imagem anterior">‹</button><button class="produto-card__nav produto-card__nav--proxima" type="button" aria-label="Próxima imagem">›</button><span class="produto-card__indicadores" aria-hidden="true">${imagens.map((_, i) => `<i class="produto-card__indicador ${i === 0 ? 'ativo' : ''}"></i>`).join('')}</span>` : '';
  const badge = p.destaque ? '<span class="produto-card__badge">Mais pedido</span>' : '';
  return `<article class="produto-card" data-id="${p.id}"><div class="produto-card__img-wrap" data-carrossel>${slides || '<span class="produto-sem-imagem">Sem imagem</span>'}${controles}${badge}</div><div class="produto-card__body"><h3 class="produto-card__nome">${nome}</h3><p class="produto-card__desc">${escapar(p.descricao || '')}</p><div class="produto-card__footer"><span class="produto-card__cat">${escapar(p.categoria || '')}</span><a class="produto-card__cta" href="${gerarLinkWpp(p.nome)}" target="_blank" rel="noopener" aria-label="Encomendar ${nome} pelo WhatsApp">Encomendar</a></div></div></article>`;
}

function iniciarFiltros() {
  filtros.forEach(btn => btn.addEventListener('click', () => {
    filtros.forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    renderizarProdutos(btn.dataset.cat === 'todos' ? todosOsProdutos : todosOsProdutos.filter(p => p.categoria === btn.dataset.cat));
  }));
}

function iniciarCarrosseis() {
  grid.querySelectorAll('[data-carrossel]').forEach(carrossel => {
    const slides = [...carrossel.querySelectorAll('.produto-card__slide')];
    if (!slides.length) return;
    let atual = 0;
    const mostrar = indice => {
      atual = (indice + slides.length) % slides.length;
      slides.forEach((slide, i) => slide.classList.toggle('ativa', i === atual));
      carrossel.querySelectorAll('.produto-card__indicador').forEach((dot, i) => dot.classList.toggle('ativo', i === atual));
    };
    carrossel.querySelector('.produto-card__nav--anterior')?.addEventListener('click', e => { e.stopPropagation(); mostrar(atual - 1); });
    carrossel.querySelector('.produto-card__nav--proxima')?.addEventListener('click', e => { e.stopPropagation(); mostrar(atual + 1); });
    carrossel.addEventListener('click', e => { if (!e.target.closest('.produto-card__nav')) abrirLightbox(slides[atual].src, slides[atual].alt); });
  });
}

function iniciarLightbox() {
  lbClose?.addEventListener('click', fecharLightbox);
  lightbox?.addEventListener('click', e => { if (e.target === lightbox) fecharLightbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharLightbox(); });
}
function abrirLightbox(url, nome) { if (lightbox && lbImg) { lbImg.src = url; lbImg.alt = nome; lightbox.classList.add('aberto'); document.body.style.overflow = 'hidden'; } }
function fecharLightbox() { lightbox?.classList.remove('aberto'); document.body.style.overflow = ''; }
function obterImagens(produto) { return (Array.isArray(produto.imagensUrls) ? produto.imagensUrls : [produto.imagemUrl]).filter(url => typeof url === 'string' && url.trim()); }
function gerarLinkWpp(nome) { return `https://wa.me/${WPP_NUMBER}?text=${encodeURIComponent(`${WPP_MSG_BASE}${nome} 🍰`)}`; }
function escapar(valor = '') { return String(valor).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function mostrarLoading() { grid.innerHTML = '<div class="produtos-grid--loading"><div class="spinner" aria-label="Carregando produtos"></div></div>'; }
