import { nanoid } from "nanoid";
import type { ImageBlock, ImageBlockSettings } from "./types";

export const defaultImageSettings: ImageBlockSettings = {
  width: 72,
  height: 38,
  lockAspectRatio: true,
  rotation: 0,
  crop: {
    x: 0,
    y: 0,
    width: 100,
    height: 100
  },
  horizontalAlignment: "center",
  verticalAlignment: "middle",
  spacingBefore: 6,
  spacingAfter: 6,
  border: false,
  caption: "",
  keepWithNext: false,
  pageBreakBefore: false,
  allowSplit: true,
  locked: false
};

export function createImageBlock(previous?: ImageBlock): ImageBlock {
  return {
    id: nanoid(),
    type: "image",
    asset: {
      fileName: "",
      altText: ""
    },
    settings: {
      ...(previous?.settings ?? defaultImageSettings),
      crop: { ...(previous?.settings.crop ?? defaultImageSettings.crop) }
    }
  };
}
