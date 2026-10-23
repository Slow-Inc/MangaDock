"use client";

import { useState, useRef, useCallback } from "react";
import PostImage from "./PostImage";
import { uploadForumImage } from "../lib/communityApi";
import Loader from "./ui/Loader";
import { PRIMARY_FILL } from "./ui/Button";
import { useToast } from "../contexts/ToastContext";
import { tooLargeToUpload } from "../lib/uploadLimits";

interface PostImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export default function PostImageUploader({ images, onChange, maxImages = 4 }: PostImageUploaderProps) {
  const [tab, setTab] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const { showToast } = useToast();
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canAddMore = images.length < maxImages;

  const addUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed || images.includes(trimmed) || !canAddMore) return;
    onChange([...images, trimmed]);
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const handleUrlAdd = () => {
    addUrl(urlInput);
    setUrlInput('');
  };

  const handleFileUpload = async (file: File) => {
    if (!canAddMore || uploading) return;
    if (tooLargeToUpload(file)) {
      showToast({ type: "error", message: "ไฟล์ใหญ่เกิน 5 MB เลือกไฟล์ที่เล็กกว่านี้", duration: 4000 }); // the hint says 5MB; the server refuses more every time (#995)
      return;
    }
    setUploading(true);
    try {
      const { imageUrl } = await uploadForumImage(file);
      onChange([...images, imageUrl]);
    } catch {
      showToast({ type: "error", message: "อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง", duration: 3500 }); // was console-only (#987)
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFileUpload(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, uploading, canAddMore]);

  return (
    <div>
      <label className="block text-xs font-bold text-ink-3 uppercase mb-2">
        รูปภาพ ({images.length}/{maxImages})
      </label>

      {images.length > 0 && (
        <div className={`grid gap-2 mb-3 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-4'}`}>
          {images.map((url, i) => (
            <div key={i} className="relative rounded-lg overflow-hidden bg-fill border border-line group aspect-square">
              <PostImage url={url} alt={`รูปที่ ${i + 1}`} />
              <button
                type="button"
                onClick={() => removeImage(i)}
                aria-label={`ลบรูปที่ ${i + 1}`}
                className="absolute top-1 right-1 w-6 h-6 bg-bg/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity hover:bg-danger/90"
              >
                <svg className="w-3 h-3 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l18 18" />
                </svg>
              </button>
              <div className="absolute bottom-1 left-1 text-[9px] text-ink-2 bg-bg/50 px-1.5 py-0.5 rounded font-mono">
                {i + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {canAddMore && (
        <div className="border border-line rounded-xl overflow-hidden">
          <div className="flex border-b border-line">
            <button
              type="button"
              onClick={() => setTab('upload')}
              className={`flex-1 py-2 text-xs font-bold transition-colors ${
                tab === 'upload' ? 'bg-fill text-ink' : 'text-ink-2 hover:text-ink'
              }`}
            >
              อัพโหลดไฟล์
            </button>
            <button
              type="button"
              onClick={() => setTab('url')}
              className={`flex-1 py-2 text-xs font-bold transition-colors border-l border-line ${
                tab === 'url' ? 'bg-fill text-ink' : 'text-ink-2 hover:text-ink'
              }`}
            >
              ลิงก์รูปภาพ
            </button>
          </div>

          {tab === 'upload' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`p-6 text-center cursor-pointer transition-all ${
                dragOver ? 'bg-fill border-accent/30' : 'hover:bg-fill'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChange}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader context="section" />
                  <span className="text-ink-3 text-xs">กำลังอัพโหลด...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 pointer-events-none">
                  <svg className="w-8 h-8 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-ink-3 text-xs">วางไฟล์ที่นี่ หรือคลิกเพื่อเลือก</span>
                  <span className="text-ink-3 text-[10px]">JPEG, PNG, WebP, GIF • ไม่เกิน 5MB</span>
                </div>
              )}
            </div>
          )}

          {tab === 'url' && (
            <div className="p-3 flex gap-2">
              <input aria-label="ลิงก์รูปภาพ"
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlAdd()}
                placeholder="https://example.com/image.jpg"
                className="flex-1 bg-fill border border-line rounded-lg px-3 py-2 text-ink text-xs focus:border-accent transition-all"
              />
              <button
                type="button"
                onClick={handleUrlAdd}
                disabled={!urlInput.trim()}
                className={`px-4 py-2 rounded-lg ${PRIMARY_FILL} text-xs font-bold disabled:opacity-50 transition-all shrink-0`}
              >
                เพิ่ม
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
