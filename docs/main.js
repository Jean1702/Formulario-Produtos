 import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

    // ==========================================
    // SUBSTITUA PELAS SUAS VARIÁVEIS DE AMBIENTE
    // ==========================================
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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Validação final de imagens no submit
        if (arquivosSelecionados.length < 1) {
            showMessage('Por favor, adicione pelo menos 1 imagem.', 'error');
            return;
        }

        showMessage('<i class="fa-solid fa-spinner fa-spin"></i> Processando cadastro...', 'info');
        btnSubmit.disabled = true;

        try {
            // 1. Pegar dados da turma (Corrigido para evitar erro 406)
            const cursoSelecionado = document.getElementById('curso').value;
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
            const novoProduto = {
                nome: document.getElementById('nome').value,
                descricao: document.getElementById('descricao').value,
                preco: parseFloat(document.getElementById('preco').value),
                estoque: parseInt(document.getElementById('estoque').value),
                categoria: document.getElementById('categoria').value,
                idturma: idTurma
            };

            const { data: produtoData, error: produtoError } = await supabase
                .from('produtos')
                .insert([novoProduto])
                .select()
                .single();

            if (produtoError) throw new Error('Erro ao inserir produto: ' + produtoError.message);

            const idProduto = produtoData.idproduto;

            // 3. Upload das Imagens pegando do nosso Array `arquivosSelecionados`
            for (const file of arquivosSelecionados) {
                const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`; // Tira espaços do nome
                
                const { error: uploadError } = await supabase
                    .storage
                    .from('produtos_imagens') 
                    .upload(fileName, file);

                if (uploadError) throw new Error('Erro no upload da imagem: ' + uploadError.message);

                const { data: publicUrlData } = supabase
                    .storage
                    .from('produtos_imagens')
                    .getPublicUrl(fileName);

                // Insere na tabela de imagens
                await supabase
                    .from('imagens')
                    .insert([{
                        idproduto: idProduto,
                        nome: fileName,
                        url_imagem: publicUrlData.publicUrl
                    }]);
            }

            showMessage('<i class="fa-solid fa-circle-check"></i> Produto cadastrado com sucesso!', 'success');
            
            // Limpa o formulário e as imagens da tela
            form.reset();
            arquivosSelecionados = [];
            atualizarPreview();

        } catch (error) {
            console.error(error);
            showMessage('<i class="fa-solid fa-triangle-exclamation"></i> ' + error.message, 'error');
        } finally {
            btnSubmit.disabled = false;
        }
    });

    function showMessage(html, type) {
        msgDiv.innerHTML = html;
        msgDiv.className = type;
    }