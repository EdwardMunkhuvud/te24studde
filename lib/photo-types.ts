export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
export const MAX_ATTACHMENTS = 4;
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
export type PhotoItem = {
  id: string;
  fileName: string;
  caption: string;
  uploaderName: string;
  userId: string | null;
  createdAt: string;
  href: string;
  thumbnailHref: string;
};
export type PhotoPage = { photos: PhotoItem[]; nextCursor: string | null; total: number };
