import { get, set, keys, del } from "idb-keyval";

export async function processImageFile(
  file: File | Blob,
): Promise<{ dataUrl: string; naturalW: number; naturalH: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 1440;
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX || h > MAX) {
          if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const cvs = document.createElement("canvas");
        cvs.width = w; cvs.height = h;
        cvs.getContext("2d")!.drawImage(img, 0, 0, w, h);
        const mimeType = file instanceof File ? file.type : "image/png";
        const dataUrl = mimeType === "image/png"
          ? cvs.toDataURL("image/png")
          : cvs.toDataURL("image/jpeg", 0.85);
        resolve({ dataUrl, naturalW: w, naturalH: h });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

interface ImageEntry {
  el: HTMLImageElement;
  dataUrl: string;
}

const cache = new Map<string, ImageEntry>();

function idbKey(id: string) {
  return `drawtool-img-${id}`;
}

export async function storeImage(id: string, dataUrl: string): Promise<void> {
  await set(idbKey(id), dataUrl);
  await new Promise<void>((resolve) => {
    const el = new Image();
    el.onload = () => { cache.set(id, { el, dataUrl }); resolve(); };
    el.onerror = () => { cache.set(id, { el, dataUrl }); resolve(); };
    el.src = dataUrl;
  });
}

export function getImageEl(id: string): HTMLImageElement | undefined {
  return cache.get(id)?.el;
}

export function getImageDataUrl(id: string): string | undefined {
  return cache.get(id)?.dataUrl;
}

export async function loadImages(ids: string[]): Promise<void> {
  const missing = ids.filter((id) => !cache.has(id));
  await Promise.all(
    missing.map(async (id) => {
      const dataUrl = await get<string>(idbKey(id));
      if (!dataUrl) return;
      await new Promise<void>((resolve) => {
        const el = new Image();
        el.onload = () => {
          cache.set(id, { el, dataUrl });
          resolve();
        };
        el.onerror = () => resolve();
        el.src = dataUrl;
      });
    }),
  );
}

const PREFIX = "drawtool-img-";

/** Delete IDB entries (and in-memory cache) for any image not in `liveIds`. */
export async function gcImages(liveIds: Set<string>): Promise<void> {
  const allKeys = await keys<string>();
  const orphans = allKeys.filter(
    (k) => typeof k === "string" && k.startsWith(PREFIX) && !liveIds.has(k.slice(PREFIX.length)),
  );
  await Promise.all(
    orphans.map((k) => {
      const id = (k as string).slice(PREFIX.length);
      cache.delete(id);
      return del(k);
    }),
  );
}
