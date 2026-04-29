#!/usr/bin/env node
const message = `CSS Sentry Playwright setup for Arch/Manjaro

Playwright does not officially support Arch Linux and may download an Ubuntu fallback browser that asks for apt-style libraries such as libicu74 or libflite1.

Recommended Arch path:
  1. Install the distro Chromium package:
     sudo pacman -S --needed chromium

  2. Run e2e tests with the system browser:
     PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=$(command -v chromium) pnpm run test:e2e

If Playwright still reports missing shared libraries, install the usual desktop/browser runtime packages:
  sudo pacman -S --needed icu libxml2 flite nss nspr atk at-spi2-core cups libdrm libxkbcommon libxcomposite libxdamage libxfixes libxrandr mesa gtk3 pango cairo alsa-lib libxss libxtst libx11 libxcb libxext libxrender libxshmfence glib2

For Debian/Ubuntu CI or supported Playwright hosts, use:
  pnpm run setup:e2e:browser
  pnpm run test:e2e

Do not run pnpm exec playwright install-deps on Arch; it is an apt-based helper for Debian/Ubuntu-like systems.`;
console.log(message);
