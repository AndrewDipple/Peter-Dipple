import { supabase } from "@/lib/supabase";

const PROGRESS_PHOTOS_BUCKET = "progress-photos";

type ProgressPhotoPathSource = {
  image_url?: string | null;
  storage_path?: string | null;
};

export function getProgressPhotoPath(photo: ProgressPhotoPathSource) {
  if (photo.storage_path) return photo.storage_path;
  if (!photo.image_url) return null;

  const marker = `/${PROGRESS_PHOTOS_BUCKET}/`;
  const markerIndex = photo.image_url.indexOf(marker);

  if (markerIndex >= 0) {
    return decodeURIComponent(photo.image_url.slice(markerIndex + marker.length));
  }

  return photo.image_url.startsWith("http") ? null : photo.image_url;
}

export async function withSignedProgressPhotoUrls<
  T extends ProgressPhotoPathSource,
>(photos: T[]) {
  const paths = Array.from(
    new Set(
      photos
        .map(getProgressPhotoPath)
        .filter((path): path is string => Boolean(path))
    )
  );

  let urls: Record<string, string> = {};

  if (paths.length > 0) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      try {
        const response = await fetch("/api/progress-photo-urls", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paths }),
        });

        if (response.ok) {
          const result = (await response.json()) as {
            urls?: Record<string, string>;
          };
          urls = result.urls ?? {};
        }
      } catch (error) {
        console.error("Could not sign progress photo URLs", error);
      }
    }
  }

  return photos.map((photo) => {
    const path = getProgressPhotoPath(photo);

    return {
      ...photo,
      storage_path: path,
      signed_url: path ? urls[path] ?? null : photo.image_url ?? null,
    };
  });
}
