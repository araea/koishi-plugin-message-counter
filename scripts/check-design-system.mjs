import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const root = new URL('..', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('design-system.lock.json', root), 'utf8'))
for (const [file, expected] of Object.entries(manifest.files)) {
 const actual = createHash('sha256').update(await readFile(new URL(file, root))).digest('hex')
 if (actual !== expected) throw new Error(`${file} differs from the shared design system. Run the canonical sync script.`)
}
console.log(`Design system ${manifest.version}: ${Object.keys(manifest.files).length} shared files verified`)
