const FIELD_LABELS = {
  employeeCode: ['Employee ID', 'معرف الموظف'], memberCode: ['Member ID', 'معرف العضو'], name: ['Name', 'الاسم'], email: ['Email', 'البريد الإلكتروني'], role: ['Role', 'الدور'], department: ['Department', 'القسم'], status: ['Status', 'الحالة'], location: ['Location', 'الموقع'], joined: ['Start date', 'تاريخ البدء'], salary: ['Annual salary', 'الراتب السنوي'], type: ['Type', 'النوع'], from: ['From', 'من'], to: ['To', 'إلى'], reason: ['Reason', 'السبب'], title: ['Title', 'العنوان'], applicants: ['Applicants', 'المتقدمون'], category: ['Category', 'الفئة'], date: ['Date', 'التاريخ'], body: ['Message', 'الرسالة'], cycle: ['Review cycle', 'دورة التقييم'], score: ['Score', 'التقييم'], owner: ['Owner', 'المسؤول'], dueDate: ['Due date', 'تاريخ الاستحقاق'], priority: ['Priority', 'الأولوية'], description: ['Description', 'الوصف'], amount: ['Amount', 'المبلغ'], currency: ['Currency', 'العملة'], submittedAt: ['Submitted', 'تاريخ التقديم'], reviewNote: ['Review note', 'ملاحظة المراجعة'], createdAt: ['Date', 'التاريخ'], actor: ['Changed by', 'بواسطة'], action: ['Action', 'الإجراء'], resource: ['Record type', 'نوع السجل'],
};
const SCHEMAS = {
  employees: ['employeeCode', 'name', 'email', 'role', 'department', 'status', 'location', 'joined', 'salary'],
  requests: ['name', 'type', 'from', 'to', 'status', 'reason'],
  jobs: ['title', 'department', 'location', 'type', 'applicants', 'status'],
  announcements: ['title', 'category', 'date', 'body'],
  reviews: ['name', 'cycle', 'score', 'status'],
  compliance: ['title', 'category', 'owner', 'dueDate', 'status', 'priority', 'description'],
  compensation: ['name', 'type', 'amount', 'currency', 'status', 'submittedAt', 'reason', 'reviewNote'],
  memberships: ['memberCode', 'name', 'email', 'role', 'status'],
  audit: ['createdAt', 'actor', 'action', 'resource'],
};
const TITLES = {
  employees: ['Employee directory', 'دليل الموظفين'], requests: ['Time off requests', 'طلبات الإجازة'], jobs: ['Open positions', 'الوظائف'], announcements: ['Announcements', 'الإعلانات'], reviews: ['Performance reviews', 'تقييمات الأداء'], compliance: ['Compliance checklist', 'قائمة الامتثال'], compensation: ['Compensation requests', 'طلبات التعويضات'], memberships: ['Workspace members', 'أعضاء مساحة العمل'], audit: ['Activity history', 'سجل النشاط'],
};
const languageIndex = locale => locale === 'ar' ? 1 : 0;
const asText = value => value === null || value === undefined ? '' : typeof value === 'object' ? '' : String(value);

export function reportData(resource, rows, locale = 'en') {
  if (!SCHEMAS[resource]) throw new Error('This record type cannot be exported');
  if (!Array.isArray(rows)) throw new Error('Report rows must be an array');
  const fields = SCHEMAS[resource];
  const index = languageIndex(locale);
  return {title: TITLES[resource][index], fields, headers: fields.map(field => FIELD_LABELS[field][index]), rows: rows.map(row => fields.map(field => asText(row[field])))};
}

export function safeCsvCell(value) {
  let text = asText(value);
  if (/^[\s\uFEFF]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function createCsvReport(resource, rows, locale = 'en') {
  const report = reportData(resource, rows, locale);
  return '\uFEFF' + [report.headers, ...report.rows].map(row => row.map(safeCsvCell).join(',')).join('\r\n') + '\r\n';
}

export function reportFileName(resource, format, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(date);
  const value = type => parts.find(part => part.type === type).value;
  return `peopleos-${resource}-${value('year')}-${value('month')}-${value('day')}.${format}`;
}
function base64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

/** Returns PDF bytes for browser downloads and independent layout/validity verification. */
export async function createPdfReport(resource, rows, {workspaceName = 'PeopleOS', locale = 'en', fontBytes, generatedAt = new Date()} = {}) {
  const report = reportData(resource, rows, locale);
  const [{jsPDF}, tableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = tableModule.autoTable || tableModule.default;
  const rtl = locale === 'ar';
  if (rtl && !fontBytes) throw new Error('The Arabic report font could not be loaded. Please try again.');
  const doc = new jsPDF({orientation: report.fields.length > 7 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true});
  let font = 'helvetica';
  if (fontBytes) {
    const bytes = fontBytes instanceof Uint8Array ? fontBytes : new Uint8Array(fontBytes);
    doc.addFileToVFS('Tajawal-Regular.ttf', base64(bytes));
    doc.addFont('Tajawal-Regular.ttf', 'Tajawal', 'normal');
    doc.addFont('Tajawal-Regular.ttf', 'Tajawal', 'bold');
    font = 'Tajawal';
  }
  doc.setFont(font);
  // Tajawal reuses base glyphs for several isolated presentation forms. Alias
  // those Unicode points so jsPDF's Arabic shaping never drops their letters.
  if (fontBytes) {
    for (const style of ['normal', 'bold']) {
      doc.setFont(font, style);
      const map = doc.getFont().metadata.cmap?.unicode?.codeMap;
      if (map) for (let point = 0xfe70; point <= 0xfeff; point++) {
        const plain = String.fromCodePoint(point).normalize('NFKC');
        if (!map[point] && [...plain].length === 1 && map[plain.codePointAt(0)]) map[point] = map[plain.codePointAt(0)];
      }
    }
    doc.setFont(font, 'normal');
  }
  doc.setR2L(false);
  // Give the bidi engine logical input. Global reversal would reverse IDs,
  // email addresses and dates alongside Arabic text.
  const originalText = doc.text.bind(doc);
  doc.text = (content, x, y, options = {}, ...rest) => originalText(content, x, y, {...options, isInputVisual: false, isOutputVisual: true, isOutputRtl: false}, ...rest);
  doc.setProperties({title: `${workspaceName} - ${report.title}`, subject: 'HR report', author: workspaceName, creator: 'PeopleOS'});
  // jsPDF shapes Arabic through its preProcessText hook; preserve logical input here.
  const text = value => asText(value);
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const edge = rtl ? width - 14 : 14;
  const align = rtl ? 'right' : 'left';
  const timestamp = new Intl.DateTimeFormat(rtl ? 'ar-AE' : 'en-GB', {dateStyle: 'medium', timeZone: 'Asia/Dubai'}).format(generatedAt);
  const subtitle = rtl ? `${rows.length} سجل | ${timestamp}` : `${rows.length} ${rows.length === 1 ? 'record' : 'records'} | ${timestamp}`;
  const headers = rtl ? [...report.headers].reverse() : report.headers;
  const body = report.rows.map(row => (rtl ? [...row].reverse() : row).map(text));
  autoTable(doc, {
    head: [headers.map(text)],
    body: body.length ? body : [[{content: text(rtl ? 'لا توجد سجلات للعرض' : 'No records to display'), colSpan: headers.length, styles: {halign: 'center'}}]],
    startY: 48,
    margin: {top: 48, right: 14, bottom: 19, left: 14},
    styles: {font, fontSize: 8.2, cellPadding: 2.7, overflow: 'linebreak', valign: 'top', halign: align, lineColor: [225, 229, 232], lineWidth: 0.12},
    headStyles: {fillColor: [26, 65, 55], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.6},
    alternateRowStyles: {fillColor: [245, 248, 246]},
    rowPageBreak: 'avoid',
    didDrawPage() {
      doc.setFont(font, 'bold'); doc.setFontSize(10); doc.setTextColor(51, 92, 77);
      doc.text(text(workspaceName.slice(0, 100)), edge, 18, {align});
      doc.setFontSize(18); doc.setTextColor(29, 42, 37);
      doc.text(text(report.title), edge, 29, {align});
      doc.setFont(font, 'normal'); doc.setFontSize(9); doc.setTextColor(105, 116, 111);
      doc.text(text(subtitle), edge, 37, {align});
      doc.setDrawColor(213, 222, 216); doc.line(14, 42, width - 14, 42);
    },
  });
  const pages = doc.getNumberOfPages();
  for (let number = 1; number <= pages; number++) {
    doc.setPage(number); doc.setFont(font, 'normal'); doc.setFontSize(8); doc.setTextColor(112, 123, 116);
    doc.text('PeopleOS', 14, height - 9);
    doc.text(text(rtl ? `${number} / ${pages}` : `Page ${number} of ${pages}`), width - 14, height - 9, {align: 'right'});
  }
  return new Uint8Array(doc.output('arraybuffer'));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function downloadCsv(resource, rows, locale = 'en') {
  downloadBlob(new Blob([createCsvReport(resource, rows, locale)], {type: 'text/csv;charset=utf-8'}), reportFileName(resource, 'csv'));
}
export async function downloadPdf(resource, rows, options = {}) {
  let fontBytes = options.fontBytes;
  if (!fontBytes) {
    try {const response = await fetch('/fonts/Tajawal-Regular.ttf'); if (response.ok) fontBytes = new Uint8Array(await response.arrayBuffer());} catch {}
  }
  if (!fontBytes && (options.locale === 'ar' || /[\u0600-\u06ff]/.test(JSON.stringify(rows)))) throw new Error('The Arabic report font could not be loaded. Please try again.');
  const bytes = await createPdfReport(resource, rows, {...options, fontBytes});
  downloadBlob(new Blob([bytes], {type: 'application/pdf'}), reportFileName(resource, 'pdf'));
}
