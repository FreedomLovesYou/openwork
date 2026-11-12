import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const destination = path.resolve(process.argv[2] || "/tmp/openwork-remote-build");
await mkdir(destination, { recursive: true });
await cp(path.join(repo, "apps/desktop/remote"), destination, { recursive: true });
await mkdir(path.join(destination, "features"), { recursive: true });
for (const name of ["registry", "resolve"]) {
  const source = await readFile(path.join(repo, `packages/features/src/${name}.ts`), "utf8");
  const compiled = stripTypeScriptTypes(source).replaceAll('"@openwork/features/registry"', '"./registry.mjs"');
  await writeFile(path.join(destination, `features/${name}.mjs`), compiled);
}
await cp(path.join(repo, "apps/desktop/resources/icons/icon.icns"), path.join(destination, "icon.icns"));
await cp(path.join(repo, "LICENSE"), path.join(destination, "LICENSE"));
await writeFile(path.join(destination, "package.json"), JSON.stringify({
  name: "openwork-remote-desktop", productName: "OpenWork Remote", version: "0.1.0",
  description: "OpenWork desktop for a self-hosted workspace", author: "FreedomLovesYou",
  license: "MIT", private: true, type: "module", main: "main.mjs",
  packageManager: "pnpm@11.4.0",
  scripts: { start: "electron .", package: "electron-builder --publish never" },
  dependencies: { zod: "4.6.6" },
  devDependencies: { electron: "43.8.1", "electron-builder": "26.18.0" },
  build: {
    appId: "com.freedomlovesyou.openwork.remote", productName: "OpenWork Remote",
    artifactName: "OpenWork-Remote-${version}-${arch}.${ext}",
    files: ["*.mjs", "*.cjs", "connect.*", "features/**", "package.json", "LICENSE"],
    asar: true, npmRebuild: false,
    mac: { target: ["dmg", "zip"], icon: "icon.icns", identity: null, notarize: false, category: "public.app-category.productivity" },
  },
}, null, 2) + "\n");
await writeFile(path.join(destination, "pnpm-workspace.yaml"), "packages: []\nallowBuilds:\n  electron: true\n  electron-winstaller: false\n");
console.log(destination);
