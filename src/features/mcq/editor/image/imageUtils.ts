import type { ImageBlock } from "../types";

export async function imageFileToBlock(file: File): Promise<(block: ImageBlock) => ImageBlock> {
  const dataUrl = await readFileAsDataUrl(file);
  const dimensions = await readImageDimensions(dataUrl);
  const size = fitImageSize(dimensions.width, dimensions.height);

  return (current) => ({
    ...current,
    asset: {
      ...current.asset,
      dataUrl,
      fileName: file.name,
      altText: current.asset.altText || file.name.replace(/\.[^.]+$/, ""),
      naturalWidth: dimensions.width,
      naturalHeight: dimensions.height
    },
    settings: {
      ...current.settings,
      width: size.width,
      height: size.height,
      crop: { x: 0, y: 0, width: 100, height: 100 }
    }
  });
}

export async function clipboardImageToBlock(): Promise<((block: ImageBlock) => ImageBlock) | null> {
  if (!navigator.clipboard || !("read" in navigator.clipboard)) return null;
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const imageType = item.types.find((type) => type.startsWith("image/"));
    if (!imageType) continue;
    const blob = await item.getType(imageType);
    const extension = imageType.split("/")[1] || "png";
    return imageFileToBlock(new File([blob], `clipboard-image.${extension}`, { type: imageType }));
  }
  return null;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readImageDimensions(dataUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.naturalWidth || 640, height: image.naturalHeight || 360 });
    image.onerror = () => resolve({ width: 640, height: 360 });
    image.src = dataUrl;
  });
}

function fitImageSize(widthPx: number, heightPx: number) {
  const pxToMm = 0.264583;
  const maxWidth = 130;
  const maxHeight = 95;
  let width = Math.max(18, widthPx * pxToMm);
  let height = Math.max(12, heightPx * pxToMm);
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  width *= scale;
  height *= scale;
  return {
    width: Math.round(width),
    height: Math.round(height)
  };
}
