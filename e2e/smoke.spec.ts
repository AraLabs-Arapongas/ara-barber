import { test, expect } from '@playwright/test'

test('home page carrega e mostra o nome do produto', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'ara-barber' })).toBeVisible()
})

test('proxy marca header x-ara-area=root no host padrão', async ({ request }) => {
  const res = await request.get('/')
  expect(res.headers()['x-ara-area']).toBe('root')
})
