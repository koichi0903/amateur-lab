export const NON_VR_GENRE_OR_FILTER = "genre.is.null,genre.not.ilike.%VR%";

const VR_PATTERN = /\bvr\b|VR|ＶＲ|バーチャルリアリティ/i;

export function isVrGenre(genre: string | null | undefined) {
  return VR_PATTERN.test(genre ?? "");
}

export function isNonVrGenre(genre: string | null | undefined) {
  return !isVrGenre(genre);
}

export function isVrWork(work: { title?: string | null; genre?: string | null }) {
  return VR_PATTERN.test(work.title ?? "") || VR_PATTERN.test(work.genre ?? "");
}

export function isNonVrWork(work: { title?: string | null; genre?: string | null }) {
  return !isVrWork(work);
}
