const sharp = require("sharp");
const path = require("path");

const assets = path.join(__dirname, "..", "assets");

async function build(svg, out, w, h) {
  await sharp(path.join(assets, svg))
    .resize(w, h)
    .png()
    .toFile(path.join(assets, out));
  console.log(`✓ ${out} (${w}x${h})`);
}

(async () => {
  await build("icon.svg", "icon.png", 1024, 1024);
  await build("adaptive-icon.svg", "adaptive-icon.png", 1024, 1024);
  await build("splash.svg", "splash.png", 1284, 2778);
  await build("icon.svg", "favicon.png", 48, 48);
  console.log("\nOK");
})();
