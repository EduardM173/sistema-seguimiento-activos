import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Printer, QrCode } from 'lucide-react';

type AssetQrCodeProps = {
  assetId: string;
  codigo: string;
  nombre: string;
};

function buildAssetDetailUrl(assetId: string) {
  const detailPath = `/activos/${encodeURIComponent(assetId)}`;
  const configuredOrigin = import.meta.env.VITE_PUBLIC_APP_URL;

  if (typeof configuredOrigin === 'string' && configuredOrigin.trim()) {
    return `${configuredOrigin.trim().replace(/\/+$/, '')}${detailPath}`;
  }

  if (typeof window === 'undefined') {
    return detailPath;
  }

  return `${window.location.origin}${detailPath}`;
}

function safeFileName(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[char];
  });
}

export default function AssetQrCode({ assetId, codigo, nombre }: AssetQrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [qrReady, setQrReady] = useState(false);
  const [qrError, setQrError] = useState('');
  const [copied, setCopied] = useState(false);

  const qrValue = useMemo(() => buildAssetDetailUrl(assetId), [assetId]);
  const displayPath = useMemo(
    () => `/activos/${encodeURIComponent(assetId)}`,
    [assetId],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setQrReady(false);
    setQrError('');

    QRCode.toCanvas(canvas, qrValue, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    })
      .then(() => setQrReady(true))
      .catch(() => {
        setQrError('No se pudo generar el codigo QR del activo.');
        setQrReady(false);
      });
  }, [qrValue]);

  function getQrImage() {
    const canvas = canvasRef.current;
    if (!canvas || !qrReady) return null;

    return canvas.toDataURL('image/png');
  }

  function handleDownload() {
    const imageUrl = getQrImage();
    if (!imageUrl) return;

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `qr-activo-${safeFileName(codigo) || assetId}.png`;
    link.click();
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(qrValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function handlePrint() {
    const imageUrl = getQrImage();
    if (!imageUrl) return;

    const printWindow = window.open('', '_blank', 'width=420,height=560');
    if (!printWindow) return;

    const safeCodigo = escapeHtml(codigo);
    const safeNombre = escapeHtml(nombre);

    printWindow.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Etiqueta de activo ${safeCodigo}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              font-family: Arial, sans-serif;
              color: #111827;
              background: #f8fafc;
            }
            .label {
              width: 320px;
              padding: 20px;
              border: 1px solid #d1d5db;
              border-radius: 8px;
              background: #ffffff;
              text-align: center;
            }
            .label img {
              width: 220px;
              height: 220px;
              display: block;
              margin: 0 auto 14px;
            }
            .code {
              margin: 0 0 8px;
              font-size: 18px;
              font-weight: 700;
              word-break: break-word;
            }
            .name {
              margin: 0;
              font-size: 14px;
              line-height: 1.4;
              word-break: break-word;
            }
            @media print {
              body { background: #ffffff; }
              .label { border-color: #111827; }
            }
          </style>
        </head>
        <body>
          <section class="label" aria-label="Etiqueta de activo">
            <img src="${imageUrl}" alt="QR del activo ${safeCodigo}" />
            <p class="code">${safeCodigo}</p>
            <p class="name">${safeNombre}</p>
          </section>
          <script>
            window.addEventListener('load', () => {
              window.focus();
              window.print();
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <article className="assetQrCard" aria-label="Identificacion rapida mediante QR">
      <div className="assetQrCard__head">
        <div className="assetQrCard__titleWrap">
          <span className="assetQrCard__icon" aria-hidden="true">
            <QrCode size={20} />
          </span>
          <div>
            <h3 className="assetQrCard__title">Identificacion rapida mediante QR</h3>
            <p className="assetQrCard__subtitle">
              Escanea para abrir la ficha del activo.
            </p>
          </div>
        </div>
      </div>

      <div className="assetQrCard__content">
        <div className="assetQrCard__canvasWrap">
          <canvas ref={canvasRef} className="assetQrCard__canvas" />
        </div>

        <div className="assetQrCard__meta">
          <span className="assetQrCard__label">Enlace de la ficha</span>
          <span className="assetQrCard__url" title={qrValue}>{displayPath}</span>
        </div>
      </div>

      {qrError ? <p className="assetQrCard__error">{qrError}</p> : null}

      <div className="assetQrCard__actions">
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={handleDownload}
          disabled={!qrReady}
        >
          <Download size={16} />
          Descargar QR
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => void handleCopyLink()}
        >
          <Copy size={16} />
          {copied ? 'Copiado' : 'Copiar enlace'}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={handlePrint}
          disabled={!qrReady}
        >
          <Printer size={16} />
          Imprimir etiqueta
        </button>
      </div>
    </article>
  );
}
