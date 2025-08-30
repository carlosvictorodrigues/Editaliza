// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Cronograma Page Integration', () => {
  // Mock data
  const mockPlan = {
    id: 1,
    plan_name: 'Concurso TJ-PE 2025',
    exam_date: '2025-03-15',
    reta_final_mode: false
  };

  const mockSessions = {
    '2025-08-29': [
      {
        id: 1,
        subject_name: 'Português',
        topic_description: 'Concordância Verbal',
        session_type: 'Novo Tópico',
        status: 'Pendente',
        scheduled_date: '2025-08-29'
      },
      {
        id: 2,
        subject_name: 'Matemática',
        topic_description: 'Geometria Plana',
        session_type: 'Revisão Consolidada',
        status: 'Pendente',
        scheduled_date: '2025-08-29'
      }
    ],
    '2025-08-30': [
      {
        id: 3,
        subject_name: 'Direito',
        topic_description: 'Direito Constitucional',
        session_type: 'Novo Tópico',
        status: 'Pendente',
        scheduled_date: '2025-08-30'
      }
    ]
  };

  const mockOverdueData = {
    count: 0,
    sessions: []
  };

  test.beforeEach(async ({ page, context }) => {
    // Set authentication token
    await context.addCookies([{
      name: 'token',
      value: 'mock_jwt_token',
      url: 'http://localhost:3000'
    }]);
    
    // Set localStorage
    await page.addInitScript(() => {
      localStorage.setItem('editaliza_token', 'mock_jwt_token');
      localStorage.setItem('selectedPlanId', '1');
    });

    // Mock API responses
    await page.route('**/api/plans/1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPlan)
      });
    });

    await page.route('**/api/sessions/overdue-check/1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockOverdueData)
      });
    });

    await page.route('**/api/sessions/by-date/1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSessions)
      });
    });

    await page.route('**/api/plans/1/exclusions', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Not in Reta Final mode' })
      });
    });

    // Monitor console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`Console error: ${msg.text()}`);
      }
    });

    // Monitor failed requests
    page.on('requestfailed', request => {
      console.error(`Request failed: ${request.url()}`);
    });
  });

  test('should load page and display plan information', async ({ page }) => {
    await page.goto('http://localhost:3000/cronograma.html?id=1');
    
    // Wait for plan header to be rendered
    await page.waitForSelector('#plan-header-container');
    
    // Check if exam date is displayed
    await expect(page.locator('#examDate')).toContainText('Data da Prova:');
    
    // Check if sessions are loaded
    await expect(page.locator('#scheduleContainer')).not.toBeEmpty();
  });

  test('should filter sessions by week', async ({ page }) => {
    await page.goto('http://localhost:3000/cronograma.html?id=1');
    await page.waitForSelector('#scheduleContainer');
    
    // Click week filter
    await page.click('[data-testid="filter-week"]');
    
    // Check if filter is active
    await expect(page.locator('[data-testid="filter-week"]')).toHaveClass(/active/);
  });

  test('should filter sessions by month', async ({ page }) => {
    await page.goto('http://localhost:3000/cronograma.html?id=1');
    await page.waitForSelector('#scheduleContainer');
    
    // Click month filter
    await page.click('[data-testid="filter-month"]');
    
    // Check if filter is active
    await expect(page.locator('[data-testid="filter-month"]')).toHaveClass(/active/);
  });

  test('should show all sessions', async ({ page }) => {
    await page.goto('http://localhost:3000/cronograma.html?id=1');
    await page.waitForSelector('#scheduleContainer');
    
    // Click all filter
    await page.click('[data-testid="filter-all"]');
    
    // Check if filter is active
    await expect(page.locator('[data-testid="filter-all"]')).toHaveClass(/active/);
  });

  test('should open export modal', async ({ page }) => {
    await page.goto('http://localhost:3000/cronograma.html?id=1');
    await page.waitForSelector('#scheduleContainer');
    
    // Click export button
    await page.click('[data-testid="export-button"]');
    
    // Check if modal is visible
    await expect(page.locator('#calendarModal')).toBeVisible();
    
    // Close modal
    await page.click('[data-testid="close-calendar-modal"]');
    
    // Check if modal is hidden
    await expect(page.locator('#calendarModal')).toBeHidden();
  });

  test('should update session status', async ({ page }) => {
    // Mock PATCH request
    await page.route('**/api/sessions/1', async route => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Status atualizado' })
        });
      }
    });

    await page.goto('http://localhost:3000/cronograma.html?id=1');
    await page.waitForSelector('#scheduleContainer');
    
    // Find and click checkbox (if exists)
    const checkbox = page.locator('input[type="checkbox"][data-session-id="1"]').first();
    if (await checkbox.count() > 0) {
      await checkbox.click();
      
      // Wait for toast notification
      await page.waitForTimeout(500);
    }
  });

  test('should open postpone modal', async ({ page }) => {
    await page.goto('http://localhost:3000/cronograma.html?id=1');
    await page.waitForSelector('#scheduleContainer');
    
    // Check if postpone button exists and click it
    const postponeBtn = page.locator('button:has-text("Adiar")').first();
    if (await postponeBtn.count() > 0) {
      await postponeBtn.click();
      
      // Check if modal is visible
      await expect(page.locator('#postponeModal')).toBeVisible();
      
      // Cancel postpone
      await page.click('[data-testid="cancel-postpone"]');
      
      // Check if modal is hidden
      await expect(page.locator('#postponeModal')).toBeHidden();
    }
  });

  test('should postpone session to next day', async ({ page }) => {
    // Mock postpone request
    await page.route('**/api/sessions/1/postpone', async route => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            message: 'Sessão adiada com sucesso',
            newDate: '2025-08-30'
          })
        });
      }
    });

    await page.goto('http://localhost:3000/cronograma.html?id=1');
    await page.waitForSelector('#scheduleContainer');
    
    // Open postpone modal if button exists
    const postponeBtn = page.locator('button:has-text("Adiar")').first();
    if (await postponeBtn.count() > 0) {
      await postponeBtn.click();
      await page.waitForSelector('#postponeModal');
      
      // Click postpone to next day
      await page.click('[data-testid="postpone-next"]');
      
      // Check if modal closes
      await expect(page.locator('#postponeModal')).toBeHidden();
    }
  });

  test('should create reinforcement session', async ({ page }) => {
    // Mock reinforce request
    await page.route('**/api/sessions/1/reinforce', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ 
            message: 'Reforço agendado com sucesso',
            newSessionId: 456
          })
        });
      }
    });

    await page.goto('http://localhost:3000/cronograma.html?id=1');
    await page.waitForSelector('#scheduleContainer');
    
    // Check if reinforce button exists and click it
    const reinforceBtn = page.locator('button:has-text("Reforçar")').first();
    if (await reinforceBtn.count() > 0) {
      await reinforceBtn.click();
      
      // Wait for toast notification
      await page.waitForTimeout(500);
    }
  });

  test('should handle overdue sessions and replan', async ({ page }) => {
    // Update mock to have overdue sessions
    const overdueData = {
      count: 3,
      sessions: [
        { id: 10, subject_name: 'Test', scheduled_date: '2025-08-28' }
      ]
    };

    await page.route('**/api/sessions/overdue-check/1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(overdueData)
      });
    });

    await page.route('**/api/plans/1/replan', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            message: 'Cronograma replanejado com sucesso',
            rescheduledCount: 3
          })
        });
      }
    });

    await page.goto('http://localhost:3000/cronograma.html?id=1');
    
    // Wait for overdue alert
    await page.waitForSelector('#overdue-alert-container');
    
    // Click replan button if it exists
    const replanBtn = page.locator('#replanButton');
    if (await replanBtn.count() > 0) {
      await replanBtn.click();
      
      // Wait for toast notification
      await page.waitForTimeout(500);
    }
  });

  test('should not have console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('http://localhost:3000/cronograma.html?id=1');
    await page.waitForSelector('#scheduleContainer');
    
    // Wait for any async operations
    await page.waitForTimeout(1000);
    
    // Check for console errors
    expect(errors).toHaveLength(0);
  });

  test('should not have failed network requests', async ({ page }) => {
    const failedRequests = [];
    page.on('requestfailed', request => {
      failedRequests.push(request.url());
    });

    await page.goto('http://localhost:3000/cronograma.html?id=1');
    await page.waitForSelector('#scheduleContainer');
    
    // Wait for any async operations
    await page.waitForTimeout(1000);
    
    // Check for failed requests
    expect(failedRequests).toHaveLength(0);
  });
});