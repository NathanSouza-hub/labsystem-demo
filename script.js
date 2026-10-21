const API_URL = "http://localhost:3000/products";
const AUTH_URL = "http://localhost:3000/auth";

const tabelaProdutos = document.getElementById("tabela-produtos");
const tableWrapper = document.getElementById("table-wrapper");
const estadoVazio = document.getElementById("estado-vazio");
const mensagem = document.getElementById("mensagem");
const usuarioLogado = document.getElementById("usuario-logado");

const overlay = document.getElementById("overlay");
const modalTitulo = document.getElementById("modal-titulo");
const formProduto = document.getElementById("form-produto");
const formErros = document.getElementById("form-erros");

const campoId = document.getElementById("produto-id");
const campoCategoria = document.getElementById("categoria");
const campoDescricao = document.getElementById("descricao");
const campoQuantidade = document.getElementById("quantidade");
const campoValor = document.getElementById("valor");

const campoFiltroBusca = document.getElementById("filtro-busca");
const campoFiltroCategoria = document.getElementById("filtro-categoria");
const cabecalhosOrdenaveis = document.querySelectorAll(".th-ordenavel");

let colunaOrdenacao = "id";
let ordemAtual = "asc";
let buscaAtual = "";
let filtroCategoriaAtual = "";
let debounceBusca = null;

document.getElementById("btn-menu").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("collapsed");
});
document.getElementById("perfil-trigger").addEventListener("click", (evento) => {
    evento.stopPropagation();
    document.getElementById("perfil-menu").classList.toggle("show");
});
document.addEventListener("click", (evento) => {
    const perfil = document.getElementById("perfil");
    if (!perfil.contains(evento.target)) {
        document.getElementById("perfil-menu").classList.remove("show");
    }
});
document.getElementById("btn-novo").addEventListener("click", () => abrirModal());
document.getElementById("btn-cancelar").addEventListener("click", fecharModal);
document.getElementById("btn-logout").addEventListener("click", sair);
overlay.addEventListener("click", (evento) => {
    if (evento.target === overlay) fecharModal();
});
document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && overlay.classList.contains("show")) fecharModal();
});
document.getElementById("btn-limpar-filtro").addEventListener("click", limparFiltro);
campoFiltroBusca.addEventListener("input", () => {
    clearTimeout(debounceBusca);
    debounceBusca = setTimeout(() => {
        buscaAtual = campoFiltroBusca.value.trim();
        carregarProdutos();
    }, 300);
});
campoFiltroCategoria.addEventListener("change", () => {
    filtroCategoriaAtual = campoFiltroCategoria.value;
    carregarProdutos();
});
formProduto.addEventListener("submit", salvarProduto);

cabecalhosOrdenaveis.forEach((th) => {
    th.addEventListener("click", () => ordenarPor(th.dataset.coluna));
});

verificarAutenticacao();

function limparFiltro() {
    buscaAtual = "";
    campoFiltroBusca.value = "";
    filtroCategoriaAtual = "";
    campoFiltroCategoria.value = "";
    carregarProdutos();
}

function ordenarPor(coluna) {
    if (colunaOrdenacao === coluna) {
        ordemAtual = ordemAtual === "asc" ? "desc" : "asc";
    } else {
        colunaOrdenacao = coluna;
        ordemAtual = "asc";
    }

    atualizarIndicadoresOrdenacao();
    carregarProdutos();
}

function atualizarIndicadoresOrdenacao() {
    cabecalhosOrdenaveis.forEach((th) => {
        th.classList.remove("ordenado-asc", "ordenado-desc");

        if (th.dataset.coluna === colunaOrdenacao) {
            th.classList.add(ordemAtual === "asc" ? "ordenado-asc" : "ordenado-desc");
        }
    });
}

async function verificarAutenticacao() {
    try {
        const resposta = await fetch(`${AUTH_URL}/me`, { credentials: "include" });

        if (!resposta.ok) {
            window.location.href = "login.html";
            return;
        }

        const dados = await resposta.json();
        usuarioLogado.textContent = dados.username;
        atualizarIndicadoresOrdenacao();
        carregarProdutos();
    } catch (erro) {
        window.location.href = "login.html";
    }
}

async function sair() {
    try {
        await fetch(`${AUTH_URL}/logout`, { method: "POST", credentials: "include" });
    } finally {
        window.location.href = "login.html";
    }
}

async function carregarProdutos() {
    mensagem.textContent = "";

    const params = new URLSearchParams();
    if (buscaAtual) params.set("q", buscaAtual);
    params.set("sort", colunaOrdenacao);
    params.set("order", ordemAtual);

    if (filtroCategoriaAtual) params.set("category", filtroCategoriaAtual);

    try {
        const resposta = await fetch(`${API_URL}?${params.toString()}`);

        if (!resposta.ok) {
            throw new Error("Falha ao buscar produtos.");
        }

        const produtos = await resposta.json();
        const filtroAtivo = Boolean(buscaAtual) || Boolean(filtroCategoriaAtual);

        if (produtos.length === 0 && filtroAtivo) {
            mensagem.textContent = "Nenhum produto encontrado.";
        } else {
            mensagem.textContent = "";
        }

        if (produtos.length === 0 && !filtroAtivo) {
            tableWrapper.classList.add("hidden");
            estadoVazio.classList.remove("hidden");
        } else {
            estadoVazio.classList.add("hidden");
            tableWrapper.classList.remove("hidden");
            renderizarTabela(produtos);
        }
    } catch (erro) {
        mensagem.textContent = "Não foi possível carregar os produtos. Verifique se o backend está rodando.";
    }
}

function renderizarTabela(produtos) {
    tabelaProdutos.innerHTML = "";

    produtos.forEach((produto) => {
        const linha = document.createElement("tr");

        linha.innerHTML = `
            <td>${produto.id}</td>
            <td>${formatarData(produto.created_at)}</td>
            <td>${produto.created_by}</td>
            <td>${produto.category}</td>
            <td>${produto.description}</td>
            <td>${produto.quantity}</td>
            <td>${formatarValor(produto.price)}</td>
            <td>
                <button class="btn-editar" data-id="${produto.id}" title="Editar">✎</button>
                <button class="btn-excluir" data-id="${produto.id}" title="Excluir">🗑</button>
            </td>
        `;

        tabelaProdutos.appendChild(linha);
    });
}

tabelaProdutos.addEventListener("click", (evento) => {
    const id = evento.target.dataset.id;
    if (!id) return;

    if (evento.target.classList.contains("btn-editar")) {
        editarProduto(id);
    }

    if (evento.target.classList.contains("btn-excluir")) {
        excluirProduto(id);
    }
});

async function editarProduto(id) {
    try {
        const resposta = await fetch(`${API_URL}/${id}`);

        if (!resposta.ok) {
            throw new Error("Produto não encontrado.");
        }

        const produto = await resposta.json();
        abrirModal(produto);
    } catch (erro) {
        mensagem.textContent = "Não foi possível carregar o produto para edição.";
    }
}

async function excluirProduto(id) {
    const confirmar = confirm("Tem certeza que deseja excluir este produto?");
    if (!confirmar) return;

    try {
        const resposta = await fetch(`${API_URL}/${id}`, { method: "DELETE", credentials: "include" });

        if (!resposta.ok) {
            throw new Error("Falha ao excluir produto.");
        }

        await carregarProdutos();
        mostrarMensagem("Produto apagado com sucesso.", "sucesso");
    } catch (erro) {
        mostrarMensagem("Não foi possível excluir o produto.");
    }
}

function mostrarMensagem(texto, tipo = "erro") {
    mensagem.textContent = texto;
    mensagem.classList.toggle("sucesso", tipo === "sucesso");

    if (tipo === "sucesso") {
        setTimeout(() => {
            mensagem.textContent = "";
            mensagem.classList.remove("sucesso");
        }, 3000);
    }
}

function abrirModal(produto) {
    formErros.textContent = "";

    if (produto) {
        modalTitulo.textContent = "Editar Produto";
        campoId.value = produto.id;
        campoCategoria.value = produto.category;
        campoDescricao.value = produto.description;
        campoQuantidade.value = produto.quantity;
        campoValor.value = produto.price;
    } else {
        modalTitulo.textContent = "Novo Produto";
        formProduto.reset();
        campoId.value = "";
    }

    overlay.classList.add("show");
}

function fecharModal() {
    overlay.classList.remove("show");
}

async function salvarProduto(evento) {
    evento.preventDefault();
    formErros.textContent = "";

    const id = campoId.value;
    const corpo = {
        category: campoCategoria.value,
        description: campoDescricao.value.trim(),
        quantity: Number(campoQuantidade.value),
        price: Number(campoValor.value)
    };

    const url = id ? `${API_URL}/${id}` : API_URL;
    const metodo = id ? "PUT" : "POST";

    try {
        const resposta = await fetch(url, {
            method: metodo,
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corpo)
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            formErros.textContent = dados.errors ? dados.errors.join(" ") : dados.error;
            return;
        }

        fecharModal();
        carregarProdutos();
    } catch (erro) {
        formErros.textContent = "Não foi possível salvar o produto.";
    }
}

function formatarData(dataISO) {
    if (!dataISO) return "-";
    const data = new Date(dataISO);
    return data.toLocaleDateString("pt-BR") + " " + data.toLocaleTimeString("pt-BR");
}

function formatarValor(valor) {
    return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
