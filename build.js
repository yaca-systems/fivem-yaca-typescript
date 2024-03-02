import esbuild from "esbuild";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  copyFileSync,
  mkdirSync,
  cpSync,
} from "fs";
import { rmSync } from "node:fs";

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
const buildCmd = production ? esbuild.build : esbuild.context;
// const wordWrap = new RegExp(`.{1,65}\\s+|\\S+`, 'g');
const packageJson = JSON.parse(
  readFileSync("package.json", { encoding: "utf8" }),
);
/* const copyright = readFileSync('README.md', { encoding: 'utf8' })
  .replace(/[\s\S]*?## Copyright/, '')
  .match(wordWrap)
  .join('\n  * ')
  .replace(/\n{2,}/g, '\n');

console.log(copyright.split('\n')[0]); */

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
  `fx_version 'bodacious'
game 'gta5'

name '${packageJson.name}'
author '${packageJson.author}'
version '${packageJson.version}'
license '${packageJson.license}'
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
    'configs/shared.json',
    'locales/*.json',
}

client_script 'dist/client.js'
server_script 'dist/server.js'

`,
);

for (const context of ["client", "server"]) {
  await buildCmd({
    bundle: true,
    entryPoints: [`${context}/index.ts`],
    outfile: `dist/${context}.js`,
    keepNames: true,
    dropLabels: production ? ["DEV"] : undefined,
    legalComments: "inline",
    // banner: {
    //  js: `/**\n  * ${copyright}  */`,
    //},
    plugins: production
      ? undefined
      : [
          {
            name: "rebuild",
            setup(build) {
              const cb = (result) => {
                if (!result || result.errors.length === 0)
                  console.log(`Successfully built ${context}`);
              };
              build.onEnd(cb);
            },
          },
        ],
    ...(context === "client" ? client : server),
  })
    .then((build) => {
      if (production) {
        return console.log(`Successfully built ${context}`);
      }

      build.watch();
    })
    .catch(() => process.exit(1));
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
copyFileSync("README.md", "resource/README.md");
copyFileSync(".yarn.installed", "resource/.yarn.installed");

console.log("Resource built successfully!");
