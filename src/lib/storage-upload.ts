import { supabase } from "@/integrations/supabase/client";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface UploadValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageFile(file: File): UploadValidationResult {
  if (!file) return { valid: false, error: "Vui lòng chọn một tệp ảnh." };
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: "Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP. Không hỗ trợ SVG." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "Kích thước tệp không được vượt quá 5 MB." };
  }
  return { valid: true };
}

/** Sanitize a filename to be URL-safe. */
export function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

/** Generate a unique object path for a product image. */
export function productImagePath(productId: string, file: File): string {
  const safe = sanitizeFilename(file.name);
  return `products/${productId}/${Date.now()}-${safe}`;
}

/** Generate a unique object path for a site asset. */
export function siteAssetPath(folder: "logo" | "hero", file: File): string {
  const safe = sanitizeFilename(file.name);
  return `${folder}/${Date.now()}-${safe}`;
}

export interface UploadResult {
  path: string;
  publicUrl: string;
}

/**
 * Upload a file to a Supabase Storage bucket.
 * Returns the storage path and public URL on success.
 * Throws on error.
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<UploadResult> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) {
    console.error("[storage] upload error", {
      bucket,
      path,
      code: (error as { statusCode?: string }).statusCode,
      message: error.message,
    });
    throw new Error("Không thể tải ảnh lên: " + error.message);
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return { path: data.path, publicUrl: urlData.publicUrl };
}

/**
 * Remove a file from Supabase Storage bucket.
 * Logs but does not throw on failure.
 */
export async function removeFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.error("[storage] remove error", {
      bucket,
      path,
      message: error.message,
    });
  }
}

/** Validate a CTA link. Allows internal paths and http/https URLs only. */
export function validateCtaLink(value: string): boolean {
  if (!value) return true; // optional
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Validate a hex color like #22C55E */
export function validateHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}
