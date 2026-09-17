// JSR skips a version it already has without failing, which is how commits go unshipped unnoticed. This fails instead.
const { name, version } = JSON.parse(await Bun.file('jsr.json').text()) as { name: string; version: string };
const meta = await (await fetch(`https://jsr.io/${name}/meta.json`)).json() as { versions: Record<string, unknown> };
if (version in meta.versions) {
    console.error(`${name}@${version} is already on JSR. Bump version in jsr.json to ship this commit.`);
    process.exit(1);
}
console.log(`${name}@${version} is new to JSR.`);
