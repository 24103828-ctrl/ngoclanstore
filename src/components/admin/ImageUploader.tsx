import { useCallback, useRef, useState } from "react";
import { Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validateImageFile } from "@/lib/storage-upload";
import { cn } from "@/lib/utils";

export interface ImageUploaderProps {
  /** Current image URL to preview (from DB or external URL). */
  currentUrl?: string | null;
  /** Called when a valid file is selected. The file is NOT uploaded yet. */
  onFileSelect: (file: File | null) => void;
  /** Whether an upload is currently in progress. */
  uploading?: boolean;
  /** Recommended aspect ratio text. */
  aspectHint?: string;
  className?: string;
}

export function ImageUploader({
  currentUrl,
  onFileSelect,
  uploading = false,
  aspectHint = "Khuyến nghị tỉ lệ 4:3",
  className,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) {
        setPreview(null);
        setValidationError(null);
        onFileSelect(null);
        return;
      }
      const result = validateImageFile(file);
      if (!result.valid) {
        setValidationError(result.error ?? "Tệp không hợp lệ.");
        return;
      }
      setValidationError(null);
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      onFileSelect(file);
    },
    [onFileSelect],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    handleFile(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    handleFile(file);
  };

  const clearSelection = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setValidationError(null);
    onFileSelect(null);
  };

  const displayUrl = preview ?? currentUrl;

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleInputChange}
        disabled={uploading}
      />

      <div
        className={cn(
          "relative border-2 border-dashed rounded-xl transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 bg-muted/20",
          uploading && "opacity-50 pointer-events-none",
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {displayUrl ? (
          <div className="relative group">
            <img
              src={displayUrl}
              alt="Ảnh đã chọn"
              className="w-full h-48 object-cover rounded-xl"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                Thay ảnh
              </Button>
              {preview && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={clearSelection}
                  disabled={uploading}
                >
                  <X className="size-4 mr-1" /> Xóa ảnh đã chọn
                </Button>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="w-full py-10 flex flex-col items-center gap-3 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <div className="size-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            ) : (
              <Upload className="size-10" />
            )}
            <div className="text-sm font-medium">
              {uploading ? "Đang tải lên…" : "Chọn ảnh từ máy"}
            </div>
            <div className="text-xs text-muted-foreground text-center px-4">
              Kéo thả hoặc nhấn để chọn · JPEG, PNG, WebP · Tối đa 5 MB
              <br />
              {aspectHint}
            </div>
          </button>
        )}
      </div>

      {!displayUrl && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <ImageIcon className="size-4 mr-2" />
          Chọn ảnh từ máy
        </Button>
      )}

      {validationError && (
        <p className="text-xs text-destructive">{validationError}</p>
      )}
    </div>
  );
}
