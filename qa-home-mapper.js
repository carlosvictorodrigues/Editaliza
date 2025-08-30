// QA Script - Mapeamento completo de elementos interativos em home.html
// Executar no console do navegador na página /home.html

(function() {
    console.log('🔍 QA - Iniciando mapeamento completo de home.html...\n');
    
    const interactiveElements = [];
    
    // 1. Mapear todos os botões
    const buttons = document.querySelectorAll('button');
    buttons.forEach((btn, index) => {
        interactiveElements.push({
            type: 'button',
            selector: btn.id ? `#${btn.id}` : btn.className ? `.${btn.className.split(' ')[0]}` : `button:nth-of-type(${index + 1})`,
            label: btn.textContent.trim().substring(0, 50),
            id: btn.id || null,
            className: btn.className || null,
            onclick: btn.onclick ? 'inline handler' : null,
            hasEventListeners: btn.onclick || btn.getAttribute('onclick') ? true : false,
            visible: btn.offsetParent !== null,
            disabled: btn.disabled
        });
    });
    
    // 2. Mapear todos os links
    const links = document.querySelectorAll('a');
    links.forEach((link, index) => {
        interactiveElements.push({
            type: 'link',
            selector: link.id ? `#${link.id}` : link.className ? `.${link.className.split(' ')[0]}` : `a:nth-of-type(${index + 1})`,
            label: link.textContent.trim().substring(0, 50),
            href: link.href,
            id: link.id || null,
            className: link.className || null,
            visible: link.offsetParent !== null
        });
    });
    
    // 3. Mapear selects
    const selects = document.querySelectorAll('select');
    selects.forEach((select, index) => {
        interactiveElements.push({
            type: 'select',
            selector: select.id ? `#${select.id}` : `select:nth-of-type(${index + 1})`,
            label: select.options[select.selectedIndex]?.text || 'No selection',
            id: select.id || null,
            className: select.className || null,
            disabled: select.disabled,
            visible: select.offsetParent !== null
        });
    });
    
    // 4. Mapear inputs interativos
    const inputs = document.querySelectorAll('input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"]');
    inputs.forEach((input, index) => {
        interactiveElements.push({
            type: `input-${input.type}`,
            selector: input.id ? `#${input.id}` : `input[type="${input.type}"]:nth-of-type(${index + 1})`,
            label: input.value || input.placeholder || 'No label',
            id: input.id || null,
            className: input.className || null,
            disabled: input.disabled,
            visible: input.offsetParent !== null
        });
    });
    
    // 5. Elementos com onclick inline
    const onclickElements = document.querySelectorAll('[onclick]');
    onclickElements.forEach((elem, index) => {
        if (!['BUTTON', 'A', 'INPUT'].includes(elem.tagName)) {
            interactiveElements.push({
                type: 'onclick-element',
                selector: elem.id ? `#${elem.id}` : `${elem.tagName.toLowerCase()}[onclick]:nth-of-type(${index + 1})`,
                label: elem.textContent.trim().substring(0, 50),
                tagName: elem.tagName,
                onclick: elem.getAttribute('onclick'),
                visible: elem.offsetParent !== null
            });
        }
    });
    
    // 6. Elementos especiais do dashboard
    const specialElements = [
        '#planSelector',
        '#viewTransparencyBtn',
        '#cancelPostponeButton',
        '.postpone-option-btn',
        '#studySessionModal',
        '#postponeModal',
        '#main-nav-container',
        '#retaFinalIndicator'
    ];
    
    specialElements.forEach(selector => {
        const elems = document.querySelectorAll(selector);
        elems.forEach(elem => {
            if (!interactiveElements.find(e => e.selector === selector || (elem.id && e.id === elem.id))) {
                interactiveElements.push({
                    type: 'special',
                    selector: selector,
                    label: elem.textContent?.trim().substring(0, 50) || elem.id || selector,
                    id: elem.id || null,
                    className: elem.className || null,
                    visible: elem.offsetParent !== null
                });
            }
        });
    });
    
    // Filtrar apenas elementos visíveis e únicos
    const visibleElements = interactiveElements.filter((elem, index, self) => 
        elem.visible !== false && 
        index === self.findIndex(e => e.selector === elem.selector)
    );
    
    // Resultado
    console.log('📊 MAPEAMENTO COMPLETO:');
    console.log('Total de elementos interativos:', visibleElements.length);
    console.table(visibleElements);
    
    // Retornar para uso posterior
    window.qaMapping = {
        timestamp: new Date().toISOString(),
        page: '/home.html',
        elements: visibleElements,
        summary: {
            buttons: visibleElements.filter(e => e.type === 'button').length,
            links: visibleElements.filter(e => e.type === 'link').length,
            selects: visibleElements.filter(e => e.type === 'select').length,
            inputs: visibleElements.filter(e => e.type.startsWith('input')).length,
            special: visibleElements.filter(e => e.type === 'special').length
        }
    };
    
    console.log('\n✅ Mapeamento salvo em window.qaMapping');
    console.log('Use window.qaMapping.elements para acessar a lista completa');
    
    return window.qaMapping;
})();