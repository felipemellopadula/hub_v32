// Types for Image Generation Module

export interface QualitySetting {
  id: string;
  label: string;
  width: number;
  height: number;
  steps: number;
}

export interface ImageModel {
  id: string;
  label: string;
  maxImages: number;
}

export interface DatabaseImage {
  id: string;
  user_id: string;
  prompt: string | null;
  image_path: string;
  width: number | null;
  height: number | null;
  format: string | null;
  created_at: string;
  is_public: boolean;
  _tempBase64?: string; // Preview temporário antes de salvar no storage
}
