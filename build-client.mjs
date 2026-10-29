#!/usr/bin/env node
/**
 * Build the single browser bundle the Client module system serves.
 *
 * The plugin ships plain JavaScript (no bundler): parts under client/src are
 * concatenated in filename order inside one module-loader factory, so every
 * top-level declaration is shared and relative imports disappear. Run from the
 * package directory:
 *
 *   node build-client.mjs           write client.js
 *   node build-client.mjs --check   fail when client.js is stale
 *
 * @module dsh-conversation-search/build-client
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const sourceDir = join(root, 'client', 'src')
const outputPath = join(root, 'client.js')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const packageName = manifest.name

const parts = readdirSync(sourceDir)
  .filter((name) => name.endsWith('.js'))
  .sort((left, right) => left.localeCompare(right, 'en'))

if (parts.length === 0) {
  console.error('build-client: no client/src/*.js parts found')
  process.exit(1)
}

const header = `/* dsh-conversation-search — generated browser bundle. Do not edit directly;
 * edit client/src/*.js and run \`node build-client.mjs\`. */
window.__ModuleLoader__.load({
  id: ${JSON.stringify(packageName)},
  factory(require) {
    'use strict';
    const React = require('react');
`

const footer = `
    return { inject, apply };
  },
});
`

const body = parts
  .map((name) => {
    const text = readFileSync(join(sourceDir, name), 'utf8').replace(/\s+$/, '')
    return `    /* ===== client/src/${name} ===== */\n${text}\n`
  })
  .join('\n')

const bundle = header + body + footer
const check = process.argv.includes('--check')

if (check) {
  const current = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : ''
  if (current !== bundle) {
    console.error('build-client: client.js is stale; run `node build-client.mjs`')
    process.exit(1)
  }
  console.log(`build-client: client.js is up to date (${parts.length} parts)`)
  process.exit(0)
}

writeFileSync(outputPath, bundle)
console.log(`build-client: wrote client.js (${parts.length} parts, ${bundle.length} bytes)`)
