'use client';
import {useState} from 'react';
import {FileSpreadsheet, FileText, Download, LoaderCircle, ShieldCheck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {downloadCsv, downloadPdf, reportData} from '@/lib/export-data';

/** Inner dialog content; the calling page owns its accessible modal shell. */
export function ExportOptions({resource, rows, workspaceName, locale = 'en', onClose}) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const arabic = locale === 'ar';
  const report = reportData(resource, rows, locale);
  async function run(format) {
    if (busy) return;
    setBusy(format); setError('');
    try {
      if (format === 'csv') downloadCsv(resource, rows, locale);
      else await downloadPdf(resource, rows, {workspaceName, locale});
      onClose?.();
    } catch (cause) {setError(cause.message || (arabic ? 'تعذر تصدير التقرير' : 'The report could not be exported'));}
    finally {setBusy('');}
  }
  return <div className="export-options" dir={arabic ? 'rtl' : 'ltr'}>
    <div className="export-summary"><span className="form-icon"><Download size={23}/></span><div><strong>{report.title}</strong><p>{arabic ? `تصدير ${rows.length} سجل من النتائج المعروضة` : `Export ${rows.length} ${rows.length === 1 ? 'record' : 'records'} from the current results`}</p></div></div>
    <div className="export-format-grid">
      <button type="button" className="export-format-card" disabled={!!busy} onClick={() => run('pdf')}><FileText size={26}/><strong>PDF</strong><span>{arabic ? 'تقرير منسق وجاهز للطباعة' : 'Formatted report, ready to print'}</span>{busy === 'pdf' ? <LoaderCircle size={18} className="spin"/> : <Download size={18}/>}</button>
      <button type="button" className="export-format-card" disabled={!!busy} onClick={() => run('csv')}><FileSpreadsheet size={26}/><strong>CSV</strong><span>{arabic ? 'بيانات قابلة للتحرير في الجداول' : 'Editable data for spreadsheets'}</span>{busy === 'csv' ? <LoaderCircle size={18} className="spin"/> : <Download size={18}/>}</button>
    </div>
    <p className="export-privacy"><ShieldCheck size={15}/>{arabic ? 'يتضمن التصدير السجلات المسموح لحسابك بعرضها فقط' : 'Includes only the records your account can currently view.'}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-footer"><Button variant="outline" disabled={!!busy} onClick={onClose}>{arabic ? 'إلغاء' : 'Cancel'}</Button></div>
  </div>;
}
