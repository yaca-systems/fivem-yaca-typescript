import esbuild from "esbuild";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  copyFileSync,
  mkdirSync,
  cpSync,
  rmSync
} from "fs";

/** @type {import('esbuild').BuildOptions} */
const server = {
  platform: "node",
  target: ["node16"],
  format: "cjs",
};

/** @type {import('esbuild').BuildOptions} */
const client = {
  platform: "browser",
  target: ["es2021"],
  format: "iife",
};

const production = process.argv.includes("--mode=production");
const packageJson = JSON.parse(
  readFileSync("package.json", { encoding: "utf8" }),
);

writeFileSync(
  ".yarn.installed",
  new Date().toLocaleString("en-AU", {
    timeZone: "UTC",
    timeStyle: "long",
    dateStyle: "full",
  }),
);

writeFileSync(
  "fxmanifest.lua",
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
    'config/shared.json',
    'locales/*.json',
}

client_script 'dist/client.js'
server_script 'dist/server.js'

provide 'saltychat'

`,
);

for (const context of ["client", "server"]) {
  await esbuild.build({
    bundle: true,
    entryPoints: [`${context}/index.ts`],
    outfile: `dist/${context}.js`,
    keepNames: true,
    sourcemap: production ? false : "inline",
    dropLabels: production ? ["DEV"] : undefined,
    legalComments: "inline",
    // banner: {
    //  js: `/**\n  * ${copyright}  */`,
    //},
    ...(context === "client" ? client : server),
  })
    .then(() => {
      console.log(`Successfully built ${context}`);
    })
    .catch(() => {
      throw new Error(`Failed to build ${context}`);
    });
}

console.log("Building resource...");

if (existsSync("resource")) {
  rmSync("resource", { recursive: true });
}

mkdirSync("resource");
mkdirSync("resource/dist");
copyFileSync("dist/client.js", "resource/dist/client.js");
copyFileSync("dist/server.js", "resource/dist/server.js");
mkdirSync("resource/web");
copyFileSync("web/index.html", "resource/web/index.html");
copyFileSync("web/script.js", "resource/web/script.js");
cpSync("locales", "resource/locales", { recursive: true });
mkdirSync("resource/config");

if (existsSync("config/shared.json")) {
  copyFileSync("config/shared.json", "resource/config/shared.json");
} else {
  copyFileSync("config/shared.json.example", "resource/config/shared.json");
}

if (existsSync("config/server.json")) {
  copyFileSync("config/server.json", "resource/config/server.json");
} else {
  copyFileSync("config/server.json.example", "resource/config/server.json");
}
copyFileSync("fxmanifest.lua", "resource/fxmanifest.lua");
copyFileSync("../README.md", "resource/README.md");
copyFileSync(".yarn.installed", "resource/.yarn.installed");

console.log("Resource built successfully!");
