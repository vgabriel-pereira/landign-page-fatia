/* ═══════════════════════════════════════════
   admin.js — Painel administrativo
   Auth + Upload + CRUD de produtos
═══════════════════════════════════════════ */

import { db, storage, auth } from './firebase.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection,
  addDoc,
  setDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

/* ════════════════════════════════════════
   MÓDULO: LOGIN
════════════════════════════════════════ */
const loginForm  = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

loginForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const email = e.target.email.value.trim();
  const senha = e.target.senha.value;
  loginError?.classList.remove('visivel');

  try {
    await signInWithEmailAndPassword(auth, email, senha);
    window.location.href = '/admin/';
  } catch (err) {
    loginError.textContent = 'E-mail ou senha incorretos.';
    loginError?.classList.add('visivel');
  }
});

/* ════════════════════════════════════════
   MÓDULO: AUTH GUARD (painel principal)
════════════════════════════════════════ */
onAuthStateChanged(auth, usuario => {
  // Na página de login, redireciona se já autenticado
  if (window.location.pathname.includes('login') && usuario) {
    window.location.href = '/admin/';
    return;
  }
  // No painel, redireciona se não autenticado
  if (!window.location.pathname.includes('login') && !usuario && document.getElementById('admin-layout')) {
    window.location.href = '/admin/login.html';
    return;
  }
  // Se autenticado e no painel, inicializa tudo
  if (usuario && document.getElementById('admin-layout')) {
    iniciarPainel(usuario);
  }
});

document.getElementById('btn-sair')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = '/admin/login.html';
});

/* ════════════════════════════════════════
   MÓDULO: PAINEL PRINCIPAL
════════════════════════════════════════ */
async function iniciarPainel(usuario) {
  await iniciarCategorias();
  await carregarProdutos();
  await carregarAvaliacoes();
  iniciarUpload();
}

/* Categorias do catálogo */
const CATEGORIAS_INICIAIS = [['bolo', 'Bolos'], ['torta', 'Tortas'], ['doce', 'Doces'], ['aniversario', 'Aniversário'], ['casamento', 'Casamento']];
let categorias = [];

async function iniciarCategorias() {
  document.getElementById('btn-nova-categoria')?.addEventListener('click', criarCategoria);
  await carregarCategorias();
}

async function carregarCategorias() {
  try {
    const snapshot = await getDocs(collection(db, 'categorias'));
    categorias = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    if (!categorias.length) {
      const produtosExistentes = await getDocs(collection(db, 'produtos'));
      // Migração de compatibilidade: só cria a lista legada quando já há catálogo.
      if (!produtosExistentes.empty) {
        await Promise.all(CATEGORIAS_INICIAIS.map(([slug, nome], ordem) => setDoc(doc(db, 'categorias', slug), { nome, slug, ordem, criadaEm: serverTimestamp() })));
        return carregarCategorias();
      }
    }
    preencherSelectCategorias();
    renderizarCategorias();
  } catch (err) {
    console.error('Erro ao carregar categorias:', err);
    mostrarToast('Não foi possível carregar as categorias.', 'erro');
  }
}

function preencherSelectCategorias() {
  const select = document.getElementById('categoria');
  if (!select) return;
  const selecionada = select.value;
  select.innerHTML = '<option value="" disabled selected>Selecione…</option>' + categorias.map(c => `<option value="${escaparAdmin(c.slug)}">${escaparAdmin(c.nome)}</option>`).join('');
  if (categorias.some(c => c.slug === selecionada)) select.value = selecionada;
}

function renderizarCategorias() {
  const lista = document.getElementById('lista-categorias');
  if (!lista) return;
  lista.innerHTML = categorias.map(c => `<div class="categoria-item"><div><div class="categoria-item__nome">${escaparAdmin(c.nome)}</div><div class="categoria-item__slug">${escaparAdmin(c.slug)}</div></div><div class="categoria-item__acoes"><button class="btn-icon" type="button" data-editar-categoria="${escaparAdmin(c.id)}" title="Editar categoria">✎</button><button class="btn-icon deletar" type="button" data-excluir-categoria="${escaparAdmin(c.id)}" data-slug="${escaparAdmin(c.slug)}" title="Excluir categoria">⌫</button></div></div>`).join('') || '<p class="categoria-vazia">Nenhuma categoria cadastrada.</p>';
  lista.querySelectorAll('[data-editar-categoria]').forEach(btn => btn.addEventListener('click', () => editarCategoria(btn.dataset.editarCategoria)));
  lista.querySelectorAll('[data-excluir-categoria]').forEach(btn => btn.addEventListener('click', () => excluirCategoria(btn.dataset.excluirCategoria, btn.dataset.slug)));
}

async function criarCategoria() {
  const nome = prompt('Nome da nova categoria:');
  if (nome === null || !nome.trim()) return;
  const slug = criarSlug(nome);
  if (!slug || categorias.some(c => c.slug === slug)) { mostrarToast('Já existe uma categoria com esse nome.', 'erro'); return; }
  try {
    await setDoc(doc(db, 'categorias', slug), { nome: nome.trim(), slug, ordem: categorias.length, criadaEm: serverTimestamp() });
    mostrarToast('Categoria criada.', 'sucesso');
    await carregarCategorias();
  } catch (err) { console.error(err); mostrarToast('Erro ao criar categoria.', 'erro'); }
}

async function editarCategoria(id) {
  const categoria = categorias.find(c => c.id === id);
  if (!categoria) return;
  const nome = prompt('Nome da categoria:', categoria.nome);
  if (nome === null || !nome.trim() || nome.trim() === categoria.nome) return;
  try {
    await updateDoc(doc(db, 'categorias', id), { nome: nome.trim() });
    mostrarToast('Categoria atualizada.', 'sucesso');
    await carregarCategorias();
    await carregarProdutos();
  } catch (err) { console.error(err); mostrarToast('Erro ao atualizar categoria.', 'erro'); }
}

async function excluirCategoria(id, slug) {
  try {
    const produtosDaCategoria = await getDocs(query(collection(db, 'produtos'), where('categoria', '==', slug)));
    if (!produtosDaCategoria.empty) { mostrarToast('Mova ou exclua os produtos desta categoria antes de removê-la.', 'erro'); return; }
    if (!confirm('Excluir esta categoria?')) return;
    await deleteDoc(doc(db, 'categorias', id));
    mostrarToast('Categoria excluída.', 'sucesso');
    await carregarCategorias();
  } catch (err) { console.error(err); mostrarToast('Erro ao excluir categoria.', 'erro'); }
}

function criarSlug(valor) { return String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function nomeCategoria(slug) { return categorias.find(c => c.slug === slug)?.nome || slug || '—'; }

/* ── Carregar lista de produtos ── */
async function carregarProdutos() {
  const lista = document.getElementById('lista-produtos');
  if (!lista) return;

  try {
    const q = query(collection(db, 'produtos'), orderBy('ordem', 'asc'));
    const snapshot = await getDocs(q);
    const produtos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Atualiza estatísticas
    document.getElementById('stat-total')?.setAttribute('data-valor', produtos.length);
    document.getElementById('stat-total') && (document.getElementById('stat-total').textContent = produtos.length);
    const ativos = produtos.filter(p => p.disponivel).length;
    document.getElementById('stat-ativos') && (document.getElementById('stat-ativos').textContent = ativos);

    // Renderiza lista
    lista.innerHTML = produtos.length === 0
      ? `<p style="padding:2rem;text-align:center;color:var(--ardosia);">Nenhum produto cadastrado ainda.</p>`
      : produtos.map(p => renderizarLinha(p)).join('');

    // Eventos dos botões de cada linha
    lista.querySelectorAll('[data-toggle]').forEach(el => {
      el.addEventListener('change', () => toggleDisponivel(el.dataset.toggle, el.checked));
    });
    lista.querySelectorAll('[data-deletar]').forEach(el => {
      el.addEventListener('click', () => confirmarExclusao(el.dataset.deletar, el.dataset.storageUrl));
    });
    lista.querySelectorAll('[data-editar]').forEach(el => el.addEventListener('click', () => editarProduto(el)));

  } catch (err) {
    console.error('Erro ao carregar lista:', err);
  }
}

function renderizarLinha(p) {
  const imagemUrl = escaparAdmin(p.imagemUrl || '');
  const nome = escaparAdmin(p.nome || '');
  const categoria = escaparAdmin(nomeCategoria(p.categoria));
  return `
    <div class="produto-row">
      <img class="produto-row__thumb" src="${imagemUrl}" alt="${nome}" onerror="this.remove()" />
      <div class="produto-row__info">
        <div class="produto-row__nome">${nome}</div>
        <div class="produto-row__cat">${categoria}</div>
      </div>
      <div class="produto-row__acoes">
        <label class="toggle" title="Disponível no catálogo">
          <input type="checkbox" data-toggle="${p.id}" ${p.disponivel ? 'checked' : ''} />
          <span class="toggle__track"></span>
        </label>
        <button class="btn-icon" data-editar="${p.id}" data-nome="${nome}" data-descricao="${escaparAdmin(p.descricao || '')}" data-preco="${escaparAdmin(p.preco || '')}" data-prazo="${escaparAdmin(p.prazo || '')}" title="Editar produto">✎</button>
        <button class="btn-icon deletar" data-deletar="${p.id}" data-storage-url="${p.storageRef || ''}" title="Excluir produto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>`;
}

async function editarProduto(botao) {
  const nome = prompt('Nome do produto:', botao.dataset.nome);
  if (nome === null || !nome.trim()) return;
  const descricao = prompt('Descrição:', botao.dataset.descricao);
  const preco = prompt('Preço a partir de (opcional):', botao.dataset.preco);
  const prazo = prompt('Prazo de encomenda (opcional):', botao.dataset.prazo);
  if (descricao === null || preco === null || prazo === null) return;
  try {
    await updateDoc(doc(db, 'produtos', botao.dataset.editar), { nome: nome.trim(), descricao: descricao.trim(), preco: preco.trim(), prazo: prazo.trim() });
    mostrarToast('Produto atualizado.', 'sucesso');
    await carregarProdutos();
  } catch (err) { console.error(err); mostrarToast('Erro ao atualizar produto.', 'erro'); }
}

/* ── Toggle disponível ── */
async function toggleDisponivel(id, valor) {
  try {
    await updateDoc(doc(db, 'produtos', id), { disponivel: valor });
    mostrarToast(valor ? 'Produto ativado no catálogo.' : 'Produto ocultado do catálogo.', 'sucesso');
  } catch (err) {
    mostrarToast('Erro ao atualizar produto.', 'erro');
  }
}

/* ── Confirmar e excluir ── */
async function confirmarExclusao(id, storageUrl) {
  if (!confirm('Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.')) return;
  try {
    await deleteDoc(doc(db, 'produtos', id));
    if (storageUrl) {
      const storageRef = ref(storage, storageUrl);
      await deleteObject(storageRef).catch(() => {}); // silencia erro se arquivo já não existe
    }
    mostrarToast('Produto excluído com sucesso.', 'sucesso');
    await carregarProdutos();
  } catch (err) {
    mostrarToast('Erro ao excluir produto.', 'erro');
  }
}

/* ════════════════════════════════════════
   MÓDULO: MODERAÇÃO DE AVALIAÇÕES
════════════════════════════════════════ */
async function carregarAvaliacoes() {
  const lista  = document.getElementById('lista-avaliacoes');
  const badge  = document.getElementById('badge-pendente');
  const statEl = document.getElementById('stat-pendentes');
  if (!lista) return;

  try {
    const q = query(collection(db, 'avaliacoes'), orderBy('criadaEm', 'desc'));
    const snapshot = await getDocs(q);
    const todas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const pendentes = todas.filter(a => !a.aprovada);

    // Atualiza badge e stat
    if (statEl) statEl.textContent = pendentes.length;
    if (badge) {
      badge.textContent = `${pendentes.length} pendente${pendentes.length !== 1 ? 's' : ''}`;
      badge.style.display = pendentes.length > 0 ? 'inline-block' : 'none';
    }

    if (todas.length === 0) {
      lista.innerHTML = `<p style="padding:2rem;text-align:center;color:var(--ardosia);">Nenhuma avaliação recebida ainda.</p>`;
      return;
    }

    lista.innerHTML = todas.map(av => renderizarLinhaAvaliacao(av)).join('');

    // Eventos
    lista.querySelectorAll('[data-aprovar]').forEach(btn => {
      btn.addEventListener('click', () => aprovarAvaliacao(btn.dataset.aprovar));
    });
    lista.querySelectorAll('[data-deletar-av]').forEach(btn => {
      btn.addEventListener('click', () => deletarAvaliacao(btn.dataset.deletarAv));
    });

  } catch (err) {
    console.error('Erro ao carregar avaliações:', err);
  }
}

function renderizarLinhaAvaliacao(av) {
  const estrelas = Array.from({ length: 5 }, (_, i) =>
    `<span style="color:${i < av.estrelas ? 'var(--dourado)' : '#ddd'}">★</span>`
  ).join('');

  const data = av.criadaEm?.toDate
    ? av.criadaEm.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  return `
    <div class="avaliacao-row ${av.aprovada ? '' : 'pendente'}">
      <span class="avaliacao-row__estrelas" aria-label="${av.estrelas} estrelas">${estrelas}</span>
      <div class="avaliacao-row__corpo">
        <div class="avaliacao-row__nome">${escaparAdmin(av.nome)} ${!av.aprovada ? '<span style="font-size:0.7rem;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:20px;font-weight:700;margin-left:6px;">Pendente</span>' : ''}</div>
        <p class="avaliacao-row__msg">${escaparAdmin(av.mensagem)}</p>
        <span class="avaliacao-row__data">${data}</span>
      </div>
      <div class="avaliacao-row__acoes">
        ${!av.aprovada ? `<button class="btn-aprovar" data-aprovar="${av.id}" title="Aprovar e publicar">✓ Aprovar</button>` : '<span style="font-size:0.75rem;color:var(--wpp);font-weight:700;">✓ Publicada</span>'}
        <button class="btn-icon deletar" data-deletar-av="${av.id}" title="Excluir avaliação">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>`;
}

async function aprovarAvaliacao(id) {
  try {
    await updateDoc(doc(db, 'avaliacoes', id), { aprovada: true });
    mostrarToast('Avaliação aprovada e publicada! ✓', 'sucesso');
    await carregarAvaliacoes();
  } catch (err) {
    mostrarToast('Erro ao aprovar avaliação.', 'erro');
  }
}

async function deletarAvaliacao(id) {
  if (!confirm('Excluir esta avaliação permanentemente?')) return;
  try {
    await deleteDoc(doc(db, 'avaliacoes', id));
    mostrarToast('Avaliação excluída.', 'sucesso');
    await carregarAvaliacoes();
  } catch (err) {
    mostrarToast('Erro ao excluir avaliação.', 'erro');
  }
}

function escaparAdmin(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ════════════════════════════════════════
   MÓDULO: UPLOAD
════════════════════════════════════════ */
function iniciarUpload() {
  const zona       = document.getElementById('upload-zona');
  const inputFile  = document.getElementById('input-foto');
  const preview    = document.getElementById('upload-preview');
  const previewImagens = document.getElementById('preview-imagens');
  const form       = document.getElementById('form-produto');
  const progressBar= document.getElementById('upload-progress');

  if (!zona || !inputFile) return;

  let arquivosSelecionados = [];

  // Clique na zona abre o seletor de arquivo (câmera no mobile)
  zona.addEventListener('click', () => inputFile.click());

  // Drag & drop
  zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('drag-over'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('drag-over'));
  zona.addEventListener('drop', e => {
    e.preventDefault();
    zona.classList.remove('drag-over');
    selecionarArquivos([...e.dataTransfer.files]);
  });

  inputFile.addEventListener('change', () => {
    selecionarArquivos([...inputFile.files]);
  });

  function selecionarArquivos(files) {
    if (!files.length) return;
    if (files.some(file => !file.type.startsWith('image/'))) {
      mostrarToast('Selecione apenas arquivos de imagem.', 'erro');
      return;
    }
    if (files.some(file => file.size > 5 * 1024 * 1024)) {
      mostrarToast('Cada imagem deve ter no máximo 5MB.', 'erro');
      return;
    }
    const existentes = new Set(arquivosSelecionados.map(file => `${file.name}-${file.size}-${file.lastModified}`));
    arquivosSelecionados = [...arquivosSelecionados, ...files.filter(file => !existentes.has(`${file.name}-${file.size}-${file.lastModified}`))];
    renderizarPreviews();
    preview?.classList.add('visivel');
    inputFile.value = '';
  }

  function renderizarPreviews() {
    previewImagens.innerHTML = arquivosSelecionados.map((file, indice) => `<div class="preview-item"><img src="${URL.createObjectURL(file)}" alt="Prévia de ${escaparAdmin(file.name)}"><button type="button" data-remover-imagem="${indice}" aria-label="Remover imagem">×</button></div>`).join('');
    previewImagens.querySelectorAll('[data-remover-imagem]').forEach(btn => btn.addEventListener('click', () => {
      arquivosSelecionados.splice(Number(btn.dataset.removerImagem), 1);
      if (arquivosSelecionados.length) renderizarPreviews(); else preview?.classList.remove('visivel');
    }));
  }

  // Submit do formulário
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!arquivosSelecionados.length) { mostrarToast('Selecione pelo menos uma foto antes de salvar.', 'erro'); return; }

    const nome      = form.nome.value.trim();
    const categoria = form.categoria.value;
    const descricao = form.descricao.value.trim();
    const preco     = form.preco.value.trim();
    const prazo     = form.prazo.value.trim();
    const destaque  = form.destaque?.checked || false;

    if (!nome || !categoria) { mostrarToast('Preencha o nome e a categoria.', 'erro'); return; }

    const btnSalvar = form.querySelector('[type="submit"]');
    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Enviando…';

    try {
      // 1. Faz upload de todas as imagens selecionadas.
      const baseNome = Date.now();
      const uploads = arquivosSelecionados.map((arquivo, indice) => new Promise((resolve, reject) => {
        const storageRef = ref(storage, `produtos/${baseNome}_${indice}_${arquivo.name}`);
        const uploadTask = uploadBytesResumable(storageRef, arquivo);
        uploadTask.on('state_changed', snapshot => {
          const pctArquivo = snapshot.bytesTransferred / snapshot.totalBytes;
          if (progressBar) progressBar.value = Math.round(((indice + pctArquivo) / arquivosSelecionados.length) * 100);
        }, reject, async () => resolve({ url: await getDownloadURL(storageRef), storageRef: storageRef.fullPath }));
      }));
      const imagens = await Promise.all(uploads);

      // 2. Salva no Firestore
      const snapshot = await getDocs(collection(db, 'produtos'));
      const ordem    = snapshot.size + 1;

      await addDoc(collection(db, 'produtos'), {
        nome,
        categoria,
        descricao,
        preco,
        prazo,
        destaque,
        // imagemUrl/storageRef mantêm compatibilidade com produtos já cadastrados.
        imagemUrl: imagens[0].url,
        imagensUrls: imagens.map(imagem => imagem.url),
        storageRef: imagens[0].storageRef,
        storageRefs: imagens.map(imagem => imagem.storageRef),
        disponivel: true,
        ordem,
        criadoEm: serverTimestamp()
      });

      mostrarToast(`"${nome}" publicado com sucesso! 🎉`, 'sucesso');
      form.reset();
      arquivosSelecionados = [];
      previewImagens.innerHTML = '';
      preview?.classList.remove('visivel');
      if (progressBar) progressBar.value = 0;
      await carregarProdutos();

    } catch (err) {
      console.error(err);
      mostrarToast('Erro ao salvar produto. Tente novamente.', 'erro');
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.textContent = 'Publicar no catálogo';
    }
  });
}

/* ════════════════════════════════════════
   UTILITÁRIO: Toast de feedback
════════════════════════════════════════ */
function mostrarToast(msg, tipo = 'sucesso') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast ${tipo} visivel`;
  setTimeout(() => toast.classList.remove('visivel'), 3500);
}

export { mostrarToast };
