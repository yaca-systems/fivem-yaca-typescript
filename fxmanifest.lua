fx_version 'cerulean'
game 'gta5'

name 'yaca-voice'
author 'MineMalox & LuftigerLuca'
version '1.0.0'
license 'TODO'
repository 'https://git.baustella.club/HopeLife/fivem-yaca-js'
description 'YACA Voice Integration for FiveM'

dependencies {
    '/server:7290',
    '/onesync',
}

files {
    'locales/*.json',
}

client_script 'dist/client.js'
server_script 'dist/server.js'

