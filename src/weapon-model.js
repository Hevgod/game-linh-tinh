export const akmImage = new Image();
akmImage.addEventListener("error", () => {
  console.error("Unable to load the AKM reference image.");
});
akmImage.src = new URL("../assets/akm-reference.png", import.meta.url).href;

export function drawAKM(ctx, x, y, scale = 1) {
  if (!akmImage.complete || !akmImage.naturalWidth) return;

  const width = 112 * scale;
  const height = width * akmImage.naturalHeight / akmImage.naturalWidth;
  ctx.drawImage(akmImage, x - width / 2, y - height / 2, width, height);
}
