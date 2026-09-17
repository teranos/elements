# The publish workflow. .github/workflows/publish.yml is emitted from this and
# is never edited by hand:
#
#   nix eval --json --file ci/publish.nix | jq . > .github/workflows/publish.yml
#
# JSON is YAML, so GitHub reads the emitted file as it is. JSR trusts this
# repository through OIDC, so no secret is involved.
let
  checkout.uses = "actions/checkout@v6";
  bun = {
    uses = "oven-sh/setup-bun@v2";
    "with".bun-version = "1.3.9";
  };
in
{
  name = "Publish";

  on.push.branches = [ "main" ];

  jobs.publish = {
    name = "Publish to JSR";
    runs-on = "ubuntu-latest";
    permissions = {
      contents = "read";
      id-token = "write";
    };
    steps = [
      checkout
      bun
      { run = "bun install --frozen-lockfile"; }
      { run = "bun run typecheck"; }
      { name = "Tests under happy-dom"; run = "bun test"; }
      { name = "Tests under JSDOM"; run = "bun test"; env.USE_JSDOM = 1; }
      {
        name = "The version must be new: a version JSR already has would be skipped in silence";
        run = "bun run .github/jsr-version-is-new.ts";
      }
      { name = "Publish"; run = "npx jsr publish"; }
    ];
  };
}
