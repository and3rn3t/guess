#!/usr/bin/env tsx
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { collectEndpointInventory } from './lib'

interface ValidationResult {
  errors: string[]
  warnings: string[]
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

const ROOT_DIR = resolve(import.meta.dirname, '..', '..')
const OPENAPI_PATH = resolve(ROOT_DIR, 'docs', 'openapi.yaml')

function getPointer(target: unknown, pointer: string): unknown {
  if (!pointer.startsWith('#/')) return undefined
  const parts = pointer
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))

  let current: unknown = target
  for (const part of parts) {
    if (typeof current !== 'object' || current === null || !(part in current)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

function collectRefs(value: JsonValue, acc: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, acc)
    return
  }

  if (typeof value !== 'object' || value === null) return

  for (const [key, nested] of Object.entries(value)) {
    if (key === '$ref' && typeof nested === 'string') {
      acc.push(nested)
      continue
    }
    collectRefs(nested, acc)
  }
}

function validateOpenApiHeader(doc: Record<string, unknown>, errors: string[]): void {
  if (typeof doc.openapi !== 'string' || !doc.openapi.startsWith('3.')) {
    errors.push('openapi field must be a 3.x version string.')
  }
}

function validateOperations(
  paths: Record<string, Record<string, unknown>>,
  errors: string[],
): void {
  const operationIds = new Set<string>()

  for (const [routePath, operations] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      const op = operation as Record<string, unknown>
      const operationId = op.operationId
      if (typeof operationId !== 'string' || operationId.length === 0) {
        errors.push(`Missing operationId for ${method.toUpperCase()} ${routePath}`)
      } else if (operationIds.has(operationId)) {
        errors.push(`Duplicate operationId detected: ${operationId}`)
      } else {
        operationIds.add(operationId)
      }

      if (routePath.startsWith('/api/admin')) {
        const security = op.security
        if (!Array.isArray(security) || security.length === 0) {
          errors.push(`Admin endpoint missing security declaration: ${method.toUpperCase()} ${routePath}`)
        }
      }
    }
  }
}

function validateRefs(doc: Record<string, unknown>, errors: string[]): void {
  const refs: string[] = []
  collectRefs(doc as JsonValue, refs)
  for (const ref of refs) {
    if (ref.startsWith('#/') && getPointer(doc, ref) === undefined) {
      errors.push(`Unresolved $ref pointer: ${ref}`)
    }
  }
}

function validateCoverage(
  paths: Record<string, Record<string, unknown>>,
  errors: string[],
): void {
  const inventory = collectEndpointInventory()
  for (const endpoint of inventory) {
    const pathSpec = paths[endpoint.routePath]
    if (!pathSpec) {
      errors.push(`Missing path in spec: ${endpoint.routePath}`)
      continue
    }

    for (const method of endpoint.methods) {
      if (!pathSpec[method]) {
        errors.push(`Missing method in spec: ${method.toUpperCase()} ${endpoint.routePath}`)
      }
    }
  }
}

function validate(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const raw = readFileSync(OPENAPI_PATH, 'utf-8')
  const doc = JSON.parse(raw) as Record<string, unknown>

  validateOpenApiHeader(doc, errors)

  const paths = doc.paths as Record<string, Record<string, unknown>> | undefined
  if (!paths || Object.keys(paths).length === 0) {
    errors.push('paths must contain at least one endpoint.')
    return { errors, warnings }
  }

  validateOperations(paths, errors)
  validateRefs(doc, errors)
  validateCoverage(paths, errors)

  const leakedSecretPattern = /(CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|API_KEY|SECRET|TOKEN)/i
  if (leakedSecretPattern.test(raw)) {
    warnings.push('Spec text contains token/secret-like keywords. Confirm no sensitive examples are present.')
  }

  return { errors, warnings }
}

function main(): void {
  const { errors, warnings } = validate()

  for (const warning of warnings) {
    console.warn(`WARN: ${warning}`)
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`ERROR: ${error}`)
    }
    console.error(`\nOpenAPI validation failed with ${errors.length} error(s).`)
    process.exit(1)
  }

  console.log('✓ OpenAPI validation passed')
}

main()
