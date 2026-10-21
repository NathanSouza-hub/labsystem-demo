const API_URL = "http://localhost:3000/users";
const AUTH_URL = "http://localhost:3000/auth";

const tabelaUsuarios = document.getElementById("tabela-usuarios");
const tableWrapper = document.getElementById("table-wrapper");
const estadoVazio = document.getElementById("estado-vazio");
const mensagem = document.getElementById("mensagem");
const usuarioLogado = document.getElementById("usuario-logado");

const overlay = document.getElementById("overlay");
const modalTitulo = document.getElementById("modal-titulo");
const formUsuario = document.getElementById("form-usuario");
const formErros = document.getElementById("form-erros");

const campoId = document.getElementById("usuario-id");
const campoUsername = document.getElementById("username");
const campoPassword = document.getElementById("password");
const ajudaSenha = document.getElementById("ajuda-senha");
const campoNome = document.getElementById("nome");
const campoEmail = document.getElementById("email");
const campoTelefone = document.getElementById("telefone");

const campoFiltroBusca = document.getElementById("filtro-busca");
const cabecalhosOrdenaveis = document.querySelectorAll(".th-ordenavel");

let colunaOrdenacao = "id";
let ordemAtual = "asc";
let buscaAtual = "";
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
        carregarUsuarios();
    }, 300);
});
formUsuario.addEventListener("submit", salvarUsuario);

cabecalhosOrdenaveis.forEach((th) => {
    th.addEventListener("click", () => ordenarPor(th.dataset.coluna));
});

verificarAutenticacao();

function limparFiltro() {
    buscaAtual = "";
    campoFiltroBusca.value = "";
    carregarUsuarios();
}

function ordenarPor(coluna) {
    if (colunaOrdenacao === coluna) {
        ordemAtual = ordemAtual === "asc" ? "desc" : "asc";
    } else {
        colunaOrdenacao = coluna;
        ordemAtual = "asc";
    }

    atualizarIndicadoresOrdenacao();
    carregarUsuarios();
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
        carregarUsuarios();
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

async function carregarUsuarios() {
    mensagem.textContent = "";

    const params = new URLSearchParams();
    if (buscaAtual) params.set("q", buscaAtual);
    params.set("sort", colunaOrdenacao);
    params.set("order", ordemAtual);

    try {
        const resposta = await fetch(`${API_URL}?${params.toString()}`, { credentials: "include" });

        if (!resposta.ok) {
            throw new Error("Falha ao buscar usuários.");
        }

        const usuarios = await resposta.json();

        if (usuarios.length === 0 && buscaAtual) {
            mensagem.textContent = "Nenhum usuário encontrado.";
        } else {
            mensagem.textContent = "";
        }

        if (usuarios.length === 0 && !buscaAtual) {
            tableWrapper.classList.add("hidden");
            estadoVazio.classList.remove("hidden");
        } else {
            estadoVazio.classList.add("hidden");
            tableWrapper.classList.remove("hidden");
            renderizarTabela(usuarios);
        }
    } catch (erro) {
        mensagem.textContent = "Não foi possível carregar os usuários. Verifique se o backend está rodando.";
    }
}

function renderizarTabela(usuarios) {
    tabelaUsuarios.innerHTML = "";

    usuarios.forEach((usuario) => {
        const linha = document.createElement("tr");

        linha.innerHTML = `
            <td>${usuario.id}</td>
            <td>${usuario.username}</td>
            <td>${formatarData(usuario.created_at)}</td>
            <td>
                <button class="btn-editar" data-id="${usuario.id}" title="Editar">✎</button>
                <button class="btn-excluir" data-id="${usuario.id}" title="Excluir">🗑</button>
            </td>
        `;

        tabelaUsuarios.appendChild(linha);
    });
}

tabelaUsuarios.addEventListener("click", (evento) => {
    const id = evento.target.dataset.id;
    if (!id) return;

    if (evento.target.classList.contains("btn-editar")) {
        editarUsuario(id);
    }

    if (evento.target.classList.contains("btn-excluir")) {
        excluirUsuario(id);
    }
});

async function editarUsuario(id) {
    try {
        const resposta = await fetch(`${API_URL}/${id}`, { credentials: "include" });

        if (!resposta.ok) {
            throw new Error("Usuário não encontrado.");
        }

        const usuario = await resposta.json();
        abrirModal(usuario);
    } catch (erro) {
        mensagem.textContent = "Não foi possível carregar o usuário para edição.";
    }
}

async function excluirUsuario(id) {
    const confirmar = confirm("Tem certeza que deseja excluir este usuário?");
    if (!confirmar) return;

    try {
        const resposta = await fetch(`${API_URL}/${id}`, { method: "DELETE", credentials: "include" });
        const dados = await resposta.json();

        if (!resposta.ok) {
            mensagem.textContent = dados.error || "Não foi possível excluir o usuário.";
            return;
        }

        if (dados.selfDeleted) {
            window.location.href = "login.html";
            return;
        }

        await carregarUsuarios();
        mostrarMensagem("Usuário excluído com sucesso.", "sucesso");
    } catch (erro) {
        mostrarMensagem("Não foi possível excluir o usuário.");
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

function abrirModal(usuario) {
    formErros.textContent = "";
    formUsuario.reset();

    if (usuario) {
        modalTitulo.textContent = "Editar Usuário";
        campoId.value = usuario.id;
        campoUsername.value = usuario.username;
        campoNome.value = usuario.name || "";
        campoEmail.value = usuario.email || "";
        campoTelefone.value = usuario.phone || "";
        campoPassword.required = false;
        ajudaSenha.textContent = "Deixe em branco para manter a senha atual.";
    } else {
        modalTitulo.textContent = "Novo Usuário";
        campoId.value = "";
        campoPassword.required = true;
        ajudaSenha.textContent = "Mínimo de 6 caracteres.";
    }

    overlay.classList.add("show");
}

function fecharModal() {
    overlay.classList.remove("show");
}

async function salvarUsuario(evento) {
    evento.preventDefault();
    formErros.textContent = "";

    const id = campoId.value;
    const username = campoUsername.value.trim();
    const password = campoPassword.value;
    const name = campoNome.value.trim();
    const email = campoEmail.value.trim();
    const phone = campoTelefone.value.trim();

    const url = id ? `${API_URL}/${id}` : `${AUTH_URL}/register`;
    const metodo = id ? "PUT" : "POST";
    const corpo = id
        ? { username, password: password || undefined, name, email, phone }
        : { username, password, name, email, phone };

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
        carregarUsuarios();
    } catch (erro) {
        formErros.textContent = "Não foi possível salvar o usuário.";
    }
}

function formatarData(dataISO) {
    if (!dataISO) return "-";
    const data = new Date(dataISO);
    return data.toLocaleDateString("pt-BR") + " " + data.toLocaleTimeString("pt-BR");
}
