import { apiFetch, apiFetchSafe } from "./client";

export interface BookmarkRow {
  id: string;
  spotify_track_id: string;
  title: string;
  artist: string;
  preview_url: string | null;
  image_url: string | null;
  audio_features: any;
  created_at: string;
}

export const bookmarksApi = {
  list: () => apiFetchSafe<BookmarkRow[]>("/api/bookmarks", []),

  add: (b: {
    spotify_track_id: string;
    title: string;
    artist: string;
    preview_url: string | null;
    image_url: string | null;
    audio_features: any;
  }) => apiFetch("/api/bookmarks", { method: "POST", json: b }),

  remove: (spotifyId: string) =>
    apiFetch("/api/bookmarks", {
      method: "DELETE",
      json: { spotify_track_id: spotifyId },
    }),
};
