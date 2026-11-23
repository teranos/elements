// "sessions keep giving it a mayor bump, and i keep losing my shit over it"
// elements stays on 1.x: a major other than 1 does not publish.
const { name, version } = JSON.parse(await Bun.file('jsr.json').text()) as { name: string; version: string };
if (version.split('.')[0] !== '1') {
    console.error(`${name}@${version}: elements stays on 1.x. Bump the minor or the patch in jsr.json, never the major.`);
    process.exit(1);
}
console.log(`${name}@${version} is on 1.x.`);
