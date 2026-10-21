// Modo demo: simula a API do LabSystem no navegador.
// Intercepta as chamadas para http://localhost:3000 e responde com as mesmas
// rotas, validações e mensagens do back-end real, guardando os dados no localStorage.
(function () {
    const BASE = "http://localhost:3000";
    const CHAVE = "labsystem-demo-v1";
    const CATEGORIAS = ["Hardware", "Periféricos", "Componentes", "Armazenamento", "Redes", "Informática", "Outros"];
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function diasAtras(dias, hora) {
        const d = new Date();
        d.setDate(d.getDate() - dias);
        d.setHours(hora, (dias * 7) % 60, 0, 0);
        return d.toISOString();
    }

    function dadosIniciais() {
        const produtos = [
            ["Notebook Dell Inspiron 15", 8, 3899.9, "Informática", "demo"],
            ["Monitor LG 24\" Full HD", 15, 899.0, "Periféricos", "demo"],
            ["Teclado mecânico Redragon Kumara", 22, 249.9, "Periféricos", "ana.lima"],
            ["Mouse sem fio Logitech M280", 40, 89.9, "Periféricos", "ana.lima"],
            ["SSD Kingston NV2 1TB", 30, 429.0, "Armazenamento", "demo"],
            ["HD externo Seagate 2TB", 12, 459.9, "Armazenamento", "carlos.m"],
            ["Memória RAM Kingston Fury 16GB DDR4", 25, 299.9, "Componentes", "carlos.m"],
            ["Processador AMD Ryzen 5 5600", 9, 749.0, "Componentes", "demo"],
            ["Placa de vídeo RTX 4060 8GB", 4, 2199.0, "Hardware", "carlos.m"],
            ["Fonte Corsair CV550 80 Plus", 11, 369.9, "Hardware", "ana.lima"],
            ["Roteador TP-Link Archer C6", 18, 239.9, "Redes", "demo"],
            ["Switch TP-Link 8 portas Gigabit", 14, 179.9, "Redes", "ana.lima"],
            ["Cabo de rede Cat6 5m", 60, 24.9, "Redes", "carlos.m"],
            ["Pasta térmica Arctic MX-4", 35, 54.9, "Outros", "demo"]
        ].map(([description, quantity, price, category, created_by], i) => ({
            id: i + 1, description, quantity, price, category, created_by,
            created_at: diasAtras(30 - i * 2, 9 + (i % 8))
        }));

        const usuarios = [
            { id: 1, username: "demo", password: "demo123", name: "Usuário Demo", email: "demo@labsystem.dev", phone: "(11) 90000-0000", created_at: diasAtras(40, 10) },
            { id: 2, username: "ana.lima", password: "ana12345", name: "Ana Lima", email: "ana.lima@labsystem.dev", phone: "(11) 91111-2222", created_at: diasAtras(35, 14) },
            { id: 3, username: "carlos.m", password: "carlos123", name: "Carlos Mendes", email: "carlos@labsystem.dev", phone: "(11) 93333-4444", created_at: diasAtras(33, 11) }
        ];

        return { produtos, usuarios, proximoProduto: produtos.length + 1, proximoUsuario: usuarios.length + 1, sessao: null };
    }

    // localStorage pode estar bloqueado (aba anônima, por exemplo): nesse caso os dados ficam só em memória
    let memoria = null;
    function carregar() {
        if (memoria) return memoria;
        try {
            const salvo = localStorage.getItem(CHAVE);
            if (salvo) return (memoria = JSON.parse(salvo));
        } catch (e) {}
        return (memoria = dadosIniciais());
    }
    function salvar() {
        try { localStorage.setItem(CHAVE, JSON.stringify(memoria)); } catch (e) {}
    }
    function resetar() {
        memoria = dadosIniciais();
        salvar();
    }

    function responder(status, corpo) {
        return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
    }

    function usuarioLogado(db) {
        return db.usuarios.find((u) => u.id === db.sessao) || null;
    }

    function ordenar(lista, colunas, sort, order) {
        if (!colunas.includes(sort)) return lista;
        const fator = order === "desc" ? -1 : 1;
        return [...lista].sort((a, b) => {
            const x = a[sort], y = b[sort];
            if (typeof x === "number" && typeof y === "number") return (x - y) * fator;
            return String(x).localeCompare(String(y), "pt-BR") * fator;
        });
    }

    function contem(texto, busca) {
        return String(texto).toLowerCase().includes(busca.toLowerCase());
    }

    function validarProduto(c) {
        const errors = [];
        if (!c.description || typeof c.description !== "string" || !c.description.trim()) errors.push("description é obrigatória e deve ser um texto não vazio.");
        if (c.quantity === undefined || c.quantity === null || !Number.isInteger(c.quantity) || c.quantity < 0) errors.push("quantity é obrigatória e deve ser um número inteiro maior ou igual a 0.");
        if (c.price === undefined || c.price === null || typeof c.price !== "number" || c.price <= 0) errors.push("price é obrigatório e deve ser um número maior que 0.");
        if (!c.category || !CATEGORIAS.includes(c.category)) errors.push("category é obrigatória e deve ser uma das opções válidas.");
        return errors;
    }

    function validarUsuario(c, senhaObrigatoria) {
        const errors = [];
        if (!c.username || typeof c.username !== "string" || !c.username.trim()) errors.push("username é obrigatório e deve ser um texto não vazio.");
        if (senhaObrigatoria) {
            if (!c.password || typeof c.password !== "string" || c.password.length < 6) errors.push("password é obrigatório e deve ter pelo menos 6 caracteres.");
        } else if (c.password !== undefined && c.password !== null && c.password !== "") {
            if (typeof c.password !== "string" || c.password.length < 6) errors.push("password deve ter pelo menos 6 caracteres.");
        }
        if (!c.name || typeof c.name !== "string" || !c.name.trim()) errors.push("name é obrigatório e deve ser um texto não vazio.");
        if (!c.email || typeof c.email !== "string" || !EMAIL_REGEX.test(c.email.trim())) errors.push("email é obrigatório e deve ser um endereço válido.");
        if (!c.phone || typeof c.phone !== "string" || !c.phone.trim()) errors.push("phone é obrigatório.");
        return errors;
    }

    function api(metodo, caminho, params, corpo) {
        const db = carregar();
        const eu = usuarioLogado(db);
        const naoAutenticado = () => responder(401, { error: "Não autenticado." });
        const partes = caminho.split("/").filter(Boolean);
        const [recurso, id] = [partes[0], partes[1] !== undefined ? Number(partes[1]) : undefined];

        if (recurso === "auth") {
            if (partes[1] === "login" && metodo === "POST") {
                const errors = [];
                if (!corpo.username || typeof corpo.username !== "string" || !corpo.username.trim()) errors.push("username é obrigatório e deve ser um texto não vazio.");
                if (!corpo.password || typeof corpo.password !== "string" || corpo.password.length < 6) errors.push("password é obrigatório e deve ter pelo menos 6 caracteres.");
                if (errors.length) return responder(400, { errors });
                const u = db.usuarios.find((x) => x.username === corpo.username);
                if (!u || u.password !== corpo.password) return responder(401, { error: "Usuário ou senha inválidos." });
                db.sessao = u.id;
                salvar();
                return responder(200, { message: "Login realizado com sucesso!", username: u.username });
            }
            if (partes[1] === "register" && metodo === "POST") {
                const errors = validarUsuario(corpo, true);
                if (errors.length) return responder(400, { errors });
                if (db.usuarios.some((x) => x.username === corpo.username || x.email === corpo.email.trim())) {
                    return responder(409, { error: "Usuário ou e-mail já cadastrado." });
                }
                db.usuarios.push({
                    id: db.proximoUsuario++, username: corpo.username, password: corpo.password,
                    name: corpo.name, email: corpo.email.trim(), phone: corpo.phone, created_at: new Date().toISOString()
                });
                salvar();
                return responder(201, { message: "Usuário cadastrado com sucesso!" });
            }
            if (partes[1] === "logout" && metodo === "POST") {
                db.sessao = null;
                salvar();
                return responder(200, { message: "Logout realizado com sucesso!" });
            }
            if (partes[1] === "me" && metodo === "GET") {
                return eu ? responder(200, { username: eu.username }) : naoAutenticado();
            }
        }

        if (recurso === "products") {
            if (metodo === "GET" && id === undefined) {
                let lista = db.produtos;
                const q = params.get("q");
                if (q) lista = lista.filter((p) => contem(p.description, q) || contem(p.created_by, q) || (Number.isInteger(Number(q)) && p.id === Number(q)));
                const categoria = params.get("category");
                if (categoria) lista = lista.filter((p) => p.category === categoria);
                return responder(200, ordenar(lista, ["id", "created_at", "created_by", "price", "description", "quantity"], params.get("sort"), params.get("order")));
            }
            const produto = db.produtos.find((p) => p.id === id);
            if (metodo === "GET") return produto ? responder(200, produto) : responder(404, { error: "Produto não encontrado." });
            if (!eu) return naoAutenticado();
            if (metodo === "POST") {
                const errors = validarProduto(corpo);
                if (errors.length) return responder(400, { errors });
                db.produtos.push({
                    id: db.proximoProduto++, description: corpo.description, quantity: corpo.quantity, price: corpo.price,
                    category: corpo.category, created_by: eu.username, created_at: new Date().toISOString()
                });
                salvar();
                return responder(201, { message: "Produto cadastrado com sucesso!" });
            }
            if (metodo === "PUT") {
                const errors = validarProduto(corpo);
                if (errors.length) return responder(400, { errors });
                // Como no back-end real, created_by é preservado
                if (produto) Object.assign(produto, { description: corpo.description, quantity: corpo.quantity, price: corpo.price, category: corpo.category });
                salvar();
                return responder(200, { message: "Produto atualizado com sucesso!" });
            }
            if (metodo === "DELETE") {
                db.produtos = db.produtos.filter((p) => p.id !== id);
                salvar();
                return responder(200, { message: "Produto excluído com sucesso!" });
            }
        }

        if (recurso === "users") {
            if (!eu) return naoAutenticado();
            if (metodo === "GET" && id === undefined) {
                let lista = db.usuarios;
                const q = params.get("q");
                if (q) lista = lista.filter((u) => contem(u.username, q) || (Number.isInteger(Number(q)) && u.id === Number(q)));
                lista = lista.map(({ id, username, created_at }) => ({ id, username, created_at }));
                return responder(200, ordenar(lista, ["id", "username", "created_at"], params.get("sort"), params.get("order")));
            }
            const usuario = db.usuarios.find((u) => u.id === id);
            if (metodo === "GET") {
                if (!usuario) return responder(404, { error: "Usuário não encontrado." });
                const { password, ...semSenha } = usuario;
                return responder(200, semSenha);
            }
            if (metodo === "PUT") {
                const errors = validarUsuario(corpo, false);
                if (errors.length) return responder(400, { errors });
                if (db.usuarios.some((u) => u.id !== id && u.username === corpo.username)) {
                    return responder(409, { error: "Nome de usuário já está em uso." });
                }
                if (usuario) {
                    Object.assign(usuario, { username: corpo.username, name: corpo.name, email: corpo.email.trim(), phone: corpo.phone });
                    if (corpo.password) usuario.password = corpo.password;
                }
                salvar();
                return responder(200, { message: "Usuário atualizado com sucesso!" });
            }
            if (metodo === "DELETE") {
                if (db.usuarios.length <= 1) return responder(400, { error: "Não é possível excluir o último usuário do sistema." });
                db.usuarios = db.usuarios.filter((u) => u.id !== id);
                const propriaConta = id === eu.id;
                if (propriaConta) db.sessao = null;
                salvar();
                return responder(200, propriaConta ? { message: "Usuário excluído com sucesso!", selfDeleted: true } : { message: "Usuário excluído com sucesso!" });
            }
        }

        return responder(404, { error: "Rota não encontrada." });
    }

    const fetchOriginal = window.fetch.bind(window);
    window.fetch = async function (entrada, opcoes = {}) {
        const url = typeof entrada === "string" ? entrada : entrada.url;
        if (!url.startsWith(BASE)) return fetchOriginal(entrada, opcoes);

        const { pathname, searchParams } = new URL(url);
        const metodo = (opcoes.method || "GET").toUpperCase();
        let corpo = {};
        try { corpo = opcoes.body ? JSON.parse(opcoes.body) : {}; } catch (e) {}

        // Pequeno atraso para parecer uma chamada de rede
        await new Promise((r) => setTimeout(r, 120));
        return api(metodo, pathname, searchParams, corpo);
    };

    // Faixa de aviso da demo
    function montarFaixa() {
        const estilo = document.createElement("style");
        estilo.textContent = `
            .demo-faixa { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 9999;
                display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px 14px;
                width: max-content; max-width: calc(100vw - 24px); padding: 9px 16px; border-radius: 10px;
                background: #12151c; color: #e6e8ee; font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
                box-shadow: 0 10px 30px -10px rgba(0,0,0,.5); }
            .demo-faixa strong { color: #7cb7ff; }
            .demo-faixa code { font-family: ui-monospace, Consolas, monospace; color: #9fd9a8; }
            .demo-faixa button, .demo-faixa a { background: none; border: 0; padding: 0; color: #7cb7ff; font: inherit; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
        `;
        document.head.append(estilo);

        const faixa = document.createElement("div");
        faixa.className = "demo-faixa";
        faixa.setAttribute("role", "note");
        faixa.innerHTML = `
            <span><strong>Demo</strong> · dados de exemplo, salvos só no seu navegador</span>
            <span>Login: <code>demo</code> / <code>demo123</code></span>
            <button type="button">Restaurar dados</button>
            <a href="https://github.com/NathanSouza-hub/labsystem" target="_blank" rel="noopener">Código ↗</a>
        `;
        faixa.querySelector("button").addEventListener("click", () => {
            resetar();
            window.location.href = "login.html";
        });
        document.body.append(faixa);
        document.body.style.paddingBottom = "72px";

        // Na tela de login, já deixa as credenciais da demo preenchidas
        const usuario = document.getElementById("username");
        const senha = document.getElementById("password");
        if (document.getElementById("form-auth") && usuario && senha) {
            usuario.value = "demo";
            senha.value = "demo123";
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montarFaixa);
    else montarFaixa();
})();
