fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'YaCA Voice - FiveM'
author 'MineMalox & LuftigerLuca'

files {
  'locales/*.json'
}

server_script {
    'dist/server/**/*.js'
}

client_script {
    'dist/client/**/*.js'
}