#!/usr/bin/env tsx
import { buildArtifacts, readArtifact } from './lib'

function main(): void {
  const expected = buildArtifacts()

  const currentJson = readArtifact(['docs', 'openapi.json'])
  const currentYaml = readArtifact(['docs', 'openapi.yaml'])
  const currentInventory = readArtifact(['docs', 'openapi-inventory.json'])
  const currentPublicYaml = readArtifact(['public', 'openapi.yaml'])

  const drifted: string[] = []
  if (currentJson !== expected.openapiJson) drifted.push('docs/openapi.json')
  if (currentYaml !== expected.openapiYaml) drifted.push('docs/openapi.yaml')
  if (currentInventory !== expected.inventoryJson) drifted.push('docs/openapi-inventory.json')
  if (currentPublicYaml !== expected.openapiYaml) drifted.push('public/openapi.yaml')

  if (drifted.length > 0) {
    console.error('OpenAPI artifacts are out of date. Regenerate with `pnpm openapi:generate`.')
    for (const file of drifted) {
      console.error(` - ${file}`)
    }
    process.exit(1)
  }

  console.log('✓ OpenAPI artifacts are up to date')
}

main()
