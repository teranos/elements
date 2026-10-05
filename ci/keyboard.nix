# The keyboard workflow. .github/workflows/keyboard.yml is emitted from this
# and is never edited by hand:
#
#   nix eval --json --file ci/keyboard.nix | jq . > .github/workflows/keyboard.yml
#
# JSON is YAML, so GitHub reads the emitted file as it is.
#
# No emulated browser raises a keyboard. A simulated iPhone and an Android
# emulator do: each opens Selenium low on the screen, taps its field, types,
# puts the keyboard away, and keeps a picture of every step (browser/keyboard/).
let
  checkout.uses = "actions/checkout@v6";
  bun = {
    uses = "oven-sh/setup-bun@v2";
    "with".bun-version = "1.3.9";
  };
  install.run = "bun install --frozen-lockfile";
  serve = {
    name = "The specimens page";
    run = ''
      bun examples/serve.ts > serve.log 2>&1 &
      for i in $(seq 1 30); do curl -sf http://localhost:5180/ > /dev/null && exit 0; sleep 1; done
      cat serve.log; exit 1
    '';
  };
  pictures = name: {
    name = "What the keyboard looked like";
    "if" = "always()";
    uses = "actions/upload-artifact@v4";
    "with" = {
      inherit name;
      path = "keyboard-shots";
      retention-days = 14;
    };
  };
in
{
  name = "Keyboard";

  on = {
    pull_request = null;
    workflow_dispatch = null;
  };

  jobs.ios = {
    name = "iPhone Simulator, Safari";
    runs-on = "macos-15";
    timeout-minutes = 30;
    steps = [
      checkout
      bun
      install
      serve
      { name = "Tap the field, type, put the keyboard away"; run = "bash browser/keyboard/ios.sh"; }
      { name = "safaridriver"; "if" = "always()"; run = "cat safaridriver.log || true"; }
      (pictures "keyboard-ios")
    ];
  };

  jobs.android = {
    name = "Android emulator, Chrome";
    runs-on = "ubuntu-latest";
    timeout-minutes = 30;
    steps = [
      checkout
      bun
      install
      serve
      {
        name = "Hardware acceleration for the emulator";
        run = ''
          echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
          sudo udevadm control --reload-rules
          sudo udevadm trigger --name-match=kvm
        '';
      }
      {
        name = "Tap the field, type, put the keyboard away";
        uses = "reactivecircus/android-emulator-runner@v2";
        "with" = {
          api-level = 34;
          target = "google_apis";
          arch = "x86_64";
          profile = "pixel_7";
          disable-animations = true;
          script = "bash browser/keyboard/android.sh";
        };
      }
      (pictures "keyboard-android")
    ];
  };
}
