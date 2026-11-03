'use strict';
// Nơi dựng (composition root) các repository và service của src/domain: mỗi thứ dựng một lần, nhận phụ thuộc qua constructor.
// Route, src/params/store.ts và các lối vào khác lấy đối tượng ở đây thay vì tự `new`.
// Dựng lười (lần đầu dùng mới dựng) để require vòng db ↔ params ↔ domain không xảy ra lúc nạp module; kết nối DB đổi (test mở DB khác)
// thì dựng lại.
const store = require('../platform/db');
const { PositionCatalog } = require('./position');
const { ShiftCatalog } = require('./shift');
const { LeaveLedgerRepository, LeaveAccountService } = require('./leave');
const { catalogParams } = require('./catalog-params');
const { GeofencePolicy } = require('./attendance-v2/geofence-policy');

const nowIso = () => new Date(Date.now()).toISOString();

class Container {
  declare store: any;

  #db: any = null;
  #built = new Map();

  constructor(source?) {
    this.store = source;
  }

  #once(name?, build?) {
    if (this.#db !== this.store.db) {
      this.#db = this.store.db;
      this.#built.clear();
    }
    if (!this.#built.has(name)) this.#built.set(name, build());
    return this.#built.get(name);
  }

  #repo(Type?) {
    return new Type({ queryBuilder: this.store.queryBuilder, transaction: this.store.transaction });
  }

  get positions() {
    return this.#once('positions', () => this.#repo(PositionCatalog));
  }

  get shifts() {
    return this.#once('shifts', () => this.#repo(ShiftCatalog));
  }

  // Điểm KPI: nối KpiScoring với kho dữ liệu và bộ tham số. Nạp muộn và đọc store mỗi lần gọi (test mở DB khác vẫn đúng)
  get kpi() {
    return this.#once('kpi', () => {
      const KpiRules = require('../engine/kpi-score'); // KPI 5 thành phần: điểm, trọng số, ngưỡng
      const { rulesFor, monthParams, typeParam } = require('../platform/request-rules');
      const { KpiScoring } = require('./kpi/kpi-scoring');
      return new KpiScoring({
        sheetOf: async (username?, month?) => await this.store.getSheet(username, month),
        monthParams,
        rulesFor,
        typeParam,
        KpiRules
      });
    });
  }

  // Vùng GPS Check-in: GeofencePolicy đọc vùng từ cài đặt và khoảng cách từ luật chấm công của tháng
  get geofencePolicy() {
    return this.#once('geofencePolicy', () => {
      const { rulesFor } = require('../platform/request-rules');
      return new GeofencePolicy({
        zone: async () => await this.store.getSetting('geofence', null),
        distanceM: async (...coords) => (await rulesFor()).punch.distanceM(...coords)
      });
    });
  }

  get leave() {
    return this.#once('leave', () => {
      // nạp muộn: request-rules và leave-days đọc src/params/store.ts, mà store đó lại hỏi container (paramRows)
      const { rulesFor, benefitOf, vnToday } = require('../platform/request-rules');
      const { leaveDates } = require('./leave-days');
      return new LeaveAccountService({
        ledger: this.#repo(LeaveLedgerRepository),
        store: this.store,
        rules: { rulesFor, benefitOf, leaveDates, vnToday, nowIso }
      });
    });
  }

  // Số phiên bản và dòng tham số của danh mục: src/domain/catalog-params.ts (src/params/store.ts đọc thẳng ở đó, không qua container)
  catalogRev() {
    return catalogParams.rev();
  }

  // Gọi bên trong giao dịch của thao tác sửa danh mục
  async bumpCatalogRev() {
    return await catalogParams.bump();
  }

  async catalogParamRows() {
    return await catalogParams.rows();
  }
}

const container = new Container(store);

export = { Container, container };
