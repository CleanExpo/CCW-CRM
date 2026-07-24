'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, RefreshCw, X, CheckCircle, AlertTriangle } from 'lucide-react';

interface PhotoCaptureWidgetProps {
  onCapture: (file: File) => void;
  isProcessing?: boolean;
  disabled?: boolean;
}

type CameraState = 'idle' | 'requesting' | 'active' | 'captured' | 'denied' | 'error';

export function PhotoCaptureWidget({
  onCapture,
  isProcessing = false,
  disabled = false,
}: PhotoCaptureWidgetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraState('requesting');
    setErrorMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState('active');
    } catch (err: unknown) {
      const e = err as DOMException;
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setCameraState('denied');
        setErrorMessage('Camera permission denied. Allow camera access in browser settings.');
      } else if (e.name === 'NotFoundError') {
        setCameraState('error');
        setErrorMessage('No camera found on this device.');
      } else {
        setCameraState('error');
        setErrorMessage('Could not start camera. Please try again.');
      }
    }
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedDataUrl(dataUrl);
    setCameraState('captured');
    stopCamera();

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
        onCapture(file);
      },
      'image/jpeg',
      0.92
    );
  }, [onCapture, stopCamera]);

  const retake = useCallback(() => {
    setCapturedDataUrl(null);
    setCameraState('idle');
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return (
    <>
      {/* Always-rendered hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* Idle — tap to open camera */}
      {cameraState === 'idle' && (
        <button
          onClick={startCamera}
          disabled={disabled}
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-600 bg-slate-800 transition-colors hover:border-blue-400 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Open camera to photograph products"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/20">
            <Camera className="h-8 w-8 text-blue-400" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-white">Take Product Photo</p>
            <p className="mt-1 text-sm text-slate-400">Point camera at cleaning equipment</p>
          </div>
        </button>
      )}

      {/* Requesting permission */}
      {cameraState === 'requesting' && (
        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-slate-800">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <p className="text-slate-300">Requesting camera access…</p>
          </div>
        </div>
      )}

      {/* Permission denied / error */}
      {(cameraState === 'denied' || cameraState === 'error') && (
        <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-4 rounded-2xl bg-slate-800 p-6">
          <AlertTriangle className="h-12 w-12 text-amber-400" />
          <p className="text-center font-semibold text-white">{errorMessage}</p>
          {cameraState === 'error' && (
            <button
              onClick={startCamera}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          )}
        </div>
      )}

      {/* Live camera viewfinder */}
      {cameraState === 'active' && (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
            aria-label="Camera viewfinder"
          />
          {/* Corner alignment guides */}
          <div className="pointer-events-none absolute inset-8">
            <div className="absolute top-0 left-0 h-8 w-8 rounded-tl border-t-2 border-l-2 border-white/70" />
            <div className="absolute top-0 right-0 h-8 w-8 rounded-tr border-t-2 border-r-2 border-white/70" />
            <div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl border-b-2 border-l-2 border-white/70" />
            <div className="absolute right-0 bottom-0 h-8 w-8 rounded-br border-r-2 border-b-2 border-white/70" />
          </div>
          {/* Controls */}
          <div className="absolute right-0 bottom-6 left-0 flex items-center justify-center">
            <button
              onClick={capturePhoto}
              className="h-16 w-16 rounded-full border-4 border-slate-200 bg-white shadow-xl transition-transform active:scale-95"
              aria-label="Capture photo"
            />
          </div>
          <button
            onClick={() => {
              stopCamera();
              setCameraState('idle');
            }}
            className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/70"
            aria-label="Close camera"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>
      )}

      {/* Captured preview */}
      {cameraState === 'captured' && capturedDataUrl && (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black">
          <Image
            src={capturedDataUrl}
            alt="Captured product photo"
            fill
            unoptimized
            sizes="100vw"
            className="object-cover"
          />
          {isProcessing ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900/60">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
              <p className="font-semibold text-white">Identifying products…</p>
              <p className="text-sm text-slate-300">AI vision analysing image</p>
            </div>
          ) : (
            <>
              <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-green-500 px-2 py-1 text-xs font-medium text-white">
                <CheckCircle className="h-3 w-3" />
                Captured
              </div>
              <button
                onClick={retake}
                className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-800/80 px-4 py-2 text-sm text-white transition-colors hover:bg-slate-700/80"
              >
                <RefreshCw className="h-4 w-4" />
                Retake
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
