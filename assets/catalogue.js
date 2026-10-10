/* 30 visual grammars × 10 investigation contexts. No third-party runtime. */
(function(root){
  'use strict';
  const groups = [
    ['network','Mạng & quan hệ','◎'],['flow','Chuỗi & dòng chuyển','⇢'],
    ['space','Điểm · tuyến · vùng','⌖'],['time','Thời gian & sự kiện','◷'],
    ['compare','So sánh & phân bố','▥'],['hierarchy','Cấu trúc & tác tử','◇']
  ].map(([id,name,icon])=>({id,name,icon}));
  const families = [
    ['force','network','Mạng cộng đồng','Các tác tử kết nối thành những cộng đồng nào?','Vị trí là bố cục quan hệ, không phải tọa độ địa lý.'],
    ['radial','network','Mạng hướng tâm','Tác tử trung tâm kết nối với những nhóm nào?','Khoảng cách tới tâm không biểu thị khoảng cách vật lý.'],
    ['chord','network','Dây cung liên nhóm','Dòng liên kết giữa các nhóm lớn đến đâu?','Độ dày thể hiện tổng giá trị; không thể suy ra nguyên nhân.'],
    ['matrix','network','Ma trận quan hệ','Những cặp nhóm nào trao đổi mạnh nhất?','Màu là tổng giá trị theo cặp nhóm, gồm liên kết cùng nhóm.'],
    ['hive','network','Hive plot đa trục','Quan hệ chéo giữa vai trò và tầng diễn ra thế nào?','Trục thể hiện nhóm; khoảng cách dọc trục là thứ tự tác tử.'],
    ['chain','flow','Chuỗi truy vết','Dòng chuyển đi qua những tầng nào?','Mũi tên chỉ chiều liên kết; không tự xác nhận chuyển tiền.'],
    ['sankey','flow','Sankey dòng chuyển','Giá trị tổng hợp phân bổ từ nhóm nguồn tới nhóm đích thế nào?','Dải rộng theo tổng giá trị; tổng vào/ra không mặc định bảo toàn.'],
    ['arc','flow','Cung truy vết','Liên kết tầm xa và vòng quay lại ở đâu?','Vị trí ngang theo tầng; cung không phải tuyến giao thông.'],
    ['bundle','flow','Dòng gom theo hành lang','Các tuyến cùng nguồn hoặc đích hội tụ ở đâu?','Gom đường chỉ giúp đọc bố cục, không thêm chứng cứ.'],
    ['waterfall','flow','Thác giá trị','Nhóm nào làm tăng hoặc giảm chênh lệch vào/ra?','Mỗi bước là tổng vào trừ tổng ra của một nhóm.'],
    ['trajectory','space','Quỹ đạo đa tác tử','Tác tử di chuyển theo tuyến nào và đang ở đâu?','Mô phỏng tọa độ phẳng; không dùng để đo khoảng cách thực.'],
    ['od','space','Tuyến nguồn–đích','Điểm xuất phát và kết thúc của liên kết ở đâu?','Đường nối là quan hệ OD, không phải đường đi thực tế.'],
    ['geofence','space','Vùng giám sát','Những tác tử nào đang nằm trong vùng theo dõi?','Vùng tròn là vùng mô phỏng theo đơn vị mặt phẳng.'],
    ['hexbin','space','Lưới mật độ lục giác','Tác tử tập trung ở những ô nào?','Lưới phẳng hiển thị mật độ, không phải hệ chỉ số H3.'],
    ['voronoi','space','Lãnh địa tác tử','Phân vùng gần các tâm nhóm thay đổi ra sao?','Voronoi Euclid sơ đồ; không thể suy ra địa giới hành chính.'],
    ['timeseries','time','Chuỗi thời gian','Tổng giá trị sự kiện thay đổi theo thời gian thế nào?','Giá trị cộng theo khoảng thời gian cố định; không phải dự báo.'],
    ['stream','time','Dải hoạt động','Nhóm nào đóng góp vào hoạt động theo thời gian?','Dải xếp chồng theo giá trị cùng khoảng thời gian.'],
    ['event','time','Dòng sự kiện','Các sự kiện nối nhau theo thứ tự nào?','Mỗi điểm là một liên kết có thời điểm; trục không biểu thị độ chắc chắn.'],
    ['gantt','time','Cửa sổ hoạt động','Tác tử hoạt động trong những khoảng nào?','Cửa sổ từ thuộc tính start/end; dữ liệu demo được tổng hợp.'],
    ['calendar','time','Lịch cường độ','Những khoảng thời gian nào có nhiều sự kiện?','Ô là 1/100 thời lượng, không mặc định một ngày lịch.'],
    ['radar','compare','Hồ sơ đa chiều','Các nhóm khác nhau về quy mô và kết nối thế nào?','Trục chuẩn hóa 0–100 theo cực đại từng chỉ số trong dữ liệu.'],
    ['swarm','compare','Đàn điểm giá trị','Phân bố giá trị tác tử khác nhau giữa các nhóm ra sao?','Mỗi điểm là một tác tử; độ lệch ngang dùng để tránh trùng.'],
    ['parallel','compare','Tọa độ song song','Những tổ hợp thuộc tính nào nổi bật?','Mỗi trục được chuẩn hóa độc lập, không cùng đơn vị.'],
    ['ridgeline','compare','Dải phân bố nhóm','Giá trị nào phổ biến trong mỗi nhóm?','Histogram 20 khoảng cố định theo giá trị cực đại.'],
    ['rank','compare','Xếp hạng tác tử','Tác tử nào có tổng giá trị liên kết lớn nhất?','Xếp hạng theo liên kết đã xuất hiện tới mốc thời gian.'],
    ['tree','hierarchy','Cây tầng tác tử','Tác tử được tổ chức theo tầng và nhóm ra sao?','Cây phân loại theo nhóm; không suy ra quan hệ sở hữu.'],
    ['treemap','hierarchy','Treemap quy mô','Tỷ trọng giá trị của nhóm và tác tử là bao nhiêu?','Diện tích theo thuộc tính value; không thể hiện diện tích địa lý.'],
    ['sunburst','hierarchy','Vòng phân cấp','Các tầng đóng góp vào từng nhóm như thế nào?','Góc theo tổng giá trị nhóm/tầng; vòng là cấu trúc phân loại.'],
    ['agents','hierarchy','Đàn tác tử tương tác','Tác tử chuyển trạng thái và tương tác thế nào?','Chuyển động demo theo hàm tái lập, không phải mô hình dự báo.'],
    ['lanes','hierarchy','Làn phối hợp tác tử','Nhiều tác tử phối hợp qua các tầng thế nào?','Làn là nhóm vai trò, chiều ngang là tiến độ mô phỏng.']
  ].map(([id,category,name,question,limitation])=>({id,category,name,question,limitation}));
  const scenarios = [
    ['funds','Dòng giá trị','Chuyển giá trị giữa các ví và điểm trung gian',['Nguồn','Ví','Trung gian','Cầu nối','Điểm nhận','Đối soát']],
    ['multichain','Đa chuỗi','Quan hệ giữa tác tử thuộc nhiều hệ thống',['Chain A','Chain B','Chain C','Bridge','Exchange','Contract']],
    ['supply','Chuỗi cung ứng','Luồng hàng và hồ sơ qua các khâu',['Nhà cung cấp','Kho','Vận tải','Điểm bán','Khách hàng','Kiểm định']],
    ['fleet','Theo dõi đội xe','Di chuyển và giao nhận trong khu vực mô phỏng',['Xe tải','Xe giao hàng','Trạm','Kho','Điểm giao','Điều phối']],
    ['communication','Liên lạc','Luồng thông điệp giữa các nhóm tác tử',['Nhóm A','Nhóm B','Nhóm C','Relay','Gateway','Lưu trữ']],
    ['provenance','Nguồn gốc chứng cứ','Chuỗi ghi nhận và chuyển giao hồ sơ',['Thu nhận','Bản gốc','Xử lý','Kiểm tra','Lưu trữ','Báo cáo']],
    ['incident','Diễn biến sự cố','Chuỗi sự kiện và phản ứng tại các điểm',['Sự kiện','Cảm biến','Phân tích','Điều phối','Phản ứng','Phục hồi']],
    ['field','Giám sát thực địa','Quan hệ giữa điểm đo, nhóm khảo sát và vùng',['Điểm đo','Cảm biến','Khảo sát','Trạm','Vùng','Tổng hợp']],
    ['behavior','Hành vi tác tử','Nhịp hoạt động và liên kết trong mô phỏng',['Khởi tạo','Hoạt động','Trung chuyển','Chờ','Kết thúc','Quan sát']],
    ['access','Luồng truy cập','Phiên truy cập và các tầng hệ thống',['Client','Gateway','Dịch vụ','Tài nguyên','Log','Kiểm tra']]
  ].map(([id,name,description,roles],index)=>({id,name,description,roles,seed:104729+index*7919}));
  const models = scenarios.flatMap((scenario,si)=>families.map((family,fi)=>({
    id:`V${String(si*30+fi+1).padStart(3,'0')}`, family:family.id, category:family.category,
    scenario:scenario.id, name:`${family.name} · ${scenario.name}`, question:family.question,
    description:scenario.description, limitation:family.limitation, seed:scenario.seed, variant:si
  })));
  root.VISUA = Object.assign(root.VISUA||{},{groups,families,scenarios,models});
  if(typeof module!=='undefined') module.exports=root.VISUA;
})(typeof window!=='undefined'?window:globalThis);
