#!/usr/bin/env tsx
import { buildArtifacts, writeArtifacts } from './lib'

function main(): void {
  const artifacts = buildArtifacts()
  writeArtifacts(artifacts)
  console.log('✓ OpenAPI artifacts generated: docs/openapi.{json,yaml}, docs/openapi-inventory.json, public/openapi.yaml')
}

main()
