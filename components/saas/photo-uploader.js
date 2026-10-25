'use client';

import { usePreferences } from "@/components/saas/preferences";
import { useRef, useState } from 'react';
import { Camera, Upload, LoaderCircle } from 'lucide-react';
async function demoPhoto(file) {
  const bitmap = await createImageBitmap(file);
  const size = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 256, 256);
  bitmap.close();
  return canvas.toDataURL('image/webp', .85);
}
export function PhotoUploader({
  employee,
  isDemo,
  onUploaded,
  onError,
  compact = false
}) {
  const {
    t
  } = usePreferences();
  const input = useRef(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [loadedPhoto, setLoadedPhoto] = useState({identity: '', url: ''});
  const [failedPhoto, setFailedPhoto] = useState('');
  const identity = employee.id || employee.email || employee.name;
  const displayedPhoto = employee.photoUrl && loadedPhoto.identity === identity ? loadedPhoto.url : '';
  const photoKey = `${identity}:${employee.photoUrl || ''}`;
  const previewLoading = !!employee.photoUrl && employee.photoUrl !== displayedPhoto && failedPhoto !== photoKey;
  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Choose an image smaller than 2 MB.');
      return;
    }
    setBusy(true);
    try {
      let photoUrl;
      if (isDemo) photoUrl = await demoPhoto(file);else {
        const form = new FormData();
        form.append('file', file);
        form.append('employeeId', employee.id);
        const response = await fetch('/api/uploads', {
          method: 'POST',
          body: form
        });
        const result = await response.json();
        if (!response.ok) throw Error(result.error || 'Photo upload failed');
        photoUrl = result.photoUrl || result.url;
      }
      await onUploaded(photoUrl);
      event.target.value = '';
    } catch (e) {
      const message = e.message || 'Unable to upload this image. Please try another photo.';
      setError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }
  return <div className={`photo-uploader ${compact ? 'compact' : ''}`} aria-busy={busy || (!compact && previewLoading)}><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Upload photo for ${employee.name}`} onChange={upload} disabled={busy} className="photo-file-input" />{!compact && <span className="photo-preview">{displayedPhoto ? <img src={displayedPhoto} alt={`${employee.name}'s profile photo`} /> : busy || previewLoading ? <span className="photo-preview-shimmer saas-shimmer" aria-hidden="true"/> : <Camera size={25} />}{previewLoading && <img key={photoKey} className="photo-preview-incoming" src={employee.photoUrl} alt="" aria-hidden="true" onLoad={() => setLoadedPhoto({identity, url: employee.photoUrl})} onError={() => setFailedPhoto(photoKey)}/>}{displayedPhoto && (busy || previewLoading) && <span className="photo-preview-progress saas-shimmer" aria-hidden="true"/>}</span>}<div className="photo-upload-copy"><button type="button" className="btn btn-outline btn-sm" onClick={() => input.current?.click()} disabled={busy}>{busy ? <LoaderCircle size={14} className="photo-upload-spinner" /> : <Upload size={14} />} {t(busy ? 'Uploading…' : employee.photoUrl ? 'Change photo' : 'Upload photo')}</button>{busy && <span className="photo-upload-progress saas-shimmer" aria-hidden="true"/>}<p>{t("JPG, PNG or WebP \xB7 up to 2 MB")}</p>{!compact && <small>{t(isDemo ? 'Saved in this demo browser.' : 'Saved immediately to this employee profile.')}</small>}</div>{(busy || (!compact && previewLoading)) && <span className="saas-visually-hidden" role="status">{t(busy ? 'Uploading…' : 'Loading profile photo…')}</span>}{error && <p className="photo-error" role="alert">{error}</p>}</div>;
}
