// Dựng màn "Tất cả cài đặt" từ các mục của registry tham số (GET /settings/params).
// Mục sửa được: số/lựa chọn đã nối vào bộ máy tính lương. Mục chưa nối là "sắp có"; mục khoá/bảng là chỉ đọc.
import { TYPE_NAME, baseLabel, fromPct, toPct, typeOfKey, valueOf } from './params';

const NGAY_CONG = new Set<any>([
  'type.<type>.workdays',
  'type.<type>.startDateRequired',
  'type.<type>.defaultContract',
  'pay.method',
  'type.<type>.workdaysMode'
]);
const KHAU_TRU = new Set<any>([
  'attendance.graceMin',
  'attendance.stepMin',
  'attendance.cutRounding',
  'attendance.graceScope',
  'attendance.graceMonthlyMin',
  'attendance.graceMonthlyCount',
  'attendance.lateEarlyRule',
  'attendance.gapRule'
]);
const isInsurance = (e?) => /insurance/.test(e.id);

// Mỗi nhóm chip: nhóm registry (group) và bộ lọc mục (pick)
export const SECTIONS = [
  {
    section: 'Thành phần lương',
    items: [
      { key: 'ngay-cong', name: '1. Lương theo ngày công', pick: (e?) => e.group === 2 && NGAY_CONG.has(e.id) },
      { key: 'lam-them', name: '2. Tiền làm thêm giờ', pick: (e?) => e.group === 5 },
      { key: 'phu-cap', name: '3. Phụ cấp', pick: (e?) => e.group === 3 },
      { key: 'luong-kpi', name: '4. Lương KPI', pick: (e?) => e.group === 8 },
      { key: 'khau-tru', name: '5. Khấu trừ đi muộn', pick: (e?) => e.group === 6 && KHAU_TRU.has(e.id) },
      { key: 'tam-ung', name: '6. Tạm ứng', pick: (e?) => e.group === 1 && e.id.startsWith('advance.') },
      { key: 'bao-hiem', name: '7. Bảo hiểm · kế toán', pick: (e?) => e.group === 10 && isInsurance(e) },
      { key: 'thue', name: '8. Thuế TNCN · kế toán', pick: (e?) => e.group === 10 && !isInsurance(e) }
    ]
  },
  {
    section: 'Chức vụ, quy trình và phiếu lương',
    items: [
      { key: 'chuc-vu', name: 'Chức vụ và bậc lương', pick: (e?) => e.group === 2 && !NGAY_CONG.has(e.id) },
      { key: 'ky-luong', name: 'Kỳ lương', pick: (e?) => e.group === 1 && !e.id.startsWith('advance.') },
      { key: 'cham-cong', name: 'Chấm công', pick: (e?) => e.group === 6 && !KHAU_TRU.has(e.id) },
      { key: 'nghi-phep', name: 'Nghỉ và phép', pick: (e?) => e.group === 7 },
      { key: 'phe-duyet', name: 'Phê duyệt', pick: (e?) => e.group === 9 },
      { key: 'ho-so', name: 'Hồ sơ và hợp đồng', pick: (e?) => e.group === 13 },
      { key: 'phieu-luong', name: 'Phiếu lương', pick: (e?) => e.group === 12 },
      { key: 'nang-cao', name: 'Nâng cao', pick: (e?) => e.group === 14 || e.group === 15 }
    ]
  }
];

const UNIT = {
  day: 'ngày',
  hour: 'giờ',
  minute: 'phút',
  times: 'lần',
  month: 'tháng',
  year: 'năm',
  vnd: '₫',
  ratio: '%'
};
export const unitOf = (entry?) => {
  const c = entry.ui && entry.ui.component;
  if (c === 'money') return '₫';
  if (c === 'percent') return '%';
  return (entry.ui && UNIT[entry.ui.unit]) || '';
};
export const isRatio = (entry?) => !!(entry.ui && entry.ui.component === 'percent' && entry.ui.unit === 'ratio');

const live = (e?) => e.class !== 'removed';
const isFixed = (e?) => e.class === 'fixed' || e.readOnly || e.lockReason;
export const normalizeSettingsSearch = (value?) =>
  String(value || '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
const text = (v?) =>
  v === true ? 'Có' : v === false ? 'Không' : v == null ? '' : Array.isArray(v) ? v.join(', ') : String(v);

function statusBadge(entry?) {
  const states = (entry.instances || []).map(i => i.status);
  if (states.includes('custom')) return 'adjusted';
  if (states.includes('unset')) return 'unconfirmed';
  return null;
}

// Phương án chưa dùng được bị ẩn (trừ phương án đang chọn)
function optionList(entry?) {
  const current = (entry.instances || []).map(i => i.value);
  return ((entry.rules && entry.rules.options) || []).filter(o => o.available !== false || current.includes(o.value));
}

/** Một mục registry → mục sửa được trong màn, hoặc null khi không dựng được ô sửa. */
function editableItem(entry?) {
  const insts = entry.instances || [];
  if (!insts.length) return null;
  const item = { key: entry.id, badge: statusBadge(entry), name: baseLabel(entry.label), desc: '', base: '' };
  const options = optionList(entry);
  if (entry.class === 'choice' && options.length) {
    if (insts.length === 1) {
      return {
        ...item,
        kind: 'options',
        pk: insts[0].key,
        value: insts[0].value,
        options: options.map(o => ({
          key: o.value,
          label: o.label
        }))
      };
    }
    return {
      ...item,
      kind: 'per',
      rows: insts.map(i => ({
        label: TYPE_NAME[typeOfKey(i.key)] || baseLabel(i.label),
        field: {
          type: 'seg',
          pk: i.key,
          options: options.map(o => o.label),
          vals: options.map(o => o.value),
          value: (options.find(o => o.value === i.value) || options[0]).label
        }
      }))
    };
  }
  if (entry.class === 'number') {
    const ratio = isRatio(entry);
    return {
      ...item,
      kind: 'per',
      rows: insts.map(i => ({
        label: insts.length === 1 ? '' : TYPE_NAME[typeOfKey(i.key)] || baseLabel(i.label),
        field: { type: 'num', pk: i.key, ratio, unit: unitOf(entry), value: ratio ? toPct(i.value) : i.value }
      }))
    };
  }
  return null;
}

export function buildAllSettings(idx?, firstRun?, group?) {
  const sections = SECTIONS.map(s => ({
    section: s.section,
    items: s.items.map(i => ({
      key: i.key,
      name: i.name,
      count: idx.entries.filter(e => live(e) && i.pick(e)).length
    }))
  }));
  const meta = SECTIONS.flatMap(s => s.items).find(i => i.key === group);
  const detail = { key: group, title: meta ? meta.name : '', soonCount: 0, items: [] as any[], readonly: [] as any[] };
  if (meta) {
    for (const entry of idx.entries.filter(e => live(e) && meta.pick(e))) {
      if (!isFixed(entry) && entry.wired === false) {
        detail.soonCount += 1;
        continue;
      }
      const item = !isFixed(entry) && entry.wired !== false ? editableItem(entry) : null;
      if (item) {
        detail.items.push(item);
        continue;
      }
      const insts = entry.instances || [];
      const shown = insts.length
        ? insts.map(i => text(i.value)).join(' · ')
        : isFixed(entry)
          ? 'Khoá'
          : entry.class === 'table' || entry.class === 'formula'
            ? 'Bảng'
            : '';
      detail.readonly.push({ key: entry.id, title: baseLabel(entry.label), desc: '', value: shown || 'Khoá' });
    }
  }
  return { intro: { count: firstRun ? firstRun.total : 0 }, groups: sections, detail };
}

/** Search the already-loaded registry index and return safe, stable deep-link targets. */
export function searchAllSettings(idx?, query?) {
  const needle = normalizeSettingsSearch(query);
  const results: any[] = [];
  for (const section of SECTIONS) {
    for (const meta of section.items) {
      const detail = buildAllSettings(idx, null, meta.key).detail;
      for (const item of detail.items) {
        if (!needle || normalizeSettingsSearch(`${item.name} ${item.desc || ''}`).includes(needle))
          results.push({
            groupKey: meta.key,
            groupLabel: meta.name,
            section: section.section,
            settingKey: item.key,
            title: item.name,
            readonly: false,
            query: { q: String(query).trim(), group: meta.key, setting: item.key }
          });
      }
      for (const item of detail.readonly) {
        if (!needle || normalizeSettingsSearch(`${item.title} ${item.desc || ''}`).includes(needle))
          results.push({
            groupKey: meta.key,
            groupLabel: meta.name,
            section: section.section,
            settingKey: item.key,
            title: item.title,
            readonly: true,
            query: { q: String(query).trim(), group: meta.key, setting: item.key }
          });
      }
    }
  }
  return results;
}

/** Keep a deep-linked target visible even when the search or local filter would hide it. */
export function filterAllSettings(detail?, query?, filter = 'all', targetKey = '') {
  const needle = normalizeSettingsSearch(query);
  const matches = (value?, key?) => key === targetKey || !needle || normalizeSettingsSearch(value).includes(needle);
  return {
    items: (detail?.items || []).filter(
      item =>
        (item.key === targetKey || filter !== 'readonly') &&
        (item.key === targetKey || filter !== 'unconfirmed' || item.badge === 'unconfirmed') &&
        matches(`${item.name} ${item.desc || ''}`, item.key)
    ),
    readonly: (detail?.readonly || []).filter(
      item =>
        (['all', 'readonly'].includes(filter) || item.key === targetKey) &&
        matches(`${item.title} ${item.desc || ''}`, item.key)
    )
  };
}

/** Giá trị gửi lên của một mục sau khi người dùng sửa. */
function itemValues(item?) {
  if (item.kind === 'options') return [[item.pk, item.value]];
  const out: any[] = [];
  for (const row of item.rows || []) {
    const f = row.field;
    if (f.type === 'seg') out.push([f.pk, f.vals[f.options.indexOf(f.value)]]);
    else out.push([f.pk, f.value === '' || f.value == null ? f.value : f.ratio ? fromPct(f.value) : Number(f.value)]);
  }
  return out;
}

export function allSettingsWanted(draft?) {
  return (draft.items || []).flatMap(itemValues);
}

export { valueOf };
