import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ActivosService } from '@activos/config/browser';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SavedImage {
  id: string;
  /** Relative path from the backend, e.g. /uploads/activos/{id}/{file} */
  url: string;
  nombreOriginal: string;
  tipoMime: string;
  tamano: number;
}

/** Prefix relative backend URLs with the nginx consul-service segment. */
function toAbsoluteUrl(url: string): string {
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  return `/${ActivosService.BACKEND}${url}`;
}

// ── Component ────────────────────────────────────────────────────────────────

interface ImageGalleryProps {
  /** ID of the entity (asset or material) whose images to manage. */
  entityId: string;
  /** Called once on mount (and after upload/delete) to fetch saved images. */
  onLoad: (entityId: string) => Promise<SavedImage[]>;
  /** If provided, each thumbnail shows a delete button that calls this. */
  onDelete?: (entityId: string, imageId: string) => Promise<void>;
  /** If provided, a drop-zone / "add" tile is shown and this is called on new files. */
  onUpload?: (entityId: string, files: File[]) => Promise<SavedImage[]>;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  entityId,
  onLoad,
  onDelete,
  onUpload,
}) => {
  const [images, setImages] = useState<SavedImage[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'done' | 'error'>('loading');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadState('loading');
      setImages(await onLoad(entityId));
      setLoadState('done');
    } catch {
      setLoadState('done'); // show empty state rather than error
    }
  }, [entityId, onLoad]);

  useEffect(() => { load(); }, [load]);

  // ── Keyboard navigation for lightbox ────────────────────────────────────
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  setLightbox((i) => i !== null ? Math.max(0, i - 1) : null);
      if (e.key === 'ArrowRight') setLightbox((i) => i !== null ? Math.min(images.length - 1, i + 1) : null);
      if (e.key === 'Escape')     setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, images.length]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleDelete = async (img: SavedImage) => {
    if (!onDelete || deleting) return;
    setDeleting(img.id);
    try {
      await onDelete(entityId, img.id);
      setImages((prev) => prev.filter((i) => i.id !== img.id));
      setLightbox(null);
    } finally {
      setDeleting(null);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || !onUpload || uploading) return;
    const valid = Array.from(files).filter((f) =>
      f.type.match(/^image\/(jpeg|png|gif|webp|avif)$/),
    );
    if (!valid.length) return;
    setUploading(true);
    try {
      const created = await onUpload(entityId, valid);
      setImages((prev) => [...prev, ...created]);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  // ── Camera via getUserMedia ───────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      // Fallback: open file picker if camera not available
      fileRef.current?.click();
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const dt = new DataTransfer();
      dt.items.add(file);
      stopCamera();
      void handleUpload(dt.files);
    }, 'image/jpeg', 0.92);
  };

  // Attach stream to video element once the overlay mounts
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play();
    }
  }, [cameraOpen]);

  // Stop camera on unmount
  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  const canUpload = !!onUpload;

  if (loadState === 'loading') {
    return (
      <p style={{ margin: '4px 0', color: 'var(--color-text-muted)', fontSize: '13px' }}>
        Cargando imágenes...
      </p>
    );
  }

  return (
    <>
      {/* Thumbnail grid */}
      {images.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: canUpload ? '12px' : 0 }}>
          {images.map((img, idx) => (
            <div
              key={img.id}
              style={{
                position: 'relative',
                width: '90px',
                height: '90px',
                borderRadius: '4px',
                overflow: 'hidden',
                border: '1px solid var(--color-border-strong)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <img
                src={toAbsoluteUrl(img.url)}
                alt={img.nombreOriginal}
                onClick={() => setLightbox(idx)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />

              {/* Delete button */}
              {onDelete && (
                <button
                  type="button"
                  disabled={deleting === img.id}
                  onClick={(e) => { e.stopPropagation(); handleDelete(img); }}
                  style={{
                    position: 'absolute',
                    top: '3px',
                    right: '3px',
                    background: 'rgba(0,0,0,0.7)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '22px',
                    height: '22px',
                    color: deleting === img.id ? 'var(--color-text-muted)' : 'var(--color-danger)',
                    fontSize: '12px',
                    cursor: deleting === img.id ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    lineHeight: 1,
                  }}
                  title="Eliminar imagen"
                >
                  ✕
                </button>
              )}

              {/* Filename caption */}
              <div
                onClick={() => setLightbox(idx)}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'rgba(0,0,0,0.55)',
                  color: '#fff',
                  fontSize: '9px',
                  padding: '2px 4px',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {img.nombreOriginal}
              </div>
            </div>
          ))}

          {/* "Add more" + camera tiles */}
          {canUpload && (
            <>
              <div
                onClick={() => fileRef.current?.click()}
                title="Añadir más imágenes"
                style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '4px',
                  border: '2px dashed var(--color-border-strong)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: uploading ? 'default' : 'pointer',
                  color: 'var(--color-text-muted)',
                  fontSize: '11px',
                  gap: '4px',
                  background: 'var(--glass-bg)',
                  flexShrink: 0,
                  opacity: uploading ? 0.5 : 1,
                }}
              >
                {uploading ? (
                  <span>...</span>
                ) : (
                  <>
                    <span style={{ fontSize: '22px' }}>+</span>
                    <span>Añadir</span>
                  </>
                )}
              </div>
              <div
                onClick={() => { if (!uploading) void startCamera(); }}
                title="Tomar foto con la cámara"
                style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '4px',
                  border: '2px dashed var(--color-border-strong)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: uploading ? 'default' : 'pointer',
                  color: 'var(--color-text-muted)',
                  fontSize: '11px',
                  gap: '4px',
                  background: 'var(--glass-bg)',
                  flexShrink: 0,
                  opacity: uploading ? 0.5 : 1,
                }}
              >
                {uploading ? (
                  <span>...</span>
                ) : (
                  <>
                    <span style={{ fontSize: '22px' }}>📷</span>
                    <span>Cámara</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        /* Empty state */
        !canUpload && (
          <p style={{ margin: '4px 0 8px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            Sin imágenes
          </p>
        )
      )}

      {/* Drop zone (shown when no images yet and upload is enabled) */}
      {images.length === 0 && canUpload && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
            borderRadius: '6px',
            padding: '20px',
            textAlign: 'center',
            background: dragOver ? 'var(--color-primary-muted)' : 'var(--glass-bg)',
            cursor: 'pointer',
            transition: 'border-color 0.2s, background 0.2s',
          }}
        >
          <p style={{ margin: '0 0 6px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            Arrastra imágenes o haz clic para seleccionar
          </p>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '11px' }}>
            JPG, PNG, GIF, WEBP, AVIF · máx. 10 MB por imagen
          </p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void startCamera(); }}
            disabled={uploading}
            style={{
              marginTop: '10px',
              background: 'none',
              border: '1px solid var(--color-border-strong)',
              borderRadius: '4px',
              padding: '5px 12px',
              color: 'var(--color-text-muted)',
              fontSize: '12px',
              cursor: uploading ? 'default' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            📷 Tomar foto
          </button>
        </div>
      )}

      {/* Hidden file input */}
      {canUpload && (
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => { handleUpload(e.target.files); e.target.value = ''; }}
        />
      )}

      {/* Camera overlay */}
      {cameraOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.97)',
            zIndex: 10000, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '20px',
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ maxWidth: '90vw', maxHeight: '65vh', borderRadius: '8px', background: '#000' }}
          />
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={stopCamera}
              style={{
                padding: '10px 24px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '14px', cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={capturePhoto}
              style={{
                padding: '10px 28px', borderRadius: '6px', border: 'none',
                background: 'var(--color-primary, #4f8ef7)', color: '#fff',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '7px',
              }}
            >
              📷 Capturar foto
            </button>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>
            Apunta al objeto y pulsa “Capturar foto”
          </p>
        </div>
      )}

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {lightbox !== null && images[lightbox] && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.93)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setLightbox(null)}
        >
          {/* Close */}
          <button
            type="button"
            onClick={() => setLightbox(null)}
            style={{
              position: 'absolute',
              top: '16px',
              right: '20px',
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: '30px',
              cursor: 'pointer',
              lineHeight: 1,
              opacity: 0.8,
            }}
          >
            ✕
          </button>

          {/* Prev */}
          {lightbox > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i ?? 1) - 1); }}
              style={navBtn('left')}
            >
              ‹
            </button>
          )}

          {/* Image */}
          <img
            src={toAbsoluteUrl(images[lightbox].url)}
            alt={images[lightbox].nombreOriginal}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '82vh',
              objectFit: 'contain',
              borderRadius: '4px',
              boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
            }}
          />

          {/* Next */}
          {lightbox < images.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i ?? 0) + 1); }}
              style={navBtn('right')}
            >
              ›
            </button>
          )}

          {/* Caption + actions */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              marginTop: '14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px' }}>
              {images[lightbox].nombreOriginal} &nbsp;·&nbsp; {lightbox + 1} / {images.length}
            </span>

            {onDelete && (
              <button
                type="button"
                disabled={!!deleting}
                onClick={() => handleDelete(images[lightbox])}
                style={{
                  background: 'var(--color-danger)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 16px',
                  fontSize: '12px',
                  cursor: deleting ? 'default' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting === images[lightbox].id ? 'Eliminando...' : 'Eliminar imagen'}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};

function navBtn(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    [side]: '16px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '50%',
    width: '46px',
    height: '46px',
    color: '#fff',
    fontSize: '30px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
  };
}

export default ImageGallery;
