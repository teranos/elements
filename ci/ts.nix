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

  # The real browser. Held to the Ubuntu the pinned @playwright/test installs
  # its browsers on: ubuntu-latest moved to 26.04, which 1.56.1 refuses.
  jobs.browser = {
    name = "Browser";
    runs-on = "ubuntu-24.04";
    steps = [
      checkout
      bun
      { run = "bun install --frozen-lockfile"; }
      {
        name = "Chromium and WebKit, as the pinned @playwright/test wants them";
        run = "npx playwright install --with-deps chromium webkit";
      }
      {
        name = "Desktop, Pixel 7 and iPhone 15";
        run = "npx playwright test -c browser";
        env.CI = "1";
      }
      {
        name = "What the browser saw";
        "if" = "failure()";
        uses = "actions/upload-artifact@v4";
        "with" = {
          name = "browser-report";
          path = "browser/playwright-report\nbrowser/test-results";
          retention-days = 14;
        };
      }
    ];
  };
}
