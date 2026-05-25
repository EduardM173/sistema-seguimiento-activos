import React, { useRef, useState, useCallback, useEffect } from 'react';

export interface PendingImage {
  file: File;
  preview: string;
}

interface ImageUploaderProps {
  images: PendingImage[];
  onChange: (images: PendingImage[]) => void;
  maxImages?: number;
  disabled?: boolean;
  /** Optional label shown above the drop zone */
  label?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  images,
  onChange,
  maxImages = 10,
  disabled = false,
  label,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const remaining = maxImages - images.length;
      if (remaining <= 0) return;

      const newImages: PendingImage[] = [];
      Array.from(files)
        .slice(0, remaining)
        .forEach((file) => {
          if (!file.type.match(/^image\/(jpeg|png|gif|webp|avif)$/)) return;
          const preview = URL.createObjectURL(file);
          newImages.push({ file, preview });
        });

      onChange([...images, ...newImages]);
    },
    [images, maxImages, onChange],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    const updated = [...images];
    URL.revokeObjectURL(updated[index].preview);
    updated.splice(index, 1);
    onChange(updated);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const canAdd = images.length < maxImages && !disabled;

  return (
    <div style={{ marginBottom: '8px' }}>
      {label && (
        <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {label}
        </p>
      )}

      {/* Drop zone */}
      {canAdd && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragging ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
            borderRadius: '6px',
            padding: '20px 16px',
            textAlign: 'center',
            background: dragging ? 'var(--color-primary-muted)' : 'var(--glass-bg)',
            cursor: 'pointer',
            transition: 'border-color 0.2s, background 0.2s',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.7 }}>⬆</div>
          <p style={{ margin: '0 0 12px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            Arrastra imágenes aquí o usa los botones
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              style={btnStyle('var(--color-primary)')}
            >
              Seleccionar archivos
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setShowCamera(true)}
              style={btnStyle('var(--color-success)')}
            >
              Usar cámara
            </button>
          </div>
          <p style={{ margin: '10px 0 0', color: 'var(--color-text-muted)', fontSize: '11px' }}>
            JPG, PNG, GIF, WEBP, AVIF · máx. 10 MB por imagen · {images.length}/{maxImages}
          </p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Camera viewfinder modal */}
      {showCamera && (
        <CameraModal
          onCapture={(file) => {
            const remaining = maxImages - images.length;
            if (remaining <= 0) return;
            const preview = URL.createObjectURL(file);
            onChange([...images, { file, preview }]);
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Previews */}
      {images.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            marginTop: '14px',
          }}
        >
          {images.map((img, idx) => (
            <div
              key={idx}
              style={{
                position: 'relative',
                width: '90px',
                height: '90px',
                borderRadius: '4px',
                overflow: 'hidden',
                border: '1px solid var(--color-border-strong)',
                flexShrink: 0,
              }}
            >
              <img
                src={img.preview}
                alt={img.file.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  style={{
                    position: 'absolute',
                    top: '3px',
                    right: '3px',
                    background: 'rgba(0,0,0,0.65)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    color: 'var(--color-danger)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                  title="Quitar imagen"
                >
                  ✕
                </button>
              )}
              <div
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
                {img.file.name}
              </div>
            </div>
          ))}

          {/* Add more tile */}
          {canAdd && (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '90px',
                height: '90px',
                borderRadius: '4px',
                border: '2px dashed var(--color-border-strong)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                fontSize: '11px',
                gap: '4px',
                background: 'var(--glass-bg)',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '22px' }}>+</span>
              <span>Añadir</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function btnStyle(color: string): React.CSSProperties {
  return {
    background: color,
    color: 'var(--color-text-on-primary)',
    border: 'none',
    borderRadius: '4px',
    padding: '7px 14px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 500,
  };
}

// ── Camera modal ────────────────────────────────────────────────────────────

interface CameraModalProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const startStream = useCallback(async (facing: 'environment' | 'user') => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setReady(false);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      }
    } catch {
      setError('No se pudo acceder a la cámara. Verifica los permisos del navegador.');
    }
  }, []);

  useEffect(() => {
    void startStream(facingMode);
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `captura-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
    }, 'image/jpeg', 0.92);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.97)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
      }}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '16px',
          right: '20px',
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '28px',
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        ✕
      </button>

      {/* Video feed */}
      <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '65vh', background: '#000', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '280px', minHeight: '180px' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ maxWidth: '90vw', maxHeight: '65vh', display: ready ? 'block' : 'none', borderRadius: '8px' }}
        />
        {!ready && !error && (
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0, padding: '32px' }}>
            Iniciando cámara…
          </p>
        )}
        {error && (
          <p style={{ color: '#f87171', fontSize: '13px', margin: 0, padding: '24px', textAlign: 'center' }}>
            {error}
          </p>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '10px 24px',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>

        {/* Flip camera */}
        <button
          type="button"
          onClick={() => setFacingMode((m) => m === 'environment' ? 'user' : 'environment')}
          disabled={!!error}
          title="Cambiar cámara"
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            color: '#fff',
            fontSize: '18px',
            cursor: error ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          🔄
        </button>

        <button
          type="button"
          onClick={capture}
          disabled={!ready}
          style={{
            padding: '10px 28px',
            borderRadius: '6px',
            border: 'none',
            background: ready ? 'var(--color-primary, #4f8ef7)' : 'rgba(79,142,247,0.3)',
            color: ready ? '#fff' : 'rgba(255,255,255,0.4)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: ready ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
          }}
        >
          📷 Capturar foto
        </button>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', margin: 0 }}>
        Apunta al objeto y pulsa «Capturar foto»
      </p>
    </div>
  );
};

export default ImageUploader;
