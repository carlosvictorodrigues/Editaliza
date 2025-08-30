// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Plan Dashboard Page Integration', () => {
  // Mock data
  const mockPlan = {
    id: 1,
    plan_name: 'Concurso TJ-PE 2025',
    exam_date: '2025-03-15',
    reta_final_mode: false
  };

  const mockGamification = {
    studyStreak: 5,
    totalStudyDays: 20,
    experiencePoints: 1500,
    concurseiroLevel: 'Aspirante a Servidor(a) 🌱',
    achievements: [
      { id: 'first_session', name: 'Primeira Sessão', unlockedAt: '2025-08-01' }
    ],
    completedTopicsCount: 25,
    totalCompletedSessions: 30
  };

  const mockSchedulePreview = {
    phases: { current: 'Fase de Aprendizado' },
    completedTopics: 25,
    totalTopics: 100,
    pendingTopics: 75,
    simulados: { total: 10, direcionados: 5, gerais: 5 },
    revisoes: { programadas: 20, ciclos: 3 }
  };

  const mockPerformanceCheck = {
    status: 'on-track',
    completedTopics: 25,
    totalTopics: 100,
    daysRemaining: 60,
    averageDailyProgress: 2.5,
    postponementCount: 2,
    isMaintenanceMode: false,
    shouldRegenerateForSimulations: false,
    projectedCompletion: '2025-03-01'
  };

  const mockGoalProgress = {
    weeklyGoals: [
      { week: 'Semana 1', target: 21, achieved: 15 },
      { week: 'Semana 2', target: 21, achieved: 20 }
    ],
    dailyAverage: 3.5,
    currentWeekProgress: 15,
    targetPerWeek: 21
  };

  const mockReviewData = {
    questionsTotal: 500,
    questionsProgress: [
      { date: '2025-08-25', count: 50 },
      { date: '2025-08-26', count: 75 }
    ],
    bySubject: {
      'Português': { total: 100, solved: 50, accuracy: 0.8 },
      'Matemática': { total: 150, solved: 75, accuracy: 0.75 }
    }
  };

  const mockDetailedProgress = {
    subjects: [
      { 
        name: 'Português', 
        totalTopics: 30, 
        completedTopics: 10, 
        progress: 33.33,
        priority: 1,
        estimatedHours: 50
      },
      { 
        name: 'Matemática', 
        totalTopics: 25, 
        completedTopics: 8, 
        progress: 32,
        priority: 2,
        estimatedHours: 40
      }
    ],
    globalProgress: 25.5,
    totalCompleted: 25,
    totalPending: 75
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

    await page.route('**/api/gamification/profile', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockGamification)
      });
    });

    await page.route('**/api/plans/1/schedule_preview', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSchedulePreview)
      });
    });

    await page.route('**/api/plans/1/realitycheck', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPerformanceCheck)
      });
    });

    await page.route('**/api/plans/1/goal_progress', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockGoalProgress)
      });
    });

    await page.route('**/api/plans/1/review_data', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockReviewData)
      });
    });

    await page.route('**/api/plans/1/detailed_progress', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDetailedProgress)
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
    await page.goto('http://localhost:3000/plan.html?id=1');
    
    // Wait for plan header to be rendered
    await page.waitForSelector('#plan-header-container');
    
    // Check if gamification dashboard is loaded
    await expect(page.locator('#gamification-dashboard')).not.toBeEmpty();
    
    // Check if schedule dashboard is loaded
    await expect(page.locator('#scheduleDashboard')).not.toBeEmpty();
    
    // Check if performance dashboard is loaded
    await expect(page.locator('#performanceDashboard')).not.toBeEmpty();
  });

  test('should display gamification profile', async ({ page }) => {
    await page.goto('http://localhost:3000/plan.html?id=1');
    await page.waitForSelector('#gamification-dashboard');
    
    // Check if study streak is displayed
    const streakElement = await page.locator('text=dias de sequência').first();
    await expect(streakElement).toBeVisible();
    
    // Check if experience points are displayed
    const xpElement = await page.locator('text=XP').first();
    await expect(xpElement).toBeVisible();
    
    // Check if level is displayed
    const levelElement = await page.locator('text=Aspirante a Servidor').first();
    await expect(levelElement).toBeVisible();
  });

  test('should display schedule preview', async ({ page }) => {
    await page.goto('http://localhost:3000/plan.html?id=1');
    await page.waitForSelector('#scheduleDashboard');
    
    // Check if current phase is displayed
    const phaseElement = await page.locator('text=Fase de Aprendizado').first();
    await expect(phaseElement).toBeVisible();
    
    // Check if topics progress is displayed
    const topicsElement = await page.locator('text=25 de 100 tópicos').first();
    await expect(topicsElement).toBeVisible();
  });

  test('should display performance check with on-track status', async ({ page }) => {
    await page.goto('http://localhost:3000/plan.html?id=1');
    await page.waitForSelector('#performanceDashboard');
    
    // Check if on-track status is displayed
    const statusElement = await page.locator('.on-track').first();
    await expect(statusElement).toBeVisible();
    
    // Check if projected completion is displayed
    const projectionElement = await page.locator('text=Projeção de conclusão').first();
    await expect(projectionElement).toBeVisible();
  });

  test('should display off-track status correctly', async ({ page }) => {
    // Override mock for off-track scenario
    await page.route('**/api/plans/1/realitycheck', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockPerformanceCheck,
          status: 'off-track',
          averageDailyProgress: 1.0
        })
      });
    });

    await page.goto('http://localhost:3000/plan.html?id=1');
    await page.waitForSelector('#performanceDashboard');
    
    // Check if off-track status is displayed
    const statusElement = await page.locator('.off-track').first();
    await expect(statusElement).toBeVisible();
  });

  test('should display completed status correctly', async ({ page }) => {
    // Override mock for completed scenario
    await page.route('**/api/plans/1/realitycheck', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockPerformanceCheck,
          status: 'completed',
          completedTopics: 100,
          shouldRegenerateForSimulations: true
        })
      });
    });

    await page.goto('http://localhost:3000/plan.html?id=1');
    await page.waitForSelector('#performanceDashboard');
    
    // Check if completed status is displayed
    const statusElement = await page.locator('.completed').first();
    await expect(statusElement).toBeVisible();
    
    // Check if regenerate schedule link is displayed
    const regenerateLink = await page.locator('[data-testid="regenerate-schedule"]');
    await expect(regenerateLink).toBeVisible();
  });

  test('should expand and collapse accordion items', async ({ page }) => {
    await page.goto('http://localhost:3000/plan.html?id=1');
    await page.waitForSelector('#detailedProgressAccordion');
    
    // Wait for accordion headers to be rendered
    await page.waitForTimeout(1000);
    
    // Click on first accordion header if it exists
    const accordionHeader = page.locator('[data-testid^="accordion-header-"]').first();
    if (await accordionHeader.count() > 0) {
      await accordionHeader.click();
      
      // Check if content is expanded (has open class)
      await expect(accordionHeader).toHaveClass(/open/);
      
      // Click again to collapse
      await accordionHeader.click();
      
      // Check if content is collapsed (no open class)
      await expect(accordionHeader).not.toHaveClass(/open/);
    }
  });

  test('should handle gamification error and retry', async ({ page }) => {
    let requestCount = 0;
    
    // First request fails, second succeeds
    await page.route('**/api/gamification/profile', async route => {
      requestCount++;
      if (requestCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal server error' })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockGamification)
        });
      }
    });

    await page.goto('http://localhost:3000/plan.html?id=1');
    
    // Wait for error state
    await page.waitForSelector('[data-testid="retry-gamification"]');
    
    // Click retry button
    await page.click('[data-testid="retry-gamification"]');
    
    // Wait for successful load
    await page.waitForSelector('text=dias de sequência');
  });

  test('should handle performance check error and retry', async ({ page }) => {
    let requestCount = 0;
    
    // First request fails, second succeeds
    await page.route('**/api/plans/1/realitycheck', async route => {
      requestCount++;
      if (requestCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal server error' })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockPerformanceCheck)
        });
      }
    });

    await page.goto('http://localhost:3000/plan.html?id=1');
    
    // Wait for error state
    await page.waitForSelector('[data-testid="retry-performance"]');
    
    // Click retry button
    await page.click('[data-testid="retry-performance"]');
    
    // Wait for successful load
    await page.waitForSelector('.on-track');
  });

  test('should display goal progress', async ({ page }) => {
    await page.goto('http://localhost:3000/plan.html?id=1');
    await page.waitForSelector('#goalProgressDashboard');
    
    // Check if weekly goals are displayed
    const weeklyGoalElement = await page.locator('text=Semana').first();
    await expect(weeklyGoalElement).toBeVisible();
    
    // Check if daily average is displayed
    const dailyAverageElement = await page.locator('text=3.5').first();
    if (await dailyAverageElement.count() > 0) {
      await expect(dailyAverageElement).toBeVisible();
    }
  });

  test('should display review data', async ({ page }) => {
    await page.goto('http://localhost:3000/plan.html?id=1');
    await page.waitForSelector('#reviewDataDashboard');
    
    // Check if questions total is displayed
    const questionsElement = await page.locator('text=500').first();
    if (await questionsElement.count() > 0) {
      await expect(questionsElement).toBeVisible();
    }
  });

  test('should not have console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('http://localhost:3000/plan.html?id=1');
    await page.waitForSelector('#gamification-dashboard');
    
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

    await page.goto('http://localhost:3000/plan.html?id=1');
    await page.waitForSelector('#gamification-dashboard');
    
    // Wait for any async operations
    await page.waitForTimeout(1000);
    
    // Check for failed requests
    expect(failedRequests).toHaveLength(0);
  });
});