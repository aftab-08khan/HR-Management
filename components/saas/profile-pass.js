'use client';

import {useEffect, useRef, useState} from 'react';
import {useReducedMotion} from 'motion/react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {ArrowUpRight, Camera, Check, Download, Fingerprint, Hash, ImageUp, LoaderCircle, LockKeyhole, QrCode, ScanLine, ShieldCheck, Square, X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {usePreferences} from '@/components/saas/preferences';
import {createEmployeePassPayload, resolveEmployeePass, resolveManualEmployeeCode} from '@/lib/profile-code';

export function ProfilePass({employee, workspaceId}) {
  const {t} = usePreferences();
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const card = useRef(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    let cancelled = false;
    setQr(''); setError('');
    try {
      const payload = createEmployeePassPayload(employee, workspaceId);
      QRCode.toDataURL(payload, {width: 420, margin: 2, errorCorrectionLevel: 'M', color: {dark: '#172c25', light: '#ffffff'}}).then(url => {if (!cancelled) setQr(url);}).catch(() => {if (!cancelled) setError('The QR code could not be created. Please try again.');});
    } catch (cause) {setError(cause.message);}
    return () => {cancelled = true;};
  }, [employee?.id, employee?.employeeCode, employee?.workspaceId, workspaceId]);
  function tilt(event) {
    if (reduced || event.pointerType === 'touch' || !card.current) return;
    const bounds = card.current.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    card.current.style.setProperty('--pass-rotate-x', `${-y * 6}deg`);
    card.current.style.setProperty('--pass-rotate-y', `${x * 8}deg`);
    card.current.style.setProperty('--pass-glow-x', `${(x + 1) * 50}%`);
    card.current.style.setProperty('--pass-glow-y', `${(y + 1) * 50}%`);
  }
  function resetTilt() {
    card.current?.style.setProperty('--pass-rotate-x', '0deg');
    card.current?.style.setProperty('--pass-rotate-y', '0deg');
  }
  const initials = (employee?.name || 'Team member').split(' ').map(word => word[0]).join('').slice(0, 2);
  return <section className="profile-pass-section" aria-label={t('Employee profile pass')}>
    <div className="profile-pass-perspective"><div ref={card} className="profile-pass-card" onPointerMove={tilt} onPointerLeave={resetTilt}>
      <div className="profile-pass-grain" aria-hidden="true"/>
      <div className="profile-pass-brand"><span><span className="profile-pass-logo"><i/><i/><i/><i/></span>people<span>os</span></span><span><ShieldCheck size={12}/>{t('EMPLOYEE PASS')}</span></div>
      <div className="profile-pass-main"><span className="profile-pass-portrait">{employee?.photoUrl ? <img src={employee.photoUrl} alt={employee.name}/> : <span>{initials}</span>}<i><Check size={11}/></i></span><div className="profile-pass-name"><span>{t('ONE TEAM. EVERY POSSIBILITY.')}</span><h3>{employee?.name || t('Team member')}</h3><p>{employee?.role || t('Employee')}</p><small>{employee?.department || t('Your workspace')}</small></div></div>
      <div className="profile-pass-bottom"><div className="profile-pass-details"><span><Fingerprint size={15}/>{t('Employee ID')}</span><strong>{employee?.employeeCode || t('Not assigned')}</strong><small><LockKeyhole size={10}/>{t('Workspace access required')}</small></div><div className="profile-pass-qr" aria-busy={!qr && !error}>{qr ? <img src={qr} alt={t('QR code for {name}', {name: employee?.name || t('Employee')})}/> : error ? <span><QrCode size={28} aria-hidden="true"/></span> : <span className="profile-pass-qr-loading saas-shimmer" role="status" aria-label={t('Generating QR code')}><QrCode size={31} aria-hidden="true"/></span>}</div></div>
      <div className="profile-pass-footer"><span>{t('YOUR PEOPLE. YOUR PLACE.')}</span><span><ScanLine size={13}/>{t('SCAN TO VIEW PROFILE')}</span></div>
    </div></div>
    <div className="profile-pass-actions"><p><ShieldCheck size={14}/>{t('Your QR contains a workspace and employee ID. Profile access still requires sign-in.')}</p>{qr && <a className="btn btn-outline btn-sm" href={qr} download={`employee-${String(employee?.employeeCode || 'pass').replace(/[^a-zA-Z0-9_-]/g, '-')}-qr.png`}><Download size={14}/>{t('Download QR')}</a>}</div>
    {error && <p className="profile-pass-error" role="alert">{t(error)}</p>}
  </section>;
}

async function readQrFromCanvas(canvas, detector) {
  if (detector) {
    try {const found = await detector.detect(canvas); if (found.length) return found[0].rawValue;} catch {/* Browser decoder support varies; jsQR is the fallback. */}
  }
  const context = canvas.getContext('2d', {willReadFrequently: true});
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(image.data, image.width, image.height, {inversionAttempts: 'attemptBoth'})?.data || null;
}

export function ProfileScanner({workspaceId, employees = [], onSelect, onClose}) {
  const {t} = usePreferences();
  const [camera, setCamera] = useState('idle');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [lastFile, setLastFile] = useState('');
  const video = useRef(null);
  const imageInput = useRef(null);
  const stream = useRef(null);
  const animation = useRef(null);
  const token = useRef(0);
  const mounted = useRef(false);
  const current = useRef({workspaceId, employees, onSelect});
  current.current = {workspaceId, employees, onSelect};

  function stopCamera(updateState = true) {
    token.current += 1;
    if (animation.current) cancelAnimationFrame(animation.current);
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    if (updateState && mounted.current) setCamera('idle');
  }
  useEffect(() => {
    mounted.current = true;
    function handleVisibility() {if (document.hidden) stopCamera();}
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {mounted.current = false; stopCamera(false); document.removeEventListener('visibilitychange', handleVisibility);};
  }, []);
  // A workspace change invalidates an in-progress camera scan immediately.
  useEffect(() => {stopCamera(); setError('');}, [workspaceId]);
  function openPayload(value) {
    const employee = resolveEmployeePass(value, current.current.workspaceId, current.current.employees);
    stopCamera();
    current.current.onSelect(employee);
  }
  async function startCamera() {
    if (camera !== 'idle') return;
    setError(''); setLastFile('');
    if (!navigator.mediaDevices?.getUserMedia) {setError('Camera access is unavailable. Upload a QR image or enter an employee ID.'); return;}
    setCamera('starting');
    const scanToken = ++token.current;
    try {
      const media = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}, width: {ideal: 1280}, height: {ideal: 720}}, audio: false});
      if (!mounted.current || scanToken !== token.current) {media.getTracks().forEach(track => track.stop()); return;}
      stream.current = media;
      video.current.srcObject = media;
      await video.current.play();
      if (!mounted.current || scanToken !== token.current) return;
      setCamera('scanning');
      let detector;
      if (typeof window.BarcodeDetector === 'function') {try {detector = new window.BarcodeDetector({formats: ['qr_code']});} catch {}}
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', {willReadFrequently: true});
      let busy = false, previousFrame = 0, rejected = '';
      async function scanFrame(time) {
        if (!mounted.current || scanToken !== token.current) return;
        animation.current = requestAnimationFrame(scanFrame);
        if (busy || time - previousFrame < 200 || !video.current?.videoWidth) return;
        busy = true; previousFrame = time;
        try {
          const element = video.current;
          const ratio = Math.min(1, 960 / element.videoWidth);
          canvas.width = Math.round(element.videoWidth * ratio);
          canvas.height = Math.round(element.videoHeight * ratio);
          context.drawImage(element, 0, 0, canvas.width, canvas.height);
          const value = await readQrFromCanvas(canvas, detector);
          if (!value || !mounted.current || scanToken !== token.current || value === rejected) return;
          try {openPayload(value);} catch (cause) {rejected = value; setError(cause.message);}
        } catch {/* A frame may be unavailable while a browser changes camera state. */}
        finally {busy = false;}
      }
      animation.current = requestAnimationFrame(scanFrame);
    } catch (cause) {
      if (!mounted.current || scanToken !== token.current) return;
      stopCamera();
      setError(cause.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access, upload a QR image, or enter an employee ID.' : cause.name === 'NotFoundError' ? 'No camera was found. Upload a QR image or enter an employee ID.' : 'The camera could not start. Check camera access or use the image upload.');
    }
  }
  async function uploadQr(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    stopCamera(); setError(''); setLastFile('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {setError('Choose a PNG, JPG, or WebP image containing a QR code.'); event.target.value = ''; return;}
    if (file.size > 10 * 1024 * 1024) {setError('Choose an image smaller than 10 MB.'); event.target.value = ''; return;}
    setUploading(true);
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 32 * 1024 * 1024) throw Error('Choose an image with fewer than 32 megapixels.');
      const ratio = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * ratio); canvas.height = Math.round(bitmap.height * ratio);
      canvas.getContext('2d', {willReadFrequently: true}).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const value = await readQrFromCanvas(canvas);
      if (!mounted.current) return;
      if (!value) throw Error('No QR code was found. Try a clearer image with the entire QR code visible.');
      setLastFile(file.name);
      openPayload(value);
    } catch (cause) {if (mounted.current) setError(cause.message?.includes('image') || cause.message?.includes('employee') || cause.message?.includes('workspace') || cause.message?.includes('PeopleOS') || cause.message?.includes('pass') ? cause.message : 'This image could not be read. Try another QR image.');}
    finally {bitmap?.close(); if (mounted.current) setUploading(false); event.target.value = '';}
  }
  function findManually(event) {
    event.preventDefault(); setError('');
    try {const employee = resolveManualEmployeeCode(manual, workspaceId, employees); stopCamera(); onSelect(employee);} catch (cause) {setError(cause.message);}
  }
  return <section className="profile-scanner">
    <div className="profile-scanner-intro"><span className="profile-scanner-intro-icon"><QrCode size={21}/></span><p>{t('Scan an employee pass to open a profile in your workspace.')}</p>{onClose && <button type="button" className="icon-button" onClick={() => {stopCamera(); onClose();}} aria-label={t('Close scanner')}><X size={17}/></button>}</div>
    <div className={`profile-scanner-view ${camera === 'scanning' ? 'is-scanning' : ''}`}>
      <video ref={video} autoPlay playsInline muted aria-label={t('QR scanner camera preview')}/>
      {camera !== 'scanning' && <div className="profile-scanner-placeholder"><span><ScanLine size={38} strokeWidth={1.2}/></span><strong>{t(camera === 'starting' ? 'Starting camera…' : 'Ready when you are')}</strong><p>{t('Position the full QR code inside the frame.')}</p></div>}
      <div className="profile-scanner-guides" aria-hidden="true"><i/><i/><i/><i/></div>
      {camera === 'scanning' && <span className="profile-scanner-live"><i/>{t('Looking for an employee QR…')}</span>}
    </div>
    <div className="profile-scanner-actions">{camera === 'idle' ? <Button type="button" onClick={startCamera} disabled={uploading}><Camera size={15}/>{t('Start camera')}</Button> : <Button type="button" variant="outline" onClick={() => stopCamera()}><Square size={13}/>{t(camera === 'starting' ? 'Cancel camera' : 'Stop camera')}</Button>}<input ref={imageInput} className="profile-scanner-file" type="file" accept="image/png,image/jpeg,image/webp" aria-label={t('Upload a QR code image')} onChange={uploadQr} disabled={uploading}/><Button type="button" variant="outline" disabled={uploading} onClick={() => imageInput.current?.click()}>{uploading ? <LoaderCircle size={15} className="pass-spinner"/> : <ImageUp size={15}/>} {t(uploading ? 'Reading QR…' : 'Upload QR image')}</Button></div>
    {lastFile && <p className="profile-scanner-file-name">{lastFile}</p>}
    {error && <p className="profile-pass-error profile-scanner-error" role="alert">{t(error)}</p>}
    <div className="profile-scanner-divider"><span/>{t('or look up an employee ID')}<span/></div>
    <form className="profile-scanner-manual" onSubmit={findManually}><label htmlFor="scanner-employee-code">{t('Employee ID')}</label><div><span><Hash size={16}/></span><input id="scanner-employee-code" name="employeeCode" placeholder={t('e.g. EMP-001')} value={manual} maxLength={200} onChange={event => setManual(event.target.value)} autoComplete="off" required/><Button type="submit" variant="outline">{t('Find profile')}<ArrowUpRight size={14}/></Button></div></form>
    <p className="profile-scanner-privacy"><LockKeyhole size={13}/>{t('Scans only open profiles already available to your role. Camera images stay on this device.')}</p>
  </section>;
}
