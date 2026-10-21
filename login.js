const API_URL = "http://localhost:3000/auth";

const titulo = document.getElementById("titulo-formulario");
const form = document.getElementById("form-auth");
const formErros = document.getElementById("form-erros");
const btnEnviar = document.getElementById("btn-enviar");
const linkAlternar = document.getElementById("link-alternar");
const campoUsername = document.getElementById("username");
const campoPassword = document.getElementById("password");
const camposCadastro = document.getElementById("campos-cadastro");
const campoNome = document.getElementById("nome");
const campoEmail = document.getElementById("email");
const campoTelefone = document.getElementById("telefone");

let modoRegistro = false;

verificarSessaoExistente();

linkAlternar.addEventListener("click", (evento) => {
    evento.preventDefault();
    modoRegistro = !modoRegistro;
    formErros.textContent = "";

    camposCadastro.classList.toggle("hidden", !modoRegistro);
    campoNome.required = modoRegistro;
    campoEmail.required = modoRegistro;
    campoTelefone.required = modoRegistro;

    if (modoRegistro) {
        titulo.textContent = "Criar conta";
        btnEnviar.textContent = "Cadastrar";
        linkAlternar.textContent = "Já tem conta? Entrar";
    } else {
        titulo.textContent = "Entrar";
        btnEnviar.textContent = "Entrar";
        linkAlternar.textContent = "Ainda não tem conta? Cadastre-se";
    }
});

form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    formErros.textContent = "";

    const username = campoUsername.value.trim();
    const password = campoPassword.value;

    try {
        if (modoRegistro) {
            const nome = campoNome.value.trim();
            const email = campoEmail.value.trim();
            const telefone = campoTelefone.value.trim();
            await registrar(username, password, nome, email, telefone);
        }

        await entrar(username, password);
        window.location.href = "index.html";
    } catch (erro) {
        formErros.textContent = erro.message;
    }
});

async function registrar(username, password, name, email, phone) {
    const resposta = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, name, email, phone })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
        throw new Error(dados.errors ? dados.errors.join(" ") : dados.error);
    }
}

async function entrar(username, password) {
    const resposta = await fetch(`${API_URL}/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
        throw new Error(dados.errors ? dados.errors.join(" ") : dados.error);
    }
}

async function verificarSessaoExistente() {
    try {
        const resposta = await fetch(`${API_URL}/me`, { credentials: "include" });

        if (resposta.ok) {
            window.location.href = "index.html";
        }
    } catch (erro) {
        // backend indisponível: permanece na tela de login
    }
}
