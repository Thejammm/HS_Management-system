# AHS Compass: Node/Express. Coolify builds from this file instead of Nixpacks (Nixpacks re-downloaded
# the Node toolchain after the nightly cache wipe and sometimes hung: three Compass deploys sat for 24
# hours on 27 October 2026).
FROM node:22-alpine
WORKDIR /app

# The server-side report PDFs render through Chromium (routes/reports.js, lib/chromium.js). The reports'
# own font, Inter, ships in public/fonts; Liberation stands in for Arial and DejaVu carries the symbols.
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates font-liberation ttf-dejavu

# Dependencies first (layer reused unless package files change)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
# The real binary, not the launcher script: usableBrowser in lib/chromium.js only accepts a small script
# when it is nix's. The boot probe logs "PDF renderer: chromium found" when this is right.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/lib/chromium/chromium
EXPOSE 3000
CMD ["node", "server.js"]
