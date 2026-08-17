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
  collection, addDoc, setDoc, getDocs, doc,
  updateDoc, deleteDoc, orderBy, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject
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
  const btn = loginForm.querySelector('[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Entrando…';
  try {
    await signInWithEmailAndPassword(auth, email, senha);
    window.location.href = '../admin/';
  } catch {
    loginError.textContent = 'E-mail ou senha incorretos.';
    loginError?.classList.add('visivel');
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});

/* ════════════════════════════════════════
   MÓDULO: AUTH GUARD
════════════════════════════════════════ */
onAuthStateChanged(auth, usuario => {
  const estaNoLogin = window.location.pathname.includes('login');
  if (estaNoLogin && usuario) { window.location.href = '../admin/'; return; }
  if (!estaNoLogin && !usuario && document.getElementById('admin-layout')) {
    window.location.href = '../admin/login.html'; return;
  }
  if (usuario && document.getElementById('admin-layout')) iniciarPainel();
});

document.getElementById('btn-sair')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = '../admin/login.html';
});

/* ════════════════════════════════════════
   MÓDULO: PAINEL PRINCIPAL
════════════════════════════════════════ */
async function iniciarPainel() {
  await iniciarCategorias();
  await carregarProdutos();
  await carregarAvaliacoes();
  iniciarUpload();
  iniciarModalProduto();
  iniciarModalCategoria();
  iniciarModalConfirmacao();
}

/* ════════════════════════════════════════
   UTILITÁRIO: MODAIS
════════════════════════════════════════ */

/* Modal genérico de confirmação — substitui confirm() do browser */
let _resolveConfirmacao = null;

function iniciarModalConfirmacao() {
  const modal  = document.getElementById('modal-confirmacao');
  const btnSim = document.getElementById('modal-confirmacao-sim');
  const btnNao = document.getElementById('modal-confirmacao-nao');
  if (!modal) return;
  btnSim?.addEventListener('click', () => { modal.close(); _resolveConfirmacao?.(true);  });
  btnNao?.addEventListener('click', () => { modal.close(); _resolveConfirmacao?.(false); });
  modal.addEventListener('click', e => { if (e.target === modal) { modal.close(); _resolveConfirmacao?.(false); } });
}

function confirmar({ titulo, mensagem, rotuloBotao = 'Confirmar', tipo = 'perigo' }) {
  return new Promise(resolve => {
    _resolveConfirmacao = resolve;
    const modal  = document.getElementById('modal-confirmacao');
    const tituloEl  = document.getElementById('modal-confirmacao-titulo');
    const msgEl     = document.getElementById('modal-confirmacao-msg');
    const btnSim    = document.getElementById('modal-confirmacao-sim');
    if (!modal) { resolve(window.confirm(mensagem)); return; }
    tituloEl.textContent = titulo;
    msgEl.textContent    = mensagem;
    btnSim.textContent   = rotuloBotao;
    btnSim.className     = `btn ${tipo === 'perigo' ? 'btn-perigo' : 'btn-primary'}`;
    modal.showModal();
  });
}

/* ════════════════════════════════════════
   MÓDULO: CATEGORIAS
════════════════════════════════════════ */
const CATEGORIAS_INICIAIS = [
  ['bolo','Bolos'], ['torta','Tortas'], ['doce','Doces'],
  ['aniversario','Aniversário'], ['casamento','Casamento']
];
let categorias = [];

async function iniciarCategorias() {
  document.getElementById('btn-nova-categoria')?.addEventListener('click', () => abrirModalCategoria());
  await carregarCategorias();
}

async function carregarCategorias() {
  try {
    const snap = await getDocs(collection(db, 'categorias'));
    categorias = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    if (!categorias.length) {
      const prodExist = await getDocs(collection(db, 'produtos'));
      if (!prodExist.empty) {
        await Promise.all(CATEGORIAS_INICIAIS.map(([slug, nome], ordem) =>
          setDoc(doc(db, 'categorias', slug), { nome, slug, ordem, criadaEm: serverTimestamp() })));
        return carregarCategorias();
      }
    }
    preencherSelectCategorias();
    renderizarCategorias();
  } catch (err) {
    console.error(err);
    mostrarToast('Não foi possível carregar as categorias.', 'erro');
  }
}

function preencherSelectCategorias() {
  ['categoria', 'editar-categoria'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const atual = sel.value;
    const placeholder = id === 'categoria'
      ? '<option value="" disabled selected>Selecione…</option>'
      : '<option value="" disabled>Selecione…</option>';
    sel.innerHTML = placeholder + categorias.map(c =>
      `<option value="${esc(c.slug)}">${esc(c.nome)}</option>`).join('');
    if (categorias.some(c => c.slug === atual)) sel.value = atual;
  });
}

function renderizarCategorias() {
  const lista = document.getElementById('lista-categorias');
  if (!lista) return;
  lista.innerHTML = categorias.map(c => `
    <div class="categoria-item">
      <div>
        <div class="categoria-item__nome">${esc(c.nome)}</div>
        <div class="categoria-item__slug">${esc(c.slug)}</div>
      </div>
      <div class="categoria-item__acoes">
        <button class="btn-icon" type="button" data-editar-cat="${esc(c.id)}" title="Editar categoria">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon deletar" type="button" data-excluir-cat="${esc(c.id)}" data-slug="${esc(c.slug)}" title="Excluir categoria">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`).join('') || '<p class="categoria-vazia">Nenhuma categoria cadastrada.</p>';

  lista.querySelectorAll('[data-editar-cat]').forEach(btn =>
    btn.addEventListener('click', () => abrirModalCategoria(btn.dataset.editarCat)));
  lista.querySelectorAll('[data-excluir-cat]').forEach(btn =>
    btn.addEventListener('click', () => excluirCategoria(btn.dataset.excluirCat, btn.dataset.slug)));
}

/* Modal de categoria — cria e edita */
function iniciarModalCategoria() {
  const modal  = document.getElementById('modal-categoria');
  const form   = document.getElementById('form-categoria');
  const fechar = () => modal?.close();
  document.getElementById('btn-fechar-categoria')?.addEventListener('click', fechar);
  document.getElementById('btn-cancelar-categoria')?.addEventListener('click', fechar);
  modal?.addEventListener('click', e => { if (e.target === modal) fechar(); });
  form?.addEventListener('submit', salvarCategoria);
}

function abrirModalCategoria(id = null) {
  const modal  = document.getElementById('modal-categoria');
  const titulo = document.getElementById('modal-categoria-titulo');
  const inputId   = document.getElementById('cat-id');
  const inputNome = document.getElementById('cat-nome');
  if (!modal) return;
  if (id) {
    const cat = categorias.find(c => c.id === id);
    if (!cat) return;
    titulo.textContent   = 'Editar categoria';
    inputId.value        = cat.id;
    inputNome.value      = cat.nome;
  } else {
    titulo.textContent   = 'Nova categoria';
    inputId.value        = '';
    inputNome.value      = '';
  }
  modal.showModal();
  inputNome.focus();
}

async function salvarCategoria(e) {
  e.preventDefault();
  const id   = document.getElementById('cat-id').value;
  const nome = document.getElementById('cat-nome').value.trim();
  if (!nome) { mostrarToast('Informe um nome para a categoria.', 'erro'); return; }
  const btn = e.currentTarget.querySelector('[type="submit"]');
  btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (id) {
      await updateDoc(doc(db, 'categorias', id), { nome });
      mostrarToast('Categoria atualizada.', 'sucesso');
    } else {
      const slug = criarSlug(nome);
      if (!slug || categorias.some(c => c.slug === slug)) {
        mostrarToast('Já existe uma categoria com esse nome.', 'erro');
        btn.disabled = false; btn.textContent = 'Salvar';
        return;
      }
      await setDoc(doc(db, 'categorias', slug), { nome, slug, ordem: categorias.length, criadaEm: serverTimestamp() });
      mostrarToast('Categoria criada.', 'sucesso');
    }
    document.getElementById('modal-categoria')?.close();
    await carregarCategorias();
    await carregarProdutos();
  } catch (err) {
    console.error(err);
    mostrarToast('Erro ao salvar categoria.', 'erro');
  } finally {
    btn.disabled = false; btn.textContent = 'Salvar';
  }
}

async function excluirCategoria(id, slug) {
  const temProdutos = await getDocs(query(collection(db, 'produtos'), where('categoria', '==', slug)));
  if (!temProdutos.empty) {
    mostrarToast('Mova ou exclua os produtos desta categoria antes de removê-la.', 'erro'); return;
  }
  const ok = await confirmar({
    titulo: 'Excluir categoria',
    mensagem: `Tem certeza que deseja excluir a categoria "${categorias.find(c=>c.id===id)?.nome}"?`,
    rotuloBotao: 'Excluir'
  });
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'categorias', id));
    mostrarToast('Categoria excluída.', 'sucesso');
    await carregarCategorias();
  } catch { mostrarToast('Erro ao excluir categoria.', 'erro'); }
}

/* ════════════════════════════════════════
   MÓDULO: PRODUTOS — lista
════════════════════════════════════════ */
async function carregarProdutos() {
  const lista = document.getElementById('lista-produtos');
  if (!lista) return;
  try {
    const snap = await getDocs(query(collection(db, 'produtos'), orderBy('ordem', 'asc')));
    const produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    document.getElementById('stat-total') && (document.getElementById('stat-total').textContent = produtos.length);
    document.getElementById('stat-ativos') && (document.getElementById('stat-ativos').textContent = produtos.filter(p => p.disponivel).length);
    lista.innerHTML = produtos.length === 0
      ? `<p style="padding:2rem;text-align:center;color:var(--ardosia);">Nenhum produto cadastrado ainda.</p>`
      : produtos.map(renderizarLinha).join('');
    lista.querySelectorAll('[data-toggle]').forEach(el =>
      el.addEventListener('change', () => toggleDisponivel(el.dataset.toggle, el.checked)));
    lista.querySelectorAll('[data-editar]').forEach(el =>
      el.addEventListener('click', () => abrirModalEditarProduto(el)));
    lista.querySelectorAll('[data-deletar]').forEach(el =>
      el.addEventListener('click', () => excluirProduto(el.dataset.deletar, el.dataset.storageRefs)));
  } catch (err) { console.error('Erro ao carregar lista:', err); }
}

function renderizarLinha(p) {
  return `
    <div class="produto-row">
      <img class="produto-row__thumb" src="${esc(p.imagemUrl||'')}" alt="${esc(p.nome||'')}" onerror="this.remove()" />
      <div class="produto-row__info">
        <div class="produto-row__nome">${esc(p.nome||'')}</div>
        <div class="produto-row__cat">${esc(nomeCategoria(p.categoria))}</div>
      </div>
      <div class="produto-row__acoes">
        <label class="toggle" title="${p.disponivel ? 'Visível no catálogo' : 'Oculto do catálogo'}">
          <input type="checkbox" data-toggle="${p.id}" ${p.disponivel ? 'checked' : ''} />
          <span class="toggle__track"></span>
        </label>
        <button class="btn-icon" type="button"
          data-editar="${p.id}"
          data-nome="${esc(p.nome||'')}"
          data-categoria="${esc(p.categoria||'')}"
          data-descricao="${esc(p.descricao||'')}"
          data-preco="${esc(p.preco||'')}"
          data-prazo="${esc(p.prazo||'')}"
          data-destaque="${p.destaque ? '1' : ''}"
          title="Editar produto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon deletar" type="button"
          data-deletar="${p.id}"
          data-storage-refs="${esc(JSON.stringify(p.storageRefs||[p.storageRef||'']))}"
          title="Excluir produto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`;
}

async function toggleDisponivel(id, valor) {
  try {
    await updateDoc(doc(db, 'produtos', id), { disponivel: valor });
    mostrarToast(valor ? 'Produto visível no catálogo.' : 'Produto ocultado do catálogo.', 'sucesso');
  } catch { mostrarToast('Erro ao atualizar produto.', 'erro'); }
}

async function excluirProduto(id, storageRefsJson) {
  const ok = await confirmar({
    titulo: 'Excluir produto',
    mensagem: 'Esta ação remove o produto e todas as fotos permanentemente. Não é possível desfazer.',
    rotuloBotao: 'Excluir produto'
  });
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'produtos', id));
    try {
      const refs = JSON.parse(storageRefsJson || '[]');
      await Promise.all(refs.filter(Boolean).map(r => deleteObject(ref(storage, r)).catch(() => {})));
    } catch {}
    mostrarToast('Produto excluído.', 'sucesso');
    await carregarProdutos();
  } catch { mostrarToast('Erro ao excluir produto.', 'erro'); }
}

/* ════════════════════════════════════════
   MÓDULO: EDIÇÃO DE PRODUTO (modal)
════════════════════════════════════════ */
function iniciarModalProduto() {
  const modal  = document.getElementById('modal-editar-produto');
  const form   = document.getElementById('form-editar-produto');
  const fechar = () => modal?.close();
  document.getElementById('btn-fechar-edicao')?.addEventListener('click', fechar);
  document.getElementById('btn-cancelar-edicao')?.addEventListener('click', fechar);
  modal?.addEventListener('click', e => { if (e.target === modal) fechar(); });
  form?.addEventListener('submit', salvarEdicaoProduto);
}

function abrirModalEditarProduto(btn) {
  const modal = document.getElementById('modal-editar-produto');
  if (!modal) return;
  document.getElementById('editar-produto-id').value  = btn.dataset.editar;
  document.getElementById('editar-nome').value        = btn.dataset.nome || '';
  document.getElementById('editar-descricao').value   = btn.dataset.descricao || '';
  document.getElementById('editar-preco').value       = btn.dataset.preco || '';
  document.getElementById('editar-prazo').value       = btn.dataset.prazo || '';
  document.getElementById('editar-destaque').checked  = btn.dataset.destaque === '1';
  preencherSelectCategorias();
  const selCat = document.getElementById('editar-categoria');
  if (selCat) selCat.value = btn.dataset.categoria || '';
  modal.showModal();
  document.getElementById('editar-nome').focus();
}

async function salvarEdicaoProduto(e) {
  e.preventDefault();
  const id        = document.getElementById('editar-produto-id').value;
  const nome      = document.getElementById('editar-nome').value.trim();
  const categoria = document.getElementById('editar-categoria').value;
  const descricao = document.getElementById('editar-descricao').value.trim();
  const preco     = document.getElementById('editar-preco').value.trim();
  const prazo     = document.getElementById('editar-prazo').value.trim();
  const destaque  = document.getElementById('editar-destaque').checked;
  if (!id || !nome || !categoria) { mostrarToast('Preencha o nome e a categoria.', 'erro'); return; }
  const btn = e.currentTarget.querySelector('[type="submit"]');
  btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    await updateDoc(doc(db, 'produtos', id), { nome, categoria, descricao, preco, prazo, destaque });
    document.getElementById('modal-editar-produto')?.close();
    mostrarToast('Produto atualizado.', 'sucesso');
    await carregarProdutos();
  } catch (err) {
    console.error(err);
    mostrarToast('Erro ao atualizar produto.', 'erro');
  } finally {
    btn.disabled = false; btn.textContent = 'Salvar alterações';
  }
}

/* ════════════════════════════════════════
   MÓDULO: UPLOAD
════════════════════════════════════════ */
function iniciarUpload() {
  const zona          = document.getElementById('upload-zona');
  const inputFile     = document.getElementById('input-foto');
  const preview       = document.getElementById('upload-preview');
  const previewImgs   = document.getElementById('preview-imagens');
  const form          = document.getElementById('form-produto');
  const progressBar   = document.getElementById('upload-progress');
  if (!zona || !inputFile) return;

  let arquivos = [];

  zona.addEventListener('click', () => inputFile.click());
  zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('drag-over'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('drag-over'));
  zona.addEventListener('drop', e => { e.preventDefault(); zona.classList.remove('drag-over'); selecionar([...e.dataTransfer.files]); });
  inputFile.addEventListener('change', () => { selecionar([...inputFile.files]); });

  function selecionar(files) {
    if (!files.length) return;
    if (files.some(f => !f.type.startsWith('image/'))) { mostrarToast('Selecione apenas imagens.', 'erro'); return; }
    if (files.some(f => f.size > 5 * 1024 * 1024)) { mostrarToast('Cada imagem deve ter no máximo 5MB.', 'erro'); return; }
    const existentes = new Set(arquivos.map(f => `${f.name}-${f.size}-${f.lastModified}`));
    arquivos = [...arquivos, ...files.filter(f => !existentes.has(`${f.name}-${f.size}-${f.lastModified}`))];
    renderPreviews();
    preview?.classList.add('visivel');
    inputFile.value = '';
  }

  function renderPreviews() {
    previewImgs.innerHTML = arquivos.map((f, i) =>
      `<div class="preview-item">
        <img src="${URL.createObjectURL(f)}" alt="Prévia ${i+1}">
        <button type="button" class="preview-item__remover" data-idx="${i}" aria-label="Remover imagem">×</button>
      </div>`).join('');
    previewImgs.querySelectorAll('[data-idx]').forEach(btn =>
      btn.addEventListener('click', () => {
        arquivos.splice(Number(btn.dataset.idx), 1);
        arquivos.length ? renderPreviews() : preview?.classList.remove('visivel');
      }));
  }

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!arquivos.length) { mostrarToast('Selecione pelo menos uma foto antes de salvar.', 'erro'); return; }
    const nome      = form.nome.value.trim();
    const categoria = form.categoria.value;
    const descricao = form.descricao.value.trim();
    const preco     = form.preco.value.trim();
    const prazo     = form.prazo.value.trim();
    const destaque  = form.destaque?.checked || false;
    if (!nome || !categoria) { mostrarToast('Preencha o nome e a categoria.', 'erro'); return; }

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true; btn.textContent = 'Enviando…';

    try {
      const base = Date.now();
      const uploads = arquivos.map((arquivo, i) => new Promise((resolve, reject) => {
        const sRef = ref(storage, `produtos/${base}_${i}_${arquivo.name}`);
        const task = uploadBytesResumable(sRef, arquivo);
        task.on('state_changed',
          snap => { if (progressBar) progressBar.value = Math.round(((i + snap.bytesTransferred/snap.totalBytes) / arquivos.length) * 100); },
          reject,
          async () => resolve({ url: await getDownloadURL(sRef), storageRef: sRef.fullPath })
        );
      }));
      const imagens = await Promise.all(uploads);
      const ordem = (await getDocs(collection(db, 'produtos'))).size + 1;

      await addDoc(collection(db, 'produtos'), {
        nome, categoria, descricao, preco, prazo, destaque,
        imagemUrl:   imagens[0].url,
        imagensUrls: imagens.map(img => img.url),
        storageRef:  imagens[0].storageRef,
        storageRefs: imagens.map(img => img.storageRef),
        disponivel: true, ordem, criadoEm: serverTimestamp()
      });

      mostrarToast(`"${nome}" publicado com sucesso! 🎉`, 'sucesso');
      form.reset();
      arquivos = [];
      previewImgs.innerHTML = '';
      preview?.classList.remove('visivel');
      if (progressBar) progressBar.value = 0;
      await carregarProdutos();
    } catch (err) {
      console.error(err);
      mostrarToast('Erro ao salvar produto. Tente novamente.', 'erro');
    } finally {
      btn.disabled = false; btn.textContent = 'Publicar no catálogo';
    }
  });
}

/* ════════════════════════════════════════
   MÓDULO: AVALIAÇÕES
════════════════════════════════════════ */
async function carregarAvaliacoes() {
  const lista  = document.getElementById('lista-avaliacoes');
  const badge  = document.getElementById('badge-pendente');
  const statEl = document.getElementById('stat-pendentes');
  if (!lista) return;
  try {
    const snap = await getDocs(query(collection(db, 'avaliacoes'), orderBy('criadaEm', 'desc')));
    const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const pendentes = todas.filter(a => !a.aprovada);
    if (statEl) statEl.textContent = pendentes.length;
    if (badge) {
      badge.textContent = `${pendentes.length} pendente${pendentes.length !== 1 ? 's' : ''}`;
      badge.style.display = pendentes.length > 0 ? 'inline-block' : 'none';
    }
    lista.innerHTML = todas.length === 0
      ? `<p style="padding:2rem;text-align:center;color:var(--ardosia);">Nenhuma avaliação recebida ainda.</p>`
      : todas.map(renderizarAvaliacao).join('');
    lista.querySelectorAll('[data-aprovar]').forEach(btn =>
      btn.addEventListener('click', () => aprovarAvaliacao(btn.dataset.aprovar)));
    lista.querySelectorAll('[data-deletar-av]').forEach(btn =>
      btn.addEventListener('click', () => deletarAvaliacao(btn.dataset.deletarAv, btn.dataset.nome)));
  } catch (err) { console.error(err); }
}

function renderizarAvaliacao(av) {
  const estrelas = Array.from({ length: 5 }, (_, i) =>
    `<span style="color:${i < av.estrelas ? 'var(--dourado)' : '#ddd'}">★</span>`).join('');
  const data = av.criadaEm?.toDate
    ? av.criadaEm.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  return `
    <div class="avaliacao-row ${av.aprovada ? '' : 'pendente'}">
      <span class="avaliacao-row__estrelas" aria-label="${av.estrelas} estrelas">${estrelas}</span>
      <div class="avaliacao-row__corpo">
        <div class="avaliacao-row__nome">
          ${esc(av.nome)}
          ${!av.aprovada ? '<span class="badge-pendente-inline">Pendente</span>' : ''}
        </div>
        <p class="avaliacao-row__msg">${esc(av.mensagem)}</p>
        <span class="avaliacao-row__data">${data}</span>
      </div>
      <div class="avaliacao-row__acoes">
        ${!av.aprovada
          ? `<button class="btn-aprovar" data-aprovar="${av.id}">✓ Aprovar</button>`
          : '<span class="avaliacao-publicada">✓ Publicada</span>'}
        <button class="btn-icon deletar" data-deletar-av="${av.id}" data-nome="${esc(av.nome)}" title="Excluir avaliação">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`;
}

async function aprovarAvaliacao(id) {
  try {
    await updateDoc(doc(db, 'avaliacoes', id), { aprovada: true });
    mostrarToast('Avaliação aprovada e publicada! ✓', 'sucesso');
    await carregarAvaliacoes();
  } catch { mostrarToast('Erro ao aprovar avaliação.', 'erro'); }
}

async function deletarAvaliacao(id, nome) {
  const ok = await confirmar({
    titulo: 'Excluir avaliação',
    mensagem: `Excluir a avaliação de "${nome}" permanentemente?`,
    rotuloBotao: 'Excluir'
  });
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'avaliacoes', id));
    mostrarToast('Avaliação excluída.', 'sucesso');
    await carregarAvaliacoes();
  } catch { mostrarToast('Erro ao excluir avaliação.', 'erro'); }
}

/* ════════════════════════════════════════
   UTILITÁRIOS
════════════════════════════════════════ */
function mostrarToast(msg, tipo = 'sucesso') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast ${tipo} visivel`;
  setTimeout(() => toast.classList.remove('visivel'), 3500);
}

function criarSlug(v) {
  return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function nomeCategoria(slug) {
  return categorias.find(c => c.slug === slug)?.nome || slug || '—';
}

function esc(v = '') {
  return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export { mostrarToast };
