import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

console.log('Building resource...')

if (existsSync('resource')) {
    console.log('Removing existing resource directory...')
    rmSync('resource', { recursive: true })
}

mkdirSync('resource')
mkdirSync('resource/yaca-voice')

cpSync('assets/yaca-voice', 'resource/yaca-voice', { recursive: true })

mkdirSync('resource/yaca-voice/dist')

copyFileSync('apps/yaca-client/dist/client.js', 'resource/yaca-voice/dist/client.js')
copyFileSync('apps/yaca-server/dist/server.js', 'resource/yaca-voice/dist/server.js')

const packageJson = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }))

writeFileSync(
    'resource/yaca-voice/fxmanifest.lua',
    `fx_version 'cerulean'
games { 'gta5', 'rdr3' }
rdr3_warning 'I acknowledge that this is a prerelease build of RedM, and I am aware my resources *will* become incompatible once RedM ships.'

name '${packageJson.name}'
author '${packageJson.author}'
version '${packageJson.version}'
repository '${packageJson.repository.url}'
description '${packageJson.description}'

dependencies {
    '/server:7290',
    '/onesync',
}

ui_page 'web/index.html'

files {
    'web/index.html',
    'web/script.js',
    'config/shared.json5',
    'locales/*.json',
}

client_script 'dist/client.js'
server_script 'dist/server.js'

provide 'saltychat'

`,
)

if (existsSync('config/yaca-voice/shared.json5')) {
    copyFileSync('config/yaca-voice/shared.json5', 'resource/yaca-voice/config/shared.json5')
}

if (existsSync('config/yaca-voice/server.json5')) {
    copyFileSync('config/yaca-voice/server.json5', 'resource/yaca-voice/config/server.json5')
}

copyFileSync('README.md', 'resource/yaca-voice/README.md')

console.log('Resource built successfully!')
