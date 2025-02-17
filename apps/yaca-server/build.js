import { build } from 'esbuild'

const production = process.argv.includes('--mode=production')

build({
    logLevel: "info",
    entryPoints: ['src/index.ts'],
    outfile: './dist/server.js',
    bundle: true,
    keepNames: true,
    treeShaking: true,
    loader: {
        '.ts': 'ts',
        '.js': 'js',
    },
    write: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    sourcemap: production ? false : 'inline',
    dropLabels: production ? ['DEV'] : undefined
})
    .then(() => {
        console.log('Server built successfully')
    })
    // skipcq: JS-0263
    .catch(() => process.exit(1))
