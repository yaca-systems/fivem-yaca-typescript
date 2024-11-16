import { build } from 'esbuild'

const production = process.argv.includes('--mode=production')

build({
  entryPoints: ['src/index.ts'],
  outfile: './dist/client.js',
  bundle: true,
  loader: {
    '.ts': 'ts',
    '.js': 'js',
  },
  write: true,
  platform: 'browser',
  target: 'es2021',
  format: 'iife',
  minify: production,
  sourcemap: production ? false : 'inline',
  dropLabels: production ? ['DEV'] : undefined,
})
  .then(() => {
    console.log('Client built successfully')
  })
  // skipcq: JS-0263
  .catch(() => process.exit(1))
