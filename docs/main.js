 import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

    // ==========================================
    // SUBSTITUA PELAS SUAS VARIÁVEIS DE AMBIENTE
    // ==========================================
    // === BUSCAR CATEGORIAS NO BANCO AO ABRIR A PÁGININA ===
   
    const SUPABASE_URL = 'https://kaybspuiotepwlxwsotk.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_AEyJwDweGKHMNgudCTyBDw_v1TG840B';
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // LÓGICA DE MANIPULAÇÃO DAS IMAGENS
    let arquivosSelecionados = [];
    const inputImagens = document.getElementById('imagens');
    const previewContainer = document.getElementById('image-preview-container');

    // Quando o usuário escolhe imagens
    inputImagens.addEventListener('change', (e) => {
        const novosArquivos = Array.from(e.target.files);

        // Validação: não deixar passar de 3 no total
        if (arquivosSelecionados.length + novosArquivos.length > 3) {
            showMessage('Você só pode adicionar no máximo 3 imagens!', 'error');
            inputImagens.value = ''; // reseta o input
            return;
        }

        // Adiciona os novos arquivos ao nosso Array
        arquivosSelecionados = arquivosSelecionados.concat(novosArquivos);
        
        // Atualiza as miniaturas na tela
        atualizarPreview();
        
        // Limpa o valor do input para permitir selecionar o mesmo arquivo novamente se o usuário apagar
        inputImagens.value = ''; 
        showMessage('', ''); // Limpa alertas anteriores
    });

    // Função que desenha as miniaturas
    function atualizarPreview() {
        previewContainer.innerHTML = ''; // Limpa a tela

        arquivosSelecionados.forEach((arquivo, index) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const div = document.createElement('div');
                div.className = 'preview-item';
                div.innerHTML = `
                    <img src="${e.target.result}" alt="Preview">
                    <button type="button" class="remove-img-btn" onclick="removerImagem(${index})">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                `;
                previewContainer.appendChild(div);
            }
            
            reader.readAsDataURL(arquivo);
        });
    }

    // Função global para remover uma imagem específica clicando no "X"
    window.removerImagem = (index) => {
        arquivosSelecionados.splice(index, 1); // Tira do Array
        atualizarPreview(); // Desenha de novo
    };

    // LÓGICA DE ENVIO DO FORMULÁRIO
    const form = document.getElementById('productForm');
    const msgDiv = document.getElementById('message');
    const btnSubmit = document.getElementById('btnSubmit');
// 1. REGRAS DE CURSO E ANO (Fica FORA do submit, solto no script)
const selectCurso = document.getElementById('curso');
const radioAno3 = document.querySelector('input[name="ano"][value="3"]');

selectCurso.addEventListener('change', (e) => {
    if (e.target.value === 'Segurança do Trabalho') {
        radioAno3.disabled = true;
        if (radioAno3.checked) {
            radioAno3.checked = false;
            showMessage('Atenção: Segurança do Trabalho não possui 3º Ano.', 'info');
        }
    } else {
        radioAno3.disabled = false;
    }
});

// 2. EVENTO DE SUBMIT (O formulário propriamente dito)
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validação de imagens
    if (arquivosSelecionados.length < 1) {
        showMessage('Por favor, adicione pelo menos 1 imagem.', 'error');
        return;
    }

    // --- TRAVA O BOTÃO ---
    const textoOriginal = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
    showMessage('Processando cadastro...', 'info');

    try {
        // 1. Pegar dados da turma
        const cursoSelecionado = selectCurso.value;
        const anoSelecionado = document.querySelector('input[name="ano"]:checked').value;

        const { data: turmaData, error: turmaError } = await supabase
            .from('turma')
            .select('idturma')
            .eq('nomecurso', cursoSelecionado)
            .eq('ano', anoSelecionado);

        if (turmaError) throw new Error('Erro na busca da turma: ' + turmaError.message);
        if (!turmaData || turmaData.length === 0) throw new Error('Turma não encontrada para este curso e ano.');
        
        const idTurma = turmaData[0].idturma;

        // 2. Inserir o Produto
        const checkboxesMarcados = Array.from(document.querySelectorAll('input[name="categoria"]:checked'));
        if (checkboxesMarcados.length === 0) {
            throw new Error('Por favor, selecione pelo menos uma categoria!');
        }

        const novoProduto = {
            nome: document.getElementById('nome').value,
            descricao: document.getElementById('descricao').value,
            preco: parseFloat(document.getElementById('preco').value),
            estoque: parseInt(document.getElementById('estoque').value),
            idturma: idTurma
        };

        const { data: produtoData, error: produtoError } = await supabase
            .from('produtos')
            .insert([novoProduto])
            .select()
            .single();

        if (produtoError) throw new Error('Erro ao inserir produto: ' + produtoError.message);

        const idProduto = produtoData.idproduto;

        // 2.5 Inserir as Categorias
        const categoriasParaInserir = checkboxesMarcados.map(cb => ({
            idproduto: idProduto,
            idcategoria: parseInt(cb.value)
        }));

        const { error: errorCat } = await supabase
            .from('categoria_produto') 
            .insert(categoriasParaInserir);

        if (errorCat) throw new Error('Erro ao vincular categorias: ' + errorCat.message);

        // 3. Upload das Imagens
        for (const file of arquivosSelecionados) {
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            
            const { error: uploadError } = await supabase
                .storage
                .from('produtos_imagens') 
                .upload(fileName, file);

            if (uploadError) throw new Error('Erro no upload da imagem: ' + uploadError.message);

            const { data: publicUrlData } = supabase
                .storage
                .from('produtos_imagens')
                .getPublicUrl(fileName);

            await supabase
                .from('imagens')
                .insert([{
                    idproduto: idProduto,
                    nome: fileName,
                    url_imagem: publicUrlData.publicUrl
                }]);
        }

        // SUCESSO!
        showMessage('<i class="fa-solid fa-circle-check"></i> Produto cadastrado com sucesso!', 'success');
        form.reset();
        arquivosSelecionados = [];
        atualizarPreview();

    } catch (error) {
        console.error(error);
        showMessage('<i class="fa-solid fa-triangle-exclamation"></i> ' + error.message, 'error');
    } finally {
        // --- DESTRAVA O BOTÃO ---
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = textoOriginal;
    }
});

    function showMessage(html, type) {
        msgDiv.innerHTML = html;
        msgDiv.className = type;
    }
 async function carregarCategorias() {
        const container = document.getElementById('categorias-container');
        
        // Busca as categorias no banco
        const { data, error } = await supabase
            .from('categoria')
            .select('idcategoria, nomecategoria')
            .order('nomecategoria'); // Traz em ordem alfabética
            
        if (error) {
            container.innerHTML = '<span style="color: red;">Erro ao carregar categorias. Verifique o RLS da tabela categorias.</span>';
            return;
        }
        
        container.innerHTML = ''; // Limpa o "Carregando..."
        
        // Cria um checkbox para cada categoria que veio do banco
        data.forEach(cat => {
            const label = document.createElement('label');
            // Perceba que o value agora é o ID da categoria, e não mais o nome!
            label.innerHTML = `<input type="checkbox" name="categoria" value="${cat.idcategoria}"> ${cat.nomecategoria}`;
            container.appendChild(label);
        });
    }

    // Chama a função
    carregarCategorias();