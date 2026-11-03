# Thiết kế cải tiến UX và kiến trúc thông tin — 2026-11-03

**Trạng thái:** Đề xuất thiết kế, chưa triển khai sản phẩm. Yêu cầu hiện tại đã cho phép tự quyết thiết kế và tạo tài liệu này; không cần hỏi lại hoặc thêm cổng duyệt. Mục tiêu là tiếp tục triển khai sau khi môi trường worktree được khôi phục.

**Môi trường/xác minh lúc soạn:** CWD là checkout được chỉ định, nhưng Git không nhận đây là repository qua ranh giới mount `/mnt`; `.git` hiển thị rỗng/chỉ đọc, `git rev-parse HEAD` thoát 128, branch/HEAD và trạng thái diff không xác minh được; không có Git writes. `node_modules` ở gốc có mặt, `web/node_modules` không tồn tại, `PG_TEST_URL` chưa đặt. Các lệnh implementation đã thử bởi phiên lead: `npm --prefix web run build` thoát 127 (`vite: not found`); `node --no-warnings=ExperimentalWarning --import=tsx --test test/unit/fe-be-sync-ui.test.ts` thoát 1 (thiếu `pinia`); `npm test` thoát 1 (`PG_TEST_URL` chưa cấu hình); kiểm tra kiểu frontend offline thoát 1 (`vue-tsc` thiếu). Đây là lỗi môi trường/dependency, không phải kết quả pass/fail của thiết kế. Trong tác vụ thiết kế này đã đọc mã tĩnh; chưa chạy app hoặc browser. Prettier/link-check của tài liệu sẽ được ghi nhận riêng.

**Phạm vi:** Điều hướng và trải nghiệm các luồng Admin, Nhân viên trên máy tính và điện thoại, trên nền Vue 3/Vue Router hiện có. Thiết kế ưu tiên công việc đang cần xử lý, giảm chrome thị giác, dùng một màu nhấn hiện có và mở chi tiết theo nhu cầu. Đây là workspace điều hành, không phải trang marketing: không hero quảng bá, không thêm trang giới thiệu.

**Căn cứ repo:** `web/src/router/**`, `web/src/views/**`, `web/src/layouts/**`, `web/src/components/shell/**`, `web/src/services/**`, `web/src/builders/**` và tài liệu chương trình. File:line dưới đây là bằng chứng tĩnh, không khẳng định trạng thái runtime trên browser.

## 1. Mục tiêu và giới hạn

1. Admin mở ứng dụng và thấy việc cần làm tiếp theo, trạng thái kỳ/tháng đang chọn và đường đi ngắn đến màn xử lý.
2. Nhân viên hoàn thành Check-in/out, xem chấm công/thu nhập và gửi yêu cầu với ít bước, nhất quán giữa điện thoại và máy tính.
3. Điều hướng phản ánh miền công việc, tên gọi phân biệt cấu hình với thao tác vận hành, và deep link tiếp tục hoạt động.
4. Nội dung dày được progressive disclosure: số tổng và hành động chính trước; bộ lọc, giải thích, lịch sử và chi tiết theo yêu cầu.
5. Giữ nguyên hợp đồng API, quyền hạn, quy tắc nghiệp vụ và phép tính. Không loại chức năng nếu chưa xác định lối tương đương và chuyển tiếp dữ liệu/URL.

Không thuộc mục tiêu: thay Vue, viết lại toàn bộ frontend, sửa công thức lương/chấm công, đổi API hoặc cơ sở dữ liệu, hay thay nhận diện thương hiệu/token màu. Đây là tài liệu thiết kế, chưa phải sản phẩm đã triển khai; mục tiêu triển khai thiết kế sau khi worktree riêng được khôi phục. Việc sửa UI có thể cần adapter hiển thị, nhưng mọi adapter phải dùng dữ liệu thật và không được tự tính lại nghiệp vụ.

## 2. Ba hướng và lựa chọn

| Hướng | Cách làm | Đánh đổi |
|---|---|---|
| A. Tỉa từng màn | Sửa chữ, khoảng cách và ẩn bớt phần lặp tại component hiện có. | Ít thay đổi nhưng tiếp tục duy trì điều hướng khó đoán, các điểm vào lặp và trạng thái rỗng/đang tải không đồng đều. |
| B. Cải tiến theo luồng trên Vue hiện có — **chọn** | Giữ router, shell, builder và service. Sắp thứ tự điều hướng theo công việc; làm từng luồng có ưu tiên, chuẩn hóa trạng thái và breakpoint; giữ URL/role/API hiện tại. | Cần kiểm kê deep link và capability từng thao tác trước khi đổi điều hướng. Thay đổi chia nhỏ, có thể đối chiếu ảnh/browser và số liệu. |
| C. Viết lại IA và frontend | Tạo shell/route/component mới rồi di trú toàn bộ. | Phạm vi, hồi quy và chi phí cao; không cần thiết để đạt mục tiêu và có nguy cơ phá link, phân quyền, các biểu mẫu đang hoạt động. |

Chọn B. Phát triển lần lượt trên cấu trúc Vue hiện tại, bắt đầu bằng điều hướng, tác vụ Admin và xử lý lỗi dữ liệu; tiếp đó tối ưu các bảng/chi tiết; cuối cùng rà hai trải nghiệm nhân viên ở các kích thước màn hình. Không đổi backend để làm giao diện thuận tiện hơn.

## 3. Phát hiện tĩnh và giả thuyết cần kiểm tra

### 3.1 Phát hiện được mã xác nhận

- Router hiện tách các nhóm route Admin, nhân viên điện thoại, nhân viên máy tính; quyền vào layout Admin kiểm tra `isAdminCapable`, còn phone/desktop có điều kiện riêng ([router/index.ts:1–5, 43–59](../../../web/src/router/index.ts)). Cải tiến phải giữ nguyên cổng route và kiểm tra server-side; ẩn link không thay thế quyền.
- Sidebar Admin hiện có Tổng quan, Yêu cầu, Chấm công, KPI, Bảng lương, Nhân sự và Cài đặt ([AdminSidebar.vue:17–35, 63–74](../../../web/src/components/shell/AdminSidebar.vue)). Shell đã có một màu/biến token và nhóm mục; thiết kế nên tinh chỉnh hierarchy trong đó, không thêm màu nhấn thứ hai.
- Cài đặt đã chia nhóm Lương, Vận hành, Kiểm soát, Tra cứu và có đường dẫn riêng cho công thức lương, chế độ, chức vụ, lịch, quy tắc KPI, phân quyền, nhật ký và tất cả cài đặt ([nav.ts:2–26](../../../web/src/views/admin/settings/nav.ts), [admin-settings.ts:5–46](../../../web/src/router/routes/admin-settings.ts)). “Đánh giá KPI” ở menu Cài đặt dẫn tới điều kiện KPI, trong khi cùng tên ở sidebar dẫn tới nhập điểm KPI ([KpiRulesView.vue:18–22](../../../web/src/views/admin/settings/KpiRulesView.vue), [KpiShell.vue:27–39](../../../web/src/views/admin/kpi/KpiShell.vue)). Thống nhất nhãn “Quy tắc KPI” cho cấu hình và “Đánh giá KPI” cho vận hành ở sidebar, menu Cài đặt, tiêu đề, link chéo và route reference; URL không đổi.
- Tìm kiếm Cài đặt có hai điểm nhập: `SettingsFrame` ghi nhận truy vấn rồi điều hướng đến Tất cả cài đặt ([SettingsFrame.vue:20–24, 28–31](../../../web/src/views/admin/settings/SettingsFrame.vue)); trang đó lại có ô tìm riêng và placeholder ghi “ở mọi nhóm” ([AllSettingsView.vue:32–36, 103–114](../../../web/src/views/admin/settings/AllSettingsView.vue)). Tuy nhiên, khi nhập truy vấn, danh sách `items` lọc trên `draft.value.items`, vốn là chi tiết của group hiện chọn ([AllSettingsView.vue:23–27, 45–52](../../../web/src/views/admin/settings/AllSettingsView.vue)); service nhận một `group` và gọi `buildAllSettings(idx, firstRun, group)` ([admin-config.ts:111–118](../../../web/src/services/admin-config.ts)); builder chỉ tạo `detail` từ `meta` của group đó ([all-settings.ts:138–171](../../../web/src/builders/admin-config/all-settings.ts)). **Do đó khẳng định tĩnh:** kết quả chi tiết trên màn đang chọn nhóm, không quét mục của mọi nhóm như placeholder ngụ ý. Thiết kế chọn tìm toàn bộ làm mặc định; kết quả nêu tên nhóm, mở đúng nhóm/mục và bảo toàn thay đổi chưa lưu hoặc cảnh báo trước khi chuyển nhóm. Tìm cục bộ trong nhóm chỉ là lựa chọn phụ, phải ghi rõ nhãn/phạm vi. Chưa xác minh trải nghiệm runtime bằng browser.
- Tổng quan hiện nêu số việc chặn trước khi chốt công, số liệu KPI, trạng thái kỳ và các mục tiếp theo ([OverviewView.vue:29–76](../../../web/src/views/admin/overview/OverviewView.vue)). Giữ định hướng ưu tiên việc cần làm; tránh thêm dashboard số tổng không gắn hành động.
- Màn Chấm công đã có thông tin ngày quên check-in/out, cần đối soát và lượt trễ; có liên kết tới Bảng lương để chốt công ([AttendanceShell.vue:50–79](../../../web/src/views/admin/attendance/AttendanceShell.vue)). Route cũ `sua-gio` đổi thành query filter và `ca-lam` đưa sang Nhân sự ([admin-attendance.ts:1–35](../../../web/src/router/routes/admin-attendance.ts)).
- Màn Nhân sự có chip loại và vấn đề, query `loc` giữ sẵn trạng thái lọc và có query mở hồ sơ ([StaffView.vue:20–40, 57–66](../../../web/src/views/admin/staff/StaffView.vue)). Không loại các bộ lọc này khi thiết kế lại.
- Yêu cầu hỗ trợ scope tháng hiện tại/toàn tháng, chọn hàng và thao tác hàng loạt ([admin-main.ts:2–22](../../../web/src/router/routes/admin-main.ts), [RequestsView.vue:85–120](../../../web/src/views/admin/requests/RequestsView.vue)). Thiết kế giữ xử lý hàng loạt và bổ sung thao tác theo dòng chỉ khi endpoint/quyền hiện tại cho phép.
- KPI có nhập điểm và lịch sử sửa điểm thành hai route/tab; liên kết điều kiện lương KPI riêng ([KpiShell.vue:27–90](../../../web/src/views/admin/kpi/KpiShell.vue)). Giữ route/lịch sử và khả năng truy cập; có thể trình bày link phụ, nhưng không xóa quyền truy cập. Chọn cách trình bày sau khi kiểm tra hiện trạng.
- Bảng lương và ngăn kéo phiếu là luồng có trạng thái kỳ, nhiều thao tác và dữ liệu lương; route duy nhất `/admin/bang-luong` nhận query tháng/kịch bản/ngăn kéo ([admin-payroll.ts:1–8](../../../web/src/router/routes/admin-payroll.ts)). Chỉ làm gọn thứ bậc thông tin và thao tác, không thay số, điều kiện, API hay trạng thái nghiệp vụ.
- Điện thoại có năm mục điều hướng cố định: Hôm nay, Chấm công, Yêu cầu, Thu nhập, Tôi ([PhoneLayout.vue:6–23](../../../web/src/layouts/PhoneLayout.vue)); máy tính dùng trang ba cột với Hôm nay, chấm công tháng, thu nhập/yêu cầu ([StaffHome.vue:1–4, 83–100](../../../web/src/views/staff-desktop/StaffHome.vue)). Các chế độ có thể khác cách trình bày nhưng phải cùng nguồn dữ liệu và năng lực thao tác.

### 3.2 Cần xác minh bằng browser hoặc qua thử nghiệm sử dụng

- Tìm kiếm toàn bộ Cài đặt có bao phủ hết các nhóm registry, hiển thị nhãn nhóm chính xác và điều hướng tới đúng mục; thay đổi chưa lưu được giữ hoặc cảnh báo trước khi đổi mục.
- Mức sử dụng tab lịch sử KPI, Nhật ký thay đổi và “Tất cả cài đặt”; không coi số route là bằng chứng dư thừa. Dù cách trình bày thay đổi, quyền truy cập lịch sử KPI phải còn nguyên.
- Kích thước màn, tràn bảng, bàn phím, focus/scroll của dialog, tab sticky và hiệu quả bố cục 3 cột staff desktop trên dữ liệu thật.
- Tính dễ hiểu của các nhãn, thông báo lỗi, số liệu ưu tiên và sự tương ứng giữa count trên Overview, Yêu cầu, Chấm công, KPI, lương.
- Capability trên từng thao tác, trạng thái tải lỗi/mạng và các role cụ thể; không mở rộng quyền theo suy luận giao diện.

## 4. Hướng dẫn trải nghiệm theo người dùng

### Admin

- **Tổng quan:** một tiêu đề gắn tháng/kỳ đang xem; phần đầu trả lời “việc gì cần làm tiếp và mở màn nào”. Nhóm blocker theo hành động (xử lý yêu cầu, thiếu/đối soát công, hồ sơ thiếu, kỳ lương), hiển thị count có nguồn/thời điểm nếu backend cung cấp. CTA đi thẳng đến màn có filter tương ứng. Duy trì KPI và tình trạng kỳ ở tầng phụ; không nhân đôi số nếu không giải thích được khác biệt. Empty state phân biệt “không có việc” với “chưa có dữ liệu/tải lỗi”.
- **Điều hướng Admin:** giữ các miền công việc chính (Tổng quan, Yêu cầu, Chấm công, Nhân sự, KPI, Bảng lương) và Cài đặt. Có thể nhóm theo nhịp vận hành: “Cần xử lý” (Tổng quan/Yêu cầu), “Nhân sự & công” (Nhân sự/Chấm công), “Kỳ lương” (KPI/Bảng lương); nhóm chỉ là hierarchy, không gộp route. Làm rõ active state theo route và active con; không tạo “Sắp có” giả làm mục thao tác.
- **Chấm công:** mặc định hiển thị bảng công/tháng với dải ngày và tổng quan ngắn; các việc bất thường qua filter đã có deep link. “Hôm nay”, OT, phép là chế độ/route bổ trợ với nhãn mô tả việc cần làm. Chi tiết ngày mở theo người/ngày, không lặp thông tin; giữ phiên bản, giờ gốc, giờ sửa, lý do, trạng thái duyệt và audit cần thiết. CTA chốt công tiếp tục đi Bảng lương và giữ query tháng.
- **Nhân sự:** ưu tiên tìm người, lọc loại/trạng thái, kết quả phân trang và thao tác hồ sơ. Bộ lọc vấn đề (chưa có ca/thiếu ngày bắt đầu/đã khóa) hiển thị như lối xử lý; trạng thái URL được giữ. Thao tác thêm, sửa hàng loạt, gán ca tiếp tục theo capability hiện có; xác nhận phạm vi áp dụng trước khi lưu.
- **Yêu cầu:** mặc định rõ phạm vi “tháng này” hay “mọi tháng”, trạng thái và loại; mỗi dòng cho biết ai gửi, yêu cầu gì, ngày nào, và điều kiện xử lý. Duyệt/từ chối riêng hoặc hàng loạt phải dùng API/quyền sẵn có, có lý do/xác nhận nếu backend yêu cầu. Đổi scope không làm mất bộ lọc/đang chọn ngoài ý muốn.
- **KPI:** phân biệt vận hành “Đánh giá KPI” với cấu hình “Quy tắc KPI/điều kiện nhận lương KPI”; dùng nhãn nhất quán trên sidebar, menu Cài đặt, tiêu đề, link chéo và route reference. Hiển thị đủ mẫu số, số người thiếu điểm và chỉ dẫn tới danh sách liên quan. Giữ route và quyền truy cập lịch sử sửa điểm; có thể trình bày nó như link phụ, còn cách trình bày cuối cùng dựa trên kiểm tra hiện trạng. Không tự tổng hợp điểm ở UI khác logic backend.
- **Bảng lương:** đặt kỳ, trạng thái kỳ, blocker và hành động hợp lệ làm thứ bậc đầu. Bộ lọc phiếu, tìm kiếm, phân trang, lỗi, bản nháp, phê duyệt và xuất/in giữ nguyên; các thao tác không hợp lệ được giải thích theo trạng thái server. Bảo toàn số tiền, rounding, đối chiếu tổng và yêu cầu xác nhận/lý do. Không đổi logic tính hoặc API.
- **Cài đặt:** phân biệt “cấu hình vận hành” (lương, chế độ, chức vụ, lịch, KPI), “quản trị truy cập” (vai trò, tài khoản, quy tắc yêu cầu) và “lịch sử/tra cứu”. Tìm toàn bộ là mặc định. Bỏ một trong hai ô tìm hoặc định rõ vai trò: đề xuất ô đầu là shortcut/command search, một trang kết quả duy nhất. Kết quả tìm mọi nhóm nêu tên nhóm, mở đúng nhóm/mục và giữ draft chưa lưu hoặc cảnh báo rõ trước khi chuyển; có thể có tìm cục bộ như lựa chọn phụ gắn nhãn phạm vi. Tìm không được bypass capability ghi: mục chỉ đọc, ẩn/khóa theo quyền và lỗi backend vẫn có nghĩa rõ. “Chưa xác nhận” là tác vụ cấu hình có tác động; giữ preview, tháng hiệu lực, lý do, diff, lưu, lịch sử và hoàn tác đúng capability. Nhật ký không bị mất khi gom navigation.

### Nhân viên

- **Điện thoại:** giữ thanh tab năm mục hiện có vì mỗi mục là miền tác vụ rõ. Hôm nay ưu tiên trạng thái ca hiện tại, Check-in/out và việc cần làm; Chấm công ưu tiên lịch tháng và ngày chi tiết; Yêu cầu ưu tiên trạng thái/chờ duyệt/tạo mới; Thu nhập ưu tiên kỳ và trạng thái phiếu; Tôi ưu tiên hồ sơ và tài khoản. Các hành động nguy cơ hoặc cần GPS giải thích quyền vị trí và kết quả server. Không dùng hover làm kênh duy nhất.
- **Máy tính:** giữ trang tổng hợp ba cột nếu thử nghiệm cho thấy ưu thế; tạo một cột chính cho hành động ngày hiện tại, cột phụ cho lịch/tháng và thu nhập/yêu cầu. Trên màn nhỏ chuyển thành một cột với cùng thứ tự ưu tiên điện thoại, không thu nhỏ ba cột đến mức khó đọc. Điều hướng tới trang chuyên sâu bằng URL/query; không tạo bản sao logic riêng cho desktop.
- **Hai nền tảng:** chia sẻ tên trạng thái, số liệu, hành động và deep link; layout có thể khác. Kiểm tra Check-in, yêu cầu, ngày công/giờ, thu nhập và hồ sơ bằng cùng tài khoản/dữ liệu để phát hiện chênh lệch.

## 5. Hệ thống hiển thị và tương tác

- **Visual thesis:** workspace vận hành yên tĩnh, ít chrome. Một màu nhấn chính lấy từ token hiện có; màu trạng thái chỉ dùng cho nghĩa trạng thái đã định nghĩa. Không thêm gradient/hero, không bọc mọi khối thành card. Dùng khoảng trắng, typography, tiêu đề và divider để phân cấp; bảng rộng có vùng cuộn rõ và giữ cột nhận diện khi hữu ích.
- **Responsive:** desktop ưu tiên bảng/dữ liệu so sánh; tablet giảm cột phụ và cho phép cuộn ngang có thông báo; mobile một cột, hành động chính dễ chạm, bảng chuyển thành hàng có label hoặc vùng cuộn có tiêu đề/cột nhận diện. Không để action quan trọng chỉ xuất hiện khi hover. Dialog phải vừa viewport, nội dung cuộn độc lập, nút xác nhận luôn tìm thấy.
- **Keyboard/accessibility:** mọi điều khiển có tên truy cập, focus nhìn thấy, thứ tự tab theo luồng đọc; Enter/Space kích hoạt theo semantics chuẩn; Escape đóng dialog trừ khi đang trong xác nhận không thể bỏ; focus vào dialog khi mở và trả về nút nguồn khi đóng. Không dùng màu đơn độc để truyền trạng thái. Shortcut không chiếm phím nhập liệu và không thay thế điều khiển thông thường.
- **Loading:** skeleton/placeholder giữ hình học, không hiện số 0 như dữ liệu đã tải; disable chỉ hành động phụ thuộc request, tránh double submit và giữ nội dung cũ khi refresh nếu không gây hiểu nhầm.
- **Error:** đặt thông báo cạnh ngữ cảnh, giữ dữ liệu nhập được khi lỗi, cho retry; 401/403 phân biệt hết phiên với thiếu quyền, conflict/revision gợi ý tải lại/đối chiếu; không hiện lỗi kỹ thuật nhạy cảm. Không tự retry mutation gây ghi lặp.
- **Empty:** phân biệt chưa có dữ liệu, không có kết quả lọc, không có quyền xem và không còn tác vụ; gợi ý hành động tiếp theo chỉ khi hợp lệ. Giữ query/filter để trạng thái rỗng tái lập được.
- **Số liệu đúng:** hiển thị đơn vị, kỳ, mẫu số/định nghĩa và nguồn khi cần; thời điểm cập nhật nếu có từ API. Tổng/percent phải dùng payload backend/builder hiện hữu, không cộng từ trang đang phân trang hoặc tính lại nghiệp vụ. Khi nhiều nguồn cập nhật lệch, nêu trạng thái tải hoặc làm mới thay vì lặng lẽ khẳng định số cuối cùng.
- **Deep links:** coi path, query tháng, filter, scope, nhân sự/ngày, và query mở dialog/drawer (`hop`) là hợp đồng điều hướng hiện có. Bảo toàn bookmark, `q` và query cũ, back/forward. Với kết quả tìm Cài đặt, dùng `group=<key>&setting=<key>` để mở đúng nhóm/mục; giữ `q`/`hop` liên quan và không mất bản nháp khi điều hướng. Chuyển focus hợp lý tới mục/tiêu đề kết quả khi điều hướng bằng bàn phím. Khi đổi URL, redirect có query mapping, ghi danh sách route cũ/mới và kiểm tra `spec/reference/web-routes.md`. Dialog mở từ URL phải đóng về URL nhất quán; không để URL nói dialog mở khi UI đã đóng.
- **Roles:** xác nhận quyền đọc, tạo/sửa, duyệt và xem audit ở từng capability/API trước khi chuyển nút hoặc mục menu. Đừng suy ra “Admin capable” đồng nghĩa mọi quyền. Cả deep link trực tiếp lẫn action request phải được backend từ chối đúng cách; UI giải thích từ lỗi quyền nhưng không lộ dữ liệu.

## 6. Trình tự triển khai đề xuất

Đây là thứ tự triển khai khuyến nghị; tài liệu chưa phải implementation. Khi môi trường worktree được khôi phục, tiếp tục theo quy trình repo: worktree riêng, kế hoạch chi tiết, kiểm tra hợp đồng và thực hiện từng bước với test phù hợp. Không thêm cổng hỏi lại người dùng cho quyết định đã nêu trong tài liệu này.

1. **Baseline và hợp đồng:** chụp các luồng/viewport hiện có; kiểm kê route, query, capability/API, trạng thái tải/lỗi/empty; kiểm chứng tìm kiếm xuyên nhóm Cài đặt; đối chiếu số liệu với API. Giữ tìm toàn bộ làm mặc định, dùng thử nghiệm để chốt chi tiết giữ draft/cảnh báo chuyển nhóm và tên/nhãn nhóm. Chốt hợp đồng deep link tìm kiếm với `q`, `hop`, query tương thích và `group=<key>&setting=<key>`.
2. **Điều hướng và Cài đặt:** thống nhất “Quy tắc KPI”/“Đánh giá KPI” ở mọi lối vào; thống nhất điểm vào tìm kiếm; triển khai kết quả mọi nhóm có tên nhóm, deep link đúng mục và bảo toàn draft/cảnh báo chuyển; xác định quyền/capability hiển thị cho cài đặt và lịch sử. Không đổi URL hiện tại nếu không cần.
3. **Admin việc cần làm:** cải thiện Overview deep links; rà scope/filter/empty/error của Yêu cầu, Chấm công và Nhân sự. Giữ thao tác theo dòng/hàng loạt theo API và quyền hiện tại.
4. **KPI và Bảng lương:** xử lý hierarchy, trạng thái và hiển thị density; giữ history, phiên bản, totals, luồng khóa/duyệt/chi trả, số tiền và API. Kiểm thử bằng tháng nhiều trạng thái, dữ liệu lỗi và role khác nhau.
5. **Nhân viên và responsive:** đồng bộ nội dung mobile/desktop, kiểm tra các tác vụ chính bằng keyboard/touch, GPS và các lỗi request; không nhân đôi logic nghiệp vụ.
6. **Harden và tài liệu:** cập nhật route reference nếu đổi router, kiểm tra khả năng truy cập, deep links, role matrix, số liệu và các trạng thái tải/lỗi/rỗng trên browser; chỉ ghi nhận kết quả thực chạy.

## 7. Tiêu chí chấp nhận và kiểm tra

- Người thử nghiệm Admin tìm được việc cần làm và đi tới màn xử lý từ Overview; đường dẫn giữ đúng tháng và filter, back/forward không mất ngữ cảnh.
- Người dùng phân biệt được “Quy tắc KPI” với “Đánh giá KPI”; sidebar, menu Cài đặt, tiêu đề, link chéo và route reference dùng nhãn nhất quán, hai route hiện tại vẫn hoạt động.
- Tìm kiếm Cài đặt mặc định xuyên nhóm; mỗi kết quả nêu nhóm và mở đúng mục. Draft chưa lưu được giữ nguyên hoặc có cảnh báo rõ trước khi chuyển nhóm. Tìm cục bộ nếu có là lựa chọn phụ, ghi phạm vi rõ ràng. Tìm không tạo quyền sửa mới.
- Tất cả route cũ, bookmark, query dialog/drawer và redirect đã kiểm kê tiếp tục dẫn đúng dữ liệu; `spec/reference/web-routes.md` đồng bộ nếu khai báo route đổi.
- Overview, Yêu cầu, Chấm công, Nhân sự, KPI, Bảng lương hiển thị loading/error/empty/permission states phân biệt; không nhầm tải lỗi thành dữ liệu rỗng hoặc số 0.
- KPI/tổng lương/chấm công và tổng hàng được đối chiếu với API/builder bằng fixtures đủ nhiều trang, nhiều trạng thái kỳ, và xử lý không làm thay đổi phép tính.
- Nút/route phù hợp ma trận role/capability; kiểm tra cả giao diện và request backend với tài khoản có/không có quyền.
- Điện thoại và máy tính hoàn tất được các tác vụ nhân viên tương ứng; kiểm tra viewport nhỏ, tablet, desktop, bàn phím, focus dialog, touch target và không phụ thuộc hover.
- Kiểm tra trước khi merge theo phạm vi cuối cùng: unit tests cho builders/services/query mapping; typecheck frontend và backend liên quan; build web; kiểm tra sinh/soát route reference nếu route đổi; browser QA thủ công bằng dữ liệu demo hoặc database test cô lập, nhiều role và viewport. Hiện chưa xác nhận có browser/e2e test runner trong package nên không giả định có script e2e; nếu được bổ sung, ghi rõ công cụ và lệnh. Lệnh cụ thể sẽ chọn theo thay đổi thực tế; tài liệu này không tuyên bố implementation đã chạy.

## 8. Rủi ro và hàng rào tương thích

- **API và tính toán:** UI không thay schema/endpoint/payload, công thức, làm tròn, vòng đời kỳ hoặc trạng thái. Nếu thiếu dữ liệu để trình bày đúng, ghi rõ dependency/contract cần xử lý riêng, không bù bằng phép tính frontend.
- **Role và capability:** đưa link sang nhóm khác có thể làm lộ màn hoặc chức năng. Mọi thay đổi menu phải đối chiếu backend authorization và direct routes; giữ khả năng xem chỉ đọc riêng với quyền ghi.
- **Deep link:** router đang dùng query cho tháng, filter, kịch bản, hộp thoại/ngăn kéo. Refactor có thể phá bookmark, notification, liên kết từ Overview và test route. Cần mapping/redirect tương thích và cập nhật route reference.
- **Con số gây hiểu nhầm:** dashboard tóm tắt dễ trộn draft/pending, số trang hiện tại với toàn kỳ, hoặc tháng hiện tại với tháng được chọn. Mỗi KPI phải ghi rõ định nghĩa và dùng payload có cùng scope.
- **Lịch sử/audit:** chuyển hoặc gộp nav không xóa khả năng kiểm tra lịch sử thay đổi, điểm cũ, lý do và người thao tác. Không xóa tab/data trước khi có bằng chứng usage và đường tương đương.
- **Responsive và density:** bảng nghiệp vụ có nhiều cột; nén CSS có thể làm mất dữ liệu. Thiết kế phải thử dữ liệu dài/thực, scroll, sticky, dialog và bàn phím tại viewport thật.

## 9. Liên hệ với tài liệu kế hoạch hiện có

Repo có [kế hoạch Đồng bộ FE–BE và Tinh gọn UI/UX](../plans/2026-11-03-fe-be-sync-and-ui-simplification.md) và [spec FE–BE/UI tương ứng](2026-11-03-fe-be-sync-and-ui-simplification-design.md). Chúng là căn cứ cho một số vấn đề API/hiển thị, nhưng một phần đã thực hiện; không mặc định tài liệu còn mô tả route/UI hiện hành. Ví dụ, route `sua-gio` và `ca-lam` đã là redirect; KPI shell hiện có tab Nhập điểm/Lịch sử sửa điểm và dải trọng số inline ([admin-attendance.ts:8–22](../../../web/src/router/routes/admin-attendance.ts), [KpiShell.vue:42–87](../../../web/src/views/admin/kpi/KpiShell.vue)); kế hoạch cũ còn đề xuất thay đổi tương ứng (plan, phần 4.1–4.2).

Đối chiếu tĩnh thêm cho thấy desktop Check-in đọc `geofenceRequired` ([staff-desktop.ts:131](../../../web/src/services/staff-desktop.ts)); sửa giờ nhận `reason` và dịch vụ có `decideOvertime` ([admin-attendance.ts:101–115](../../../web/src/services/admin-attendance.ts)); builder điện thoại đọc `late ?? lateMin` ([attendance.ts:69](../../../web/src/builders/staff-phone/attendance.ts), [home.ts:63–64](../../../web/src/builders/staff-phone/home.ts)); duyệt kỳ nhận `excludeErrors` ([admin-payroll.ts:179–188](../../../web/src/services/admin-payroll.ts)). Không ghi nhận các mục đã có là thiếu hoặc làm lại. Trước khi thực thi, đối chiếu mã hiện hành với cả hai tài liệu và xác minh trạng thái từng hạng mục.

## 10. Metadata tác vụ và xác minh tài liệu

- **Task:** Luna reader — thiết kế UX/navigation; chỉ tạo tài liệu thiết kế.
- **CWD/worktree path:** `/mnt/c/Users/Lena/Downloads/Vladilena-Milize-main/Vladilena-Milize-main`.
- **Branch/HEAD:** chưa xác định; `.git` hiển thị rỗng/chỉ đọc và `git rev-parse HEAD` thoát 128 do Git không nhận checkout qua ranh giới filesystem `/mnt`.
- **Files dự kiến:** duy nhất file spec này.
- **Giới hạn:** đọc mã tĩnh; không chạy ứng dụng/browser hoặc xác minh role/API thực. Lệnh implementation ở đầu tài liệu lỗi do môi trường/dependency và không có test nào được xác nhận xanh. Không sửa code sản phẩm và không Git writes.
