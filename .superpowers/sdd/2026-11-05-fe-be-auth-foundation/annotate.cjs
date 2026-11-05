// Gắn dấu quyền (một dòng decorator) ngay trước decorator HTTP của từng handler, theo bảng 5.2 của spec.
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
const plan = {
  'system/system.controller.ts': {
    health: 'Public()', healthV2: 'Public()', getSettings: "RequireCap('config.read')", listPeriods: "RequireCap('config.read')",
    updateSetting: "RequireCap('config.write')", getAuditLogs: "RequireCap('audit.read')", lockPeriod: "RequireCap('attendance.lock')"
  },
  'roles/roles.controller.ts': { list: "RequireCap('staff.manage')", listV2: "RequireCap('staff.manage')" },
  'holidays/holidays.controller.ts': {
    list: "RequireCap('config.read')", create: "RequireCap('config.write')", quickAdd: "RequireCap('config.write')", remove: "RequireCap('config.write')"
  },
  'employees/employees.controller.ts': Object.fromEntries(
    ['getPositionsCatalog', 'getShiftsCatalog', 'listEmployees', 'getEmployee', 'createEmployee', 'putEmployee', 'deleteEmployee'].map(m => [m, "RequireCap('staff.manage')"])
  ),
  'attendance/attendance.controller.ts': Object.fromEntries(
    ['recordPunch', 'getPunches', 'listTimesheets', 'getTimesheet', 'recalculateTimesheet'].map(m => [m, "RequireCap('attendance.correct')"])
  ),
  'requests/requests.controller.ts': Object.fromEntries(
    ['createLeave', 'createOvertime', 'createAdvance', 'createExplanation', 'createIsat', 'listIsatConditions', 'listRequests', 'getRequest', 'reviewRequest', 'cancelRequest'].map(m => [m, "RequireCap('requests.review')"])
  ),
  'payroll/payroll.controller.ts': Object.fromEntries(
    ['calculatePeriod', 'listPayslips', 'getPayslip', 'setKpiScore'].map(m => [m, "RequireCap('payroll.calculate')"])
  )
};
for (const [rel, methods] of Object.entries(plan)) {
  const file = path.join(root, 'src/modules', rel);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (const [method, deco] of Object.entries(methods)) {
    const at = lines.findIndex(l => new RegExp(`^\\s+(async\\s+)?${method}\\(`).test(l));
    if (at < 0) throw new Error(`${rel}: không thấy ${method}`);
    let http = at - 1;
    while (http >= 0 && !/^\s+@(Get|Post|Put|Patch|Delete)\(/.test(lines[http])) http--;
    const indent = lines[http].match(/^\s+/)[0];
    lines.splice(http, 0, `${indent}@${deco}`);
  }
  let text = lines.join('\n');
  const needed = ['Public', 'RequireCap'].filter(n => text.includes(`@${n}(`));
  text = text.replace(/import \{([^}]*)\} from '\.\.\/\.\.\/common';/, (m, names) => {
    const have = names.split(',').map(s => s.trim()).filter(Boolean);
    const all = [...have, ...needed.filter(n => !have.includes(n))];
    return `import { ${all.join(', ')} } from '../../common';`;
  });
  if (!/from '\.\.\/\.\.\/common'/.test(text)) throw new Error(`${rel}: không có import common`);
  fs.writeFileSync(file, text);
}
console.log('ok');
