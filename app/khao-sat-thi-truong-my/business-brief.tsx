"use client";
import { useState, type FormEvent } from "react";

export function BusinessBrief() {
  const [prepared, setPrepared] = useState(false);
  function compose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const body = ["Chào Trung,", "", "Tôi muốn trao đổi về chuyến khảo sát thị trường Mỹ.", "", `Họ tên: ${values.get("name")}`, `Doanh nghiệp / ngành hàng: ${values.get("company")}`, `Mục tiêu: ${values.get("goal")}`, `Hình thức: ${values.get("style")}`, `Thời gian / số người dự kiến: ${values.get("timing") || "Chưa xác định"}`, "", "Mong nhận được phản hồi của Trung."].join("\n");
    window.location.href = `mailto:trung@cookieparadise.co?subject=${encodeURIComponent("Trao đổi chuyến khảo sát thị trường Mỹ")}&body=${encodeURIComponent(body)}`;
    setPrepared(true);
  }
  return <form className="us-brief" onSubmit={compose}>
    <h3>Kế hoạch của bạn</h3>
    <label>Họ và tên<input required name="name" autoComplete="name" maxLength={100} /></label>
    <label>Doanh nghiệp / ngành hàng<input required name="company" autoComplete="organization" maxLength={160} placeholder="Ví dụ: sản xuất phân bón hữu cơ" /></label>
    <label>Bạn muốn tìm hiểu hoặc thực hiện điều gì?<textarea required name="goal" rows={3} maxLength={600} placeholder="Ví dụ: tìm nhà phân phối, khảo sát nhà xưởng, gặp chuyên gia..." /></label>
    <fieldset><legend>Hình thức chuyến đi</legend><label><input type="radio" name="style" value="Thuần công việc" defaultChecked /> Thuần công việc</label><label><input type="radio" name="style" value="Công việc kết hợp du lịch" /> Công việc kết hợp du lịch</label><label><input type="radio" name="style" value="Muốn trao đổi thêm" /> Muốn trao đổi thêm</label></fieldset>
    <label>Thời gian / số người dự kiến <span>(nếu đã có)</span><input name="timing" maxLength={100} placeholder="Ví dụ: tháng 9, hai người, khoảng 10 ngày" /></label>
    <button className="us-button" type="submit">Soạn email gửi Trung</button>
    <p className="us-small">Mở ứng dụng email với thông tin đã điền sẵn. Bạn xem lại và gửi email để bắt đầu trao đổi.</p>
    {prepared && <p className="us-form-status" role="status">Email đã được chuẩn bị. Nếu ứng dụng email không mở, bạn có thể gửi thông tin trực tiếp đến <a href="mailto:trung@cookieparadise.co">trung@cookieparadise.co</a>.</p>}
  </form>;
}
