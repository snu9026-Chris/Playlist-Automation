// Loopify DB 타입 정의
// Loopdrop Supabase 프로젝트 공��� — platforms 테이블은 공유

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      // Loopdrop 공유 테이블
      platforms: {
        Row: {
          id: number;
          name: string;
          status: string;
          oauth_token: string | null;
          refresh_token: string | null;
          expires_at: string | null;
          account_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          status?: string;
          oauth_token?: string | null;
          refresh_token?: string | null;
          expires_at?: string | null;
          account_name?: string | null;
        };
        Update: {
          oauth_token?: string | null;
          refresh_token?: string | null;
          expires_at?: string | null;
          account_name?: string | null;
          status?: string;
        };
      };

      track_bookmarks: {
        Row: {
          id: string;
          spotify_track_id: string;
          title: string;
          artist: string;
          preview_url: string | null;
          image_url: string | null;
          audio_features: Json | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          spotify_track_id: string;
          title: string;
          artist: string;
          preview_url?: string | null;
          image_url?: string | null;
          audio_features?: Json | null;
          notes?: string | null;
        };
        Update: {
          spotify_track_id?: string;
          title?: string;
          artist?: string;
          preview_url?: string | null;
          image_url?: string | null;
          audio_features?: Json | null;
          notes?: string | null;
        };
      };

      playlist_projects: {
        Row: {
          id: string;
          theme: string;
          status: string;
          reference_tracks: Json;
          prompts: Json;
          shorts_status: string;
          shorts_youtube_urls: string[];
          longform_status: string;
          longform_youtube_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          theme: string;
          status?: string;
          reference_tracks?: Json;
          prompts?: Json;
          shorts_status?: string;
          shorts_youtube_urls?: string[];
          longform_status?: string;
          longform_youtube_url?: string | null;
        };
        Update: {
          theme?: string;
          status?: string;
          reference_tracks?: Json;
          prompts?: Json;
          shorts_status?: string;
          shorts_youtube_urls?: string[];
          longform_status?: string;
          longform_youtube_url?: string | null;
        };
      };

      playlist_tracks: {
        Row: {
          id: string;
          project_id: string;
          slot_index: number;
          prompt: string;
          mp3_url: string | null;
          image_url: string | null;
          clip_start: number | null;
          clip_end: number | null;
          short_mp4_url: string | null;
          short_youtube_url: string | null;
          thumbnail_url: string | null;
          title: string | null;
          description: string | null;
          tags: string[];
          upload_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          slot_index: number;
          prompt: string;
          mp3_url?: string | null;
          image_url?: string | null;
          clip_start?: number | null;
          clip_end?: number | null;
          short_mp4_url?: string | null;
          short_youtube_url?: string | null;
          thumbnail_url?: string | null;
          title?: string | null;
          description?: string | null;
          tags?: string[];
          upload_status?: string;
        };
        Update: {
          prompt?: string;
          mp3_url?: string | null;
          image_url?: string | null;
          clip_start?: number | null;
          clip_end?: number | null;
          short_mp4_url?: string | null;
          short_youtube_url?: string | null;
          thumbnail_url?: string | null;
          title?: string | null;
          description?: string | null;
          tags?: string[];
          upload_status?: string;
        };
      };

      scheduled_uploads: {
        Row: {
          id: string;
          project_id: string | null;
          track_id: string | null;
          video_path: string | null;
          title: string | null;
          description: string | null;
          tags: string[] | null;
          first_comment: string | null;
          youtube_video_id: string | null;
          scheduled_at: string;
          status: string;
          retry_count: number;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          track_id?: string | null;
          video_path?: string | null;
          title?: string | null;
          description?: string | null;
          tags?: string[] | null;
          first_comment?: string | null;
          youtube_video_id?: string | null;
          scheduled_at: string;
          status?: string;
          retry_count?: number;
          error_message?: string | null;
        };
        Update: {
          video_path?: string | null;
          title?: string | null;
          description?: string | null;
          tags?: string[] | null;
          first_comment?: string | null;
          youtube_video_id?: string | null;
          scheduled_at?: string;
          status?: string;
          retry_count?: number;
          error_message?: string | null;
        };
      };
    };
  };
}

// Enum types
export type ProjectStatus = "draft" | "in_progress" | "completed" | "failed";
export type PipelineStatus = "pending" | "processing" | "completed" | "failed";
export type UploadStatus = "pending" | "uploading" | "completed" | "failed";
export type ScheduleStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

// JSON field types
export interface AudioFeatures {
  bpm: number | null;
  energy: number | null;
  danceability: number | null;
  valence: number | null;
  acousticness: number | null;
  instrumentalness: number | null;
  key: number | null;
  mode: number | null;
}

export interface ReferenceTrack {
  spotify_track_id: string;
  title: string;
  artist: string;
  image_url: string | null;
  audio_features: AudioFeatures | null;
}

export interface SunoPrompt {
  index: number;
  prompt: string;
  genre: string;
  mood: string;
}

// Convenience aliases
export type TrackBookmark = Database["public"]["Tables"]["track_bookmarks"]["Row"];
export type PlaylistProject = Database["public"]["Tables"]["playlist_projects"]["Row"];
export type PlaylistTrack = Database["public"]["Tables"]["playlist_tracks"]["Row"];
export type ScheduledUpload = Database["public"]["Tables"]["scheduled_uploads"]["Row"];
export type Platform = Database["public"]["Tables"]["platforms"]["Row"];
