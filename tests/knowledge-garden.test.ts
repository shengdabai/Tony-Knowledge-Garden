import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_ROOT = join(import.meta.dirname, '..')

describe('Tony Knowledge Garden structure', () => {
  it('should have required content files', () => {
    const requiredFiles = [
      'content/index.md',
      'content/about.md',
      'quartz.config.ts',
      'quartz.layout.ts',
      'tsconfig.json',
      'package.json',
      'Dockerfile',
    ]

    for (const file of requiredFiles) {
      const fullPath = join(PROJECT_ROOT, file)
      expect(existsSync(fullPath)).toBe(true)
    }
  })

  it('should have content categories', () => {
    const categories = [
      'AI与技术',
      '中文教学',
      '计算机科学',
      '数学',
      '投资商业',
      '人物思想',
      '学科',
    ]

    for (const cat of categories) {
      const fullPath = join(PROJECT_ROOT, 'content', cat)
      expect(existsSync(fullPath)).toBe(true)
    }
  })

  it('index.md should contain JSON-LD structured data', () => {
    const indexContent = readFileSync(
      join(PROJECT_ROOT, 'content/index.md'),
      'utf-8'
    )
    expect(indexContent).toContain('application/ld+json')
    expect(indexContent).toContain('WebSite')
    expect(indexContent).toContain('Tony')
  })

  it('index.md should have bilingual content', () => {
    const indexContent = readFileSync(
      join(PROJECT_ROOT, 'content/index.md'),
      'utf-8'
    )
    expect(indexContent).toContain('zt-en')
    expect(indexContent).toContain('zt-zh')
  })

  it('about.md should have social proof elements', () => {
    const aboutContent = readFileSync(
      join(PROJECT_ROOT, 'content/about.md'),
      'utf-8'
    )
    expect(aboutContent).toMatch(/6000\+/)
    expect(aboutContent).toMatch(/200\+/)
    expect(aboutContent).toContain('CELTA')
  })

  it('should have CI workflow for Tony-specific build', () => {
    const workflowPath = join(
      PROJECT_ROOT,
      '.github/workflows/tony-ci.yml'
    )
    expect(existsSync(workflowPath)).toBe(true)

    const workflowContent = readFileSync(workflowPath, 'utf-8')
    expect(workflowContent).toContain('quartz build')
    expect(workflowContent).toContain('sitemap.xml')
    expect(workflowContent).toContain('JSON-LD')
  })

  it('Dockerfile should use multi-stage build with nginx', () => {
    const dockerfile = readFileSync(
      join(PROJECT_ROOT, 'Dockerfile'),
      'utf-8'
    )
    expect(dockerfile).toContain('AS builder')
    expect(dockerfile).toContain('nginx')
    expect(dockerfile).toContain('HEALTHCHECK')
  })

  it('should have monitoring script', () => {
    const monitorPath = join(PROJECT_ROOT, 'scripts/monitor.sh')
    expect(existsSync(monitorPath)).toBe(true)
  })
})
