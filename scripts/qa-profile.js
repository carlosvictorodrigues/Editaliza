const { chromium } = require('@playwright/test');
const fs = require('fs');

(async () => {
  const baseUrl = process.env.QA_BASE_URL || 'http://localhost:3000';
  const url = baseUrl + '/profile.html';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs = [];
  const networkLogs = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error' || type === 'warning') {
      consoleLogs.push({ type, text });
    }
  });

  page.on('response', async (response) => {
    const status = response.status();
    const req = response.request();
    const method = req.method();
    const url = response.url();
    if (url.startsWith(baseUrl)) {
      let body = null;
      try {
        if (status >= 400) body = await response.text();
      } catch(_) {}
      networkLogs.push({ method, url, status, body });
    }
  });

  const interactiveMap = [];
  const issues = [];

  function addMap(selector, label, expected){ interactiveMap.push({ selector, label, expected }); }
  function addIssue(id, element, symptom, consoleMsg, network, root_cause, fixes, risk='médio', test_after_fix='Repetir ação e validar 2xx + sem erros.'){
    issues.push({ id, element, symptom, console: consoleMsg, network, root_cause, fix_plan: fixes, risk, test_after_fix });
  }

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });\n    await page.screenshot({ path: 'qa-profile-screenshot.png', fullPage: true });\n    const hasForm = await page.#profileForm;\n    if(!hasForm){ consoleLogs.push({ type: 'error', text: 'profileForm not found' }); }

    // Wait for nav and form
    await page.waitForSelector('#profileForm', { timeout: 10000, state: 'attached' });

    // Map elements
    addMap('#personalToggle', 'Toggle Dados Pessoais', 'Expandir/retrair seção');
    addMap('#experienceToggle', 'Toggle Experiência', 'Expandir/retrair seção');
    addMap('#goalsToggle', 'Toggle Metas', 'Expandir/retrair seção');
    addMap('#saveBtn', 'Salvar', 'Enviar PATCH /api/users/profile');
    addMap('#resetBtn', 'Restaurar', 'Recarregar dados via GET /api/users/profile');
    addMap('input[name="firstTime"][value="sim"]', 'Radio Primeira vez - Sim', 'Selecionar valor');
    addMap('input[name="firstTime"][value="nao"]', 'Radio Primeira vez - Não', 'Selecionar valor');
    addMap('#concursosCount', 'Select Quantos concursos', 'Abrir/selecionar');
    addMap('input[name="difficulties"][value="organizacao"]', 'Checkbox Dificuldade Organização', 'Alternar');
    addMap('#areaInterest', 'Select Área de Interesse', 'Abrir/selecionar');
    addMap('#levelDesired', 'Select Nível Desejado', 'Abrir/selecionar');
    addMap('#timelineGoal', 'Select Prazo', 'Abrir/selecionar');
    addMap('#studyHours', 'Select Horas de Estudo', 'Abrir/selecionar');

    // Avatar tabs load async
    await page.waitForSelector('#avatar-selection-ui', { timeout: 10000 });
    // Wait a bit for tabs to render
    await page.waitForTimeout(500);

    const tabCount = await page.locator('.avatar-gallery-tab').count();
    if (tabCount > 0) {
      addMap('.avatar-gallery-tab', 'Abas de Avatar', 'Trocar categoria e listar avatares');
    }

    // Run clicks sequentially and record observations
    const results = [];

    async function testClick(selector, label, action){
      const item = { selector, label, expected: action, observed: '', console: [], network: [] };
      const beforeNetLen = networkLogs.length;
      const beforeConLen = consoleLogs.length;
      try {
        await page.locator(selector).first().click({ timeout: 5000 });
        item.observed = 'Clique executado';
      } catch (e) {
        item.observed = 'Falhou ao clicar: ' + e.message;
      }
      item.console = consoleLogs.slice(beforeConLen);
      item.network = networkLogs.slice(beforeNetLen);
      results.push(item);
    }

    await testClick('#personalToggle', 'Toggle Dados Pessoais', 'Expandir/retrair seção');
    await testClick('#experienceToggle', 'Toggle Experiência', 'Expandir/retrair seção');
    await testClick('#goalsToggle', 'Toggle Metas', 'Expandir/retrair seção');

    // Interagir com selects
    try { await page.selectOption('#concursosCount', { index: 1 }); } catch {}
    try { await page.click('input[name="firstTime"][value="sim"]'); } catch {}
    try { await page.click('input[name="difficulties"][value="organizacao"]'); } catch {}
    try { await page.selectOption('#areaInterest', { index: 1 }); } catch {}
    try { await page.selectOption('#levelDesired', { index: 1 }); } catch {}
    try { await page.selectOption('#timelineGoal', { index: 1 }); } catch {}
    try { await page.selectOption('#studyHours', { index: 1 }); } catch {}

    // Avatar tab click
    if (tabCount > 0) {
      await testClick('.avatar-gallery-tab', 'Abas de Avatar', 'Trocar categoria e listar avatares');
      // Tentar clicar no primeiro avatar após carregar
      await page.waitForSelector('#avatar-gallery img.avatar-item', { timeout: 5000 });
      addMap('#avatar-gallery img.avatar-item', 'Avatar item', 'Selecionar avatar e habilitar salvar');
      await testClick('#avatar-gallery img.avatar-item', 'Avatar item', 'Selecionar avatar');
    }

    // Testar salvar (PATCH)
    await testClick('#saveBtn', 'Salvar', 'Enviar PATCH /api/users/profile');

    // Testar reset (GET)
    await testClick('#resetBtn', 'Restaurar', 'Recarregar perfil via GET');

    // Analyze issues from console and network
    for (const log of consoleLogs) {
      if ((log.type === 'error' || log.type === 'warning') && !/favicon|chrome-extensions/i.test(log.text)) {
        addIssue(
          'PG-CONSOLE-'+(issues.length+1).toString().padStart(3,'0'),
          'N/A',
          'Console '+log.type,
          log.text,
          null,
          'Erro/aviso em runtime',
          []
        );
      }
    }

    for (const net of networkLogs) {
      if (net.status >= 400) {
        addIssue(
          'PG-NET-'+(issues.length+1).toString().padStart(3,'0'),
          'N/A',
          'Falha de rede',
          null,
          { url: net.url, status: net.status },
          'Requisição retornou status >= 400',
          []
        );
      }
    }

    const report = {
      page: '/profile.html',
      interactive_map: interactiveMap,
      actions_result: results,
      issues
    };

    fs.writeFileSync('qa-profile-report.json', JSON.stringify(report, null, 2));
    console.log('WROTE qa-profile-report.json');

  } catch (err) {
    console.error('QA script failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();


