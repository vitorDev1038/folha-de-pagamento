// CONFIGURAÇÃO SUPABASE
const supabaseUrl = 'https://vujbeblrqajowaotarkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1amJlYmxycWFqb3dhb3Rhcmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMzgxNjAsImV4cCI6MjA4NzgxNDE2MH0.sIBx9XK8Lly5eMSBCx0WiEfg2Zws-Rlo1KLXb1kgXKk';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// 1. GERADOR DE E-MAIL
function gerarEmail(nomeCompleto) {
    const partes = nomeCompleto.trim().toLowerCase().split(" ");
    if (partes.length < 2) return partes[0] + "@prefeituraresende.com";
    const primeiroNome = partes[0];
    const ultimoNome = partes[partes.length - 1];
    let iniciaisMeio = "";
    for (let i = 1; i < partes.length - 1; i++) {
        if (partes[i].length > 2) iniciaisMeio += partes[i][0] + ".";
    }
    return `${primeiroNome}.${iniciaisMeio}${ultimoNome}@prefeituraresende.com`;
}

// 2. FUNÇÕES DO BANCO DE DADOS
async function obterFuncionarios() {
    const { data, error } = await _supabase.from('funcionarios').select('*').order('nome', { ascending: true });
    if (error) { console.error(error); return []; }
    return data;
}

// 3. CADASTRAR FUNCIONÁRIO (RH)
async function cadastrarFuncionario(event) {
    event.preventDefault();
    const nome = document.getElementById('nome-completo').value;
    const cargo = document.getElementById('cargo').value;
    const valorHora = parseFloat(document.getElementById('salario-hora').value);
    const senha = document.getElementById('senha-cadastro').value; 

    const { error } = await _supabase.from('funcionarios').insert([{
        nome: nome,
        email: gerarEmail(nome),
        cargo: cargo,
        valor_hora: valorHora,
        senha: senha
    }]);

    if (error) {
        alert("Erro ao cadastrar: " + error.message);
    } else {
        alert(`Funcionário cadastrado com sucesso!`);
        event.target.reset();
        await atualizarSelectFuncionarios();
        await renderizarListaGestao();
    }
}

// 4. LANÇAR FOLHA
async function lancarFolha(event) {
    event.preventDefault();
    const funcionarioId = document.getElementById('selecionar-funcionario').value;
    const horasNormais = parseFloat(document.getElementById('horas-normais').value);
    const horasExtras = parseFloat(document.getElementById('horas-extras').value);
    const mes = document.getElementById('mes-referencia')?.value || "Fevereiro/2026";

    if (!funcionarioId) return alert("Selecione um funcionário!");

    const { data: existente } = await _supabase
        .from('folhas')
        .select('*')
        .eq('funcionario_id', funcionarioId)
        .eq('mes_referencia', mes)
        .maybeSingle();

    if (existente) {
        alert(`ERRO: A folha de ${mes} para este funcionário já foi lançada!`);
        return;
    }

    const { data: func } = await _supabase.from('funcionarios').select('*').eq('id', funcionarioId).single();

    const ganhoNormal = horasNormais * func.valor_hora;
    const ganhoExtra = horasExtras * (func.valor_hora * 1.5);
    const bruto = ganhoNormal + ganhoExtra;
    const inss = bruto * 0.11;
    const liquido = bruto - inss;

    const { error } = await _supabase.from('folhas').insert([{
        funcionario_id: funcionarioId,
        mes_referencia: mes,
        horas_normais: horasNormais,
        horas_extras: horasExtras,
        ganho_normal: ganhoNormal.toFixed(2),
        ganho_extra: ganhoExtra.toFixed(2),
        total_bruto: bruto.toFixed(2),
        desconto_inss: inss.toFixed(2),
        valor_liquido: liquido.toFixed(2)
    }]);

    if (error) alert("Erro: " + error.message);
    else {
        alert(`Folha de ${mes} fechada com sucesso!`);
        await renderizarHistoricoFolhas(); 
        event.target.reset();
    }
}

// 5. GESTÃO E EDIÇÃO (CORRIGIDO)
async function prepararEdicao(id) {
    const { data: func } = await _supabase.from('funcionarios').select('*').eq('id', id).single();
    if (!func) return;

    const novoNome = prompt("Editar Nome Completo:", func.nome);
    const novoCargo = prompt("Editar Cargo:", func.cargo);
    const novoSalario = prompt("Editar Valor Hora:", func.valor_hora);

    if (novoNome && novoCargo) {
        const { error } = await _supabase.from('funcionarios').update({
            nome: novoNome.trim(),
            cargo: novoCargo.trim(),
            valor_hora: parseFloat(novoSalario),
            email: gerarEmail(novoNome)
        }).eq('id', id);

        if (error) alert(error.message);
        else {
            alert("Funcionário atualizado!");
            await renderizarListaGestao();
            await atualizarSelectFuncionarios();
        }
    }
}

async function excluirFuncionario(id) {
    if (confirm("Deseja remover este funcionário e todas as suas folhas?")) {
        const { error } = await _supabase.from('funcionarios').delete().eq('id', id);
        if (error) alert(error.message);
        else {
            alert("Funcionário excluído!");
            await atualizarSelectFuncionarios();
            await renderizarListaGestao();
            await renderizarHistoricoFolhas();
        }
    }
}

async function renderizarListaGestao() {
    const corpo = document.getElementById('lista-gestao-funcionarios');
    if (!corpo) return;
    const funcionarios = await obterFuncionarios();
    corpo.innerHTML = funcionarios.map(f => `
        <tr>
            <td>${f.matricula}</td>
            <td>${f.nome}</td>
            <td>${f.cargo}</td>
            <td>
                <button onclick="prepararEdicao('${f.id}')" style="background:#3182ce; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:4px; margin-right:5px;">Editar</button>
                <button onclick="excluirFuncionario('${f.id}')" style="background:#e53e3e; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:4px;">Excluir</button>
            </td>
        </tr>
    `).join('');
}

async function renderizarHistoricoFolhas() {
    const corpo = document.getElementById('lista-historico-folhas');
    if (!corpo) return;

    const buscaNome = document.getElementById('filtro-nome-rh')?.value.toLowerCase() || "";
    const filtroMes = document.getElementById('filtro-mes-rh')?.value || "";

    const { data: folhas, error } = await _supabase.from('folhas').select(`*, funcionarios(nome)` ).order('data_lancamento', { ascending: false });
    if (error) return;

    let sBruto = 0, sInss = 0, sLiq = 0;
    const filtradas = folhas.filter(folha => {
        const nMatch = folha.funcionarios?.nome.toLowerCase().includes(buscaNome);
        const mMatch = filtroMes === "" || folha.mes_referencia === filtroMes;
        return nMatch && mMatch;
    });

    corpo.innerHTML = filtradas.map(folha => {
        sBruto += parseFloat(folha.total_bruto);
        sInss += parseFloat(folha.desconto_inss);
        sLiq += parseFloat(folha.valor_liquido);
        return `
            <tr>
                <td>${folha.mes_referencia}</td>
                <td>${folha.funcionarios?.nome || 'Excluído'}</td>
                <td>R$ ${folha.total_bruto}</td>
                <td style="color:red">- R$ ${folha.desconto_inss}</td>
                <td style="font-weight:bold; color:green">R$ ${folha.valor_liquido}</td>
                <td><button onclick="excluirFolha('${folha.id_folha}')" style="background:#718096; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:4px;">Anular</button></td>
            </tr>`;
    }).join('') || '<tr><td colspan="6" style="text-align:center;">Nenhum registro.</td></tr>';

    atualizarExibicaoTotais(sBruto, sInss, sLiq);
}

function atualizarExibicaoTotais(bruto, inss, liquido) {
    if (document.getElementById('total-bruto-geral')) {
        document.getElementById('total-bruto-geral').textContent = `R$ ${bruto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        document.getElementById('total-inss-geral').textContent = `R$ ${inss.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        document.getElementById('total-liquido-geral').textContent = `R$ ${liquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    }
}

// 6. LOGIN E HOLERITE
async function realizarLogin(event) {
    event.preventDefault();
    const tipo = document.getElementById('tipo-acesso').value;
    const iden = document.getElementById('identificacao').value;
    const senha = document.getElementById('senha').value;

    if (tipo === 'rh') {
        if (iden.includes('@prefeituraresende.com') && senha === "admin123") window.location.href = '/rhgit add .
git commit -m "Finalizando rotas sem extensao html"
git push origin main';
        else alert("Erro no login RH!");
    } else {
        const { data: func } = await _supabase.from('funcionarios').select('*').eq('matricula', iden).eq('senha', senha).maybeSingle();
        if (func) {
            localStorage.setItem('usuarioLogadoID', func.id);
            window.location.href = '/holerite';
        } else alert("Matrícula ou Senha incorretas!");
    }
}

async function preencherHoleriteReal() {
    const usuarioID = localStorage.getItem('usuarioLogadoID');
    const corpo = document.getElementById('corpo-tabela');
    if (!usuarioID || !corpo) return;

    const { data: usuario } = await _supabase.from('funcionarios').select('*').eq('id', usuarioID).single();
    const { data: folhas } = await _supabase.from('folhas').select('*').eq('funcionario_id', usuarioID).order('mes_referencia');

    const selectMes = document.getElementById('escolher-mes-holerite');
    if (selectMes && selectMes.options.length === 0 && folhas && folhas.length > 0) {
        folhas.forEach(f => {
            const opt = new Option(f.mes_referencia, f.mes_referencia);
            selectMes.add(opt);
        });
    }

    const folha = folhas?.find(f => f.mes_referencia === selectMes?.value) || (folhas ? folhas[folhas.length - 1] : null);
    
    if (usuario) {
        document.getElementById('dados-servidor').innerHTML = `<p><strong>Nome:</strong> ${usuario.nome} | <strong>Matrícula:</strong> ${usuario.matricula}</p><p><strong>Cargo:</strong> ${usuario.cargo}</p>`;
    }

    if (folha) {
        document.getElementById('ref-mes').textContent = folha.mes_referencia;
        corpo.innerHTML = `
            <tr><td>Salário Base</td><td>${folha.horas_normais}h</td><td>R$ ${folha.ganho_normal}</td><td>-</td></tr>
            <tr><td>Horas Extras (50%)</td><td>${folha.horas_extras}h</td><td>R$ ${folha.ganho_extra}</td><td>-</td></tr>
            <tr><td>INSS</td><td>11%</td><td>-</td><td style="color:red">R$ ${folha.desconto_inss}</td></tr>`;
        document.getElementById('total-liquido').textContent = `R$ ${folha.valor_liquido}`;
    }
}

// 7. EXPORTAÇÃO
async function exportarRelatorioCSV() {
    const { data: folhas } = await _supabase.from('folhas').select(`*, funcionarios(nome)`);
    if (!folhas) return alert("Sem dados.");
    let csv = 'Mes;Funcionario;Total Bruto;INSS;Total Liquido\n';
    folhas.forEach(f => csv += `${f.mes_referencia};${f.funcionarios?.nome};${f.total_bruto};${f.desconto_inss};${f.valor_liquido}\n`);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = 'Relatorio_Folha.csv';
    link.click();
}

// 8. AUXILIARES
async function atualizarSelectFuncionarios() {
    const select = document.getElementById('selecionar-funcionario');
    if (!select) return;
    const funcs = await obterFuncionarios();
    select.innerHTML = '<option value="">Selecione...</option>' + funcs.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
}

async function excluirFolha(id) {
    if (confirm("Anular folha?")) {
        await _supabase.from('folhas').delete().eq('id_folha', id);
        await renderizarHistoricoFolhas();
    }
}

// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', async () => {
    await atualizarSelectFuncionarios();
    await renderizarListaGestao();
    await renderizarHistoricoFolhas(); 
    await preencherHoleriteReal();
    
    document.getElementById('form-cadastro')?.addEventListener('submit', cadastrarFuncionario);
    document.getElementById('form-lancamento')?.addEventListener('submit', lancarFolha);
    document.querySelector('.login-form')?.addEventListener('submit', realizarLogin);
});