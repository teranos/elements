# The TypeScript workflow. .github/workflows/ts.yml is emitted from this and is
# never edited by hand:
#
#   nix eval --json --file ci/ts.nix | jq . > .github/workflows/ts.yml
#
# JSON is YAML, so GitHub reads the emitted file as it is.
let
  checkout.uses = "actions/checkout@v6";
  bun = {
    uses = "oven-sh/setup-bun@v2";
    "with".bun-version = "1.3.9";
  };
in
{
  name = "TypeScript";

  on = {
    push.branches = [ "main" ];
    pull_request = null;
    workflow_dispatch = null;
  };

  jobs.test = {
    name = "TypeScript";
    runs-on = "ubuntu-latest";
    steps = [
      checkout
      bun
      { run = "bun install --frozen-lockfile"; }
      { run = "bun run typecheck"; }
      { name = "Tests under happy-dom"; run = "bun test"; }
      { name = "Tests under JSDOM"; run = "bun test"; env.USE_JSDOM = 1; }
    ];
  };
}
