# Módulo de Rodapé Editaliza - Guia de Uso

## Visão Geral
O módulo de rodapé da Editaliza é um componente modular e responsivo que pode ser facilmente incluído em todas as páginas da plataforma.

## Arquivos Criados

### 1. CSS (`css/footer.css`)
- Design moderno com gradiente das cores da marca
- Totalmente responsivo (desktop e mobile)
- Animações sutis e acessibilidade
- Estados de hover e foco
- Suporte a dark mode e print styles

### 2. HTML (`components/footer.html`)
- Estrutura semântica completa
- Logo e descrição da plataforma
- Links de navegação organizados
- Informações de contato
- Redes sociais preparadas
- Links legais (termos, privacidade, etc.)

### 3. JavaScript (`js/footer.js`)
- Sistema de carregamento automático
- Gerenciamento de erros com fallbacks
- Validação de links internos
- Integração com analytics
- API para atualizações dinâmicas

## Como Usar

### Método 1: Inclusão Automática (Recomendado)
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <!-- outros links e scripts -->
    <script src="js/footer.js"></script>
</head>
<body>
    <!-- conteúdo da página -->
    
    <!-- O rodapé será inserido automaticamente aqui -->
</body>
</html>
```

### Método 2: Carregamento Manual
```javascript
// Carregamento básico
await loadEditalizaFooter();

// Com configurações personalizadas
await loadEditalizaFooter({
    footerPath: './custom/footer.html',
    cssPath: './custom/footer.css',
    position: '#footer-container'
});
```

### Método 3: Controle Programático
```javascript
// Criar instância personalizada
const footerManager = new EditalizaFooter();

// Configurar e inicializar
await footerManager.init({
    autoInsert: false,
    fadeInDuration: 800
});

// Atualizar conteúdo dinamicamente
footerManager.updateFooterContent({
    year: '2024',
    socialLinks: {
        Instagram: 'https://instagram.com/editaliza',
        YouTube: 'https://youtube.com/editaliza'
    },
    contact: {
        email: 'contato@editaliza.com',
        phone: '(11) 99999-9999'
    }
});
```

## Configurações Disponíveis

```javascript
const config = {
    footerPath: './components/footer.html',     // Caminho do HTML
    cssPath: './css/footer.css',               // Caminho do CSS
    autoInsert: true,                          // Inserção automática
    position: 'body',                          // Local de inserção
    fadeInDuration: 600                        // Duração da animação
};
```

## Eventos Disponíveis

```javascript
// Escutar quando rodapé é carregado
document.addEventListener('footerLoaded', (event) => {
    console.log('Rodapé carregado:', event.detail);
});
```

## Funções Globais

```javascript
// Verificar status do rodapé
const status = getFooterStatus();

// Atualizar rodapé
updateEditalizaFooter({
    year: '2024',
    socialLinks: { Instagram: 'https://...' }
});

// Recarregar rodapé
await window.footerManager.reload();
```

## Personalização

### Cores da Marca
O rodapé usa as cores definidas no projeto:
- Azul principal: `#0528f2`
- Verde: `#1ad937`
- Preto/cinza escuro: `#0d0d0d`

### Modificar Links de Navegação
Edite o arquivo `components/footer.html` e atualize as seções conforme necessário.

### Adicionar Redes Sociais
1. Edite `components/footer.html`
2. Adicione novos links na seção `.social-links`
3. Use ícones SVG para consistência

### Customizar Estilos
1. Edite `css/footer.css`
2. Ou adicione CSS personalizado após o carregamento
3. Use variáveis CSS para facilitar manutenção

## Responsividade

O rodapé é totalmente responsivo:
- **Desktop**: Layout em grid com 4 colunas
- **Tablet**: Adapta para 2 colunas
- **Mobile**: Layout em coluna única

## Acessibilidade

- Navegação por teclado
- Contraste adequado
- Labels para screen readers
- Suporte a `prefers-reduced-motion`
- Estrutura semântica

## Fallbacks

O sistema inclui fallbacks para:
- CSS não carregado → estilos inline básicos
- HTML não carregado → rodapé simplificado
- Erro de rede → versão mínima funcional

## Performance

- Carregamento assíncrono
- CSS otimizado com animações GPU
- Lazy loading de recursos externos
- Cache de componentes

## Exemplos de Uso por Página

### Dashboard
```html
<script src="js/footer.js"></script>
<!-- Rodapé padrão com todos os links -->
```

### Página de Login
```html
<script>
loadEditalizaFooter({
    position: '.login-container'
});
</script>
```

### Landing Page
```html
<script>
loadEditalizaFooter({
    socialLinks: {
        Instagram: 'https://instagram.com/editaliza',
        YouTube: 'https://youtube.com/editaliza'
    }
});
</script>
```

## Manutenção

### Atualizar Ano Automaticamente
O ano no copyright é atualizado automaticamente via JavaScript.

### Verificar Links
O sistema valida links internos automaticamente e reporta problemas no console.

### Monitoramento
Use `getFooterStatus()` para verificar se o rodapé está funcionando corretamente.

## Problemas Comuns

### Rodapé não aparece
1. Verifique se `js/footer.js` está carregado
2. Verifique erros no console
3. Confirme se os caminhos dos arquivos estão corretos

### Estilos não aplicados
1. Verifique se `css/footer.css` existe
2. Confirme se não há conflitos de CSS
3. O sistema usa fallbacks automáticos

### Links quebrados
1. Use caminhos relativos corretos
2. O sistema valida e reporta links problemáticos
3. Mantenha estrutura de pastas consistente

## Integração com Analytics

```javascript
// O sistema já está preparado para Google Analytics
// Rastreia cliques automaticamente quando gtag está disponível

gtag('event', 'footer_click', {
    'link_url': href,
    'link_text': text,
    'page_location': window.location.href
});
```