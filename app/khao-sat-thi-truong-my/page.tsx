/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element -- Match native public-site navigation and responsive editorial imagery. */
import { publicPageMetadata } from "@/lib/public-page-metadata";
import { BrandLogo } from "../components/brand-logo";
import { BusinessBrief } from "./business-brief";
import "./business-travel.css";

const photo = "https://images.pexels.com/photos/333645/pexels-photo-333645.jpeg";
export const metadata = {
  ...publicPageMetadata({
    title: "Khảo sát thị trường Mỹ kết hợp du lịch | Cookie Paradise Travel",
    description: "Hành trình Mỹ thiết kế riêng cho doanh nhân Việt: nghiên cứu thị trường, tìm đối tác tiềm năng, sắp xếp cuộc hẹn, hỗ trợ visa và tổ chức chuyến đi cùng Trung Lê tại Indiana.",
    path: "/khao-sat-thi-truong-my",
    image: `${photo}?auto=compress&w=1800`,
    imageAlt: "Sông Chicago và những tòa nhà bên bờ sông tại Mỹ",
  }),
  openGraph: {
    ...publicPageMetadata({ title: "Khảo sát thị trường Mỹ. Hành trình theo mục tiêu của bạn.", description: "Nghiên cứu thị trường, tìm đầu mối phù hợp và tổ chức chuyến đi Mỹ theo yêu cầu cùng Trung Lê.", path: "/khao-sat-thi-truong-my", image: `${photo}?auto=compress&w=1800`, imageAlt: "Sông Chicago, Mỹ" }).openGraph,
    locale: "vi_VN",
  },
};

const services = [
  ["Hiểu thị trường trước khi lên đường", "Từ sản phẩm, năng lực và mục tiêu của doanh nghiệp, tôi nghiên cứu khách hàng, kênh phân phối, khu vực nên khảo sát và những câu hỏi cần làm rõ tại Mỹ."],
  ["Tìm đúng đầu mối để bắt đầu", "Bạn nhận danh sách đối tác tiềm năng và chuyên gia phù hợp, lý do nên tiếp cận từng bên, cùng nội dung đề xuất cho mỗi cuộc trao đổi. Tôi liên hệ, đề nghị cuộc hẹn và cập nhật kết quả."],
  ["Dành thời gian cho việc quan trọng", "Tôi kết nối lịch làm việc với việc đi lại, nơi ở và thời gian nghỉ. Bạn có thể giao cho tôi từ một phần công việc đến toàn bộ khâu tổ chức chuyến đi."],
];
const steps = [
  ["Bắt đầu từ bài toán của bạn", "Trao đổi về doanh nghiệp, sản phẩm, thị trường muốn tìm hiểu, ngân sách và thời gian dự kiến. Chốt phạm vi nghiên cứu và báo giá trước khi triển khai."],
  ["Nghiên cứu và tiếp cận", "Xây dựng hồ sơ tóm tắt, chọn đầu mối, chuẩn bị câu hỏi và gửi đề nghị gặp. Danh sách tiềm năng và các cuộc hẹn đã xác nhận được thể hiện riêng trong kế hoạch."],
  ["Hoàn thiện hành trình", "Sắp xếp tuyến đi quanh các cuộc hẹn đã xác nhận; hỗ trợ hồ sơ visa, đặt vé máy bay, khách sạn, phương tiện và phiên dịch chuyên ngành khi cần."],
  ["Khảo sát và xác định bước tiếp theo", "Điều phối lịch trình, dành thời gian tổng hợp sau các buổi làm việc và cùng bạn ghi lại đầu mối cần tiếp tục trao đổi, thông tin còn thiếu và các lựa chọn cần cân nhắc."],
];
function Reference({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}<span className="sr-only"> (mở trong thẻ mới)</span></a>;
}

export default function UsBusinessTravelPage() {
  return <main lang="vi" className="us-business-page">
    <a className="us-skip" href="#us-content">Đến nội dung chính</a>
    <header className="us-header"><div className="us-wrap us-header-inner">
      <a href="/" aria-label="Trang chủ Cookie Paradise Travel Company"><BrandLogo /></a>
      <nav aria-label="Điều hướng"><a href="/why-vietnam">Du lịch Việt Nam</a><a href="/khao-sat-thi-truong-my" aria-current="page">Khảo sát Mỹ</a><a href="#trao-doi">Trao đổi với Trung</a></nav>
    </div></header>

    <section id="us-content" className="us-wrap us-hero">
      <div className="us-hero-copy"><p className="us-eyebrow">Hành trình riêng cho doanh nhân Việt</p>
        <h1>Khảo sát thị trường Mỹ.<br /><em>Theo mục tiêu của bạn.</em></h1>
        <p className="us-lead">Bạn muốn đưa sản phẩm vào Mỹ, tìm đối tác hay khảo sát địa điểm mở nhà máy? Tôi giúp bạn nghiên cứu hướng đi, tìm đầu mối phù hợp và xây dựng chuyến đi để trực tiếp tìm hiểu.</p>
        <p>Từ hỗ trợ hồ sơ visa, vé máy bay và khách sạn đến lịch làm việc và những ngày khám phá nước Mỹ — bạn chọn mục tiêu, tôi lo việc chuẩn bị.</p>
        <a className="us-button" href="#trao-doi">Chia sẻ kế hoạch của bạn</a>
        <p className="us-hero-note">Thuần công việc hoặc kết hợp du lịch. Lịch riêng, theo nhu cầu của bạn.</p>
      </div>
      <figure className="us-hero-photo">
        <img src={`${photo}?auto=compress&w=1280`} srcSet={`${photo}?auto=compress&w=640 640w, ${photo}?auto=compress&w=1280 1280w, ${photo}?auto=compress&w=1800 1800w`} sizes="(min-width: 1000px) 46vw, 92vw" width={6000} height={4000} fetchPriority="high" alt="Du thuyền trên sông Chicago, phía sau là những tòa nhà và cây mùa thu" />
        <figcaption>Chicago, Illinois <Reference href="https://www.pexels.com/photo/city-at-waterfront-against-cloudy-sky-333645/">Ảnh: Radhika Chopra / Pexels</Reference></figcaption>
      </figure>
    </section>

    <section className="us-wrap us-section us-value" aria-labelledby="us-value-title">
      <div className="us-section-heading"><p className="us-eyebrow">Nghiên cứu trước. Khảo sát tận nơi.</p><h2 id="us-value-title">Mỗi điểm đến cần trả lời<br /><em>một câu hỏi của doanh nghiệp.</em></h2></div>
      <div className="us-three">{services.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
    </section>

    <section className="us-case us-section" aria-labelledby="us-case-title"><div className="us-wrap">
      <div className="us-section-heading"><p className="us-eyebrow">Ngành phân bón · Dựa trên nhu cầu của một khách hàng thực tế</p><h2 id="us-case-title">Muốn vào thị trường Mỹ,<br /><em>nên bắt đầu từ đâu?</em></h2><p>Một nhà sản xuất phân bón tại Việt Nam có thể cân nhắc xuất khẩu, tìm đơn vị gia công hoặc xây dựng nhà máy tại Mỹ. Mỗi hướng cần một nhóm đầu mối và một chương trình khảo sát khác nhau.</p><p>Với một khách hàng trong ngành, tôi đã chuẩn bị bản nghiên cứu để so sánh các hướng tiếp cận: sản phẩm nào nên tìm hiểu sâu hơn, ai có thể đưa hàng đến người mua và khi nào nên cân nhắc đầu tư tại Mỹ.</p></div>
      <div className="us-paths">
        <article><p className="us-eyebrow">Bước nghiên cứu</p><h3>Làm rõ hướng đi trước khi đặt lịch.</h3><dl>
          <div><dt>Chọn sản phẩm để tìm hiểu thị trường</dt><dd>Bản nghiên cứu đề xuất ưu tiên một đến hai sản phẩm có điểm khác biệt, như NPK cao cấp, phân tan chậm hoặc phân hữu cơ, rồi tìm cách kiểm chứng nhu cầu và hiệu quả tại Mỹ.</dd></div>
          <div><dt>Tìm đường đến người mua</dt><dd>Phân tích vai trò của nhà nhập khẩu, nhà phân phối, đại lý nông nghiệp và hợp tác xã; xem xét thêm kênh sân vườn hoặc sản phẩm chuyên dụng nếu phù hợp.</dd></div>
          <div><dt>So sánh mức cam kết đầu tư</dt><dd>Đặt xuất khẩu qua đối tác, thuê kho, gia công phối trộn và xây dựng nhà máy lên cùng một bàn cân. Hướng đề xuất là kiểm chứng đầu ra trước, rồi mới cân nhắc đầu tư lớn.</dd></div>
        </dl></article>
        <article><p className="us-eyebrow">Hướng thiết kế chuyến khảo sát</p><h3>Mỗi cuộc gặp giải đáp một câu hỏi.</h3><dl>
          <div><dt>Nhà nhập khẩu và nhà phân phối</dt><dd>Họ đang phục vụ nhóm khách hàng nào? Cần quy cách, mức giá và bằng chứng hiệu quả ra sao để xem xét sản phẩm mới? Đây là nhóm đầu mối ưu tiên tiếp cận.</dd></div>
          <div><dt>Đơn vị khảo nghiệm và chuyên gia nông học</dt><dd>Trao đổi về thử nghiệm đồng ruộng, cây trồng mục tiêu và dữ liệu cần thu thập. Indiana và các bang thuộc Vành đai Ngô là khu vực được đề xuất tìm hiểu trong nghiên cứu.</dd></div>
          <div><dt>Đơn vị kho bãi, gia công và chuyên gia tại địa phương</dt><dd>Khảo sát phương án lưu kho, phối trộn và vận chuyển; làm rõ đăng ký sản phẩm với cơ quan quản lý tại bang. Nếu tiếp tục xem xét xây dựng nhà máy, bổ sung đầu mối phát triển kinh tế và chuyên gia về địa điểm, pháp lý, môi trường.</dd></div>
        </dl></article>
      </div>
      <div className="us-research-note"><h3>Từ bản nghiên cứu đến một chuyến đi có mục đích.</h3><p>Trong trường hợp này, nghiên cứu giúp xác định thứ tự cần tìm hiểu: đối tác phân phối và khả năng thử nghiệm trước, phương án kho bãi hoặc sản xuất sau. Từ đó, tôi có thể xây dựng danh sách đầu mối để tiếp cận, chuẩn bị câu hỏi cho từng buổi gặp và sắp xếp tuyến đi quanh những cuộc hẹn được xác nhận.</p><p>Các đầu mối có thể đánh giá gồm <Reference href="https://www.growmark.com/what-we-do/crop-nutrients">GROWMARK</Reference> về phân phối dinh dưỡng cây trồng, <Reference href="https://oisc.purdue.edu/fertilizer">Office of Indiana State Chemist</Reference> về quản lý phân bón tại Indiana và <Reference href="https://www.trade.gov/selectusa-investor">SelectUSA</Reference> khi tìm hiểu đầu tư tại Mỹ.</p></div>
    </div></section>

    <section className="us-wrap us-section" aria-labelledby="us-style-title">
      <div className="us-section-heading"><p className="us-eyebrow">Cách đi do bạn chọn</p><h2 id="us-style-title">Tập trung kinh doanh.<br /><em>Hoặc dành thêm thời gian cho nước Mỹ.</em></h2></div>
      <div className="us-styles"><article><h3>Chuyến đi thuần công việc</h3><p>Ưu tiên gặp đối tác, tham dự sự kiện ngành, khảo sát cơ sở và làm việc với chuyên gia. Tuyến đi được xây dựng quanh những cuộc trao đổi có giá trị với mục tiêu của bạn.</p></article><article><h3>Công việc kết hợp trải nghiệm</h3><p>Giữ những buổi làm việc quan trọng, thêm thời gian khám phá thành phố, thưởng thức ẩm thực, tham quan hoặc nghỉ cùng gia đình. Người đi cùng có thể có lịch riêng trong giờ bạn làm việc.</p></article></div>
      <div className="us-itinerary"><p className="us-eyebrow">Một hướng thiết kế: Chicago và Indiana</p><p><strong>Đến nơi và nghỉ ngơi.</strong> Sau đó dành các ngày làm việc cho đầu mối phân phối, chuyên gia và địa điểm khảo sát đã xác nhận. Nếu muốn kết hợp du lịch, thêm một ngày khám phá kiến trúc Chicago, đi dạo bên hồ Michigan hoặc trải nghiệm ẩm thực trước khi trở về.</p><p className="us-small">Thành phố và số ngày được chọn sau bước nghiên cứu, theo vị trí đối tác và lịch làm việc thực tế.</p></div>
    </section>

    <section className="us-process us-section" aria-labelledby="us-process-title"><div className="us-wrap"><div className="us-section-heading"><p className="us-eyebrow">Từ ý tưởng đến chuyến đi</p><h2 id="us-process-title">Chuẩn bị có mục tiêu.<br /><em>Đi để hiểu rõ hơn.</em></h2></div><ol>{steps.map(([title, body]) => <li key={title}><h3>{title}</h3><p>{body}</p></li>)}</ol>
      <div className="us-deliverables"><h3>Bạn nhận được gì?</h3><p>Bản tóm tắt nghiên cứu · Danh sách đầu mối kèm lý do lựa chọn · Câu hỏi cho từng buổi làm việc · Lịch trình và trạng thái cuộc hẹn · Thông tin đặt dịch vụ · Tổng hợp những bước cần tiếp tục sau chuyến đi.</p></div>
    </div></section>

    <section className="us-wrap us-section us-personal" aria-labelledby="us-trung-title">
      <div><p className="us-eyebrow">Một đầu mối tại Mỹ, trao đổi bằng tiếng Việt</p><h2 id="us-trung-title">Tôi là Trung Lê.</h2><p className="us-lead">Tôi là người Việt, hiện sống và kinh doanh tại Columbus, Indiana.</p><p>Tôi trực tiếp tìm hiểu nhu cầu của bạn, tổ chức phần nghiên cứu và kết nối các chi tiết của hành trình. Khi cần kiến thức chuyên ngành, tôi tìm đầu mối phù hợp để bạn trao đổi đúng vấn đề.</p><p>Bạn có thể tập trung vào sản phẩm, đối tác và quyết định kinh doanh; tôi phụ trách việc chuẩn bị và điều phối chuyến đi theo phạm vi đã thống nhất.</p></div>
      <div className="us-faq"><h3>Những điều bạn có thể muốn biết</h3>
        <details><summary>Hỗ trợ visa Mỹ như thế nào?</summary><p>Tôi hỗ trợ chuẩn bị thông tin cho hồ sơ B-1/B-2, hướng dẫn các bước đặt lịch và chuẩn bị phỏng vấn theo mục đích thực tế của chuyến đi. Theo Bộ Ngoại giao Mỹ, B-1 dành cho hoạt động như gặp đối tác, dự hội nghị và đàm phán; B-2 dành cho du lịch. Visa thăm viếng không cho phép làm việc tại Mỹ; việc cấp visa do cơ quan lãnh sự quyết định.</p><Reference href="https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html">Thông tin visa từ Bộ Ngoại giao Mỹ</Reference></details>
        <details><summary>Chi phí được tính như thế nào?</summary><p>Báo giá dựa trên phạm vi nghiên cứu, số điểm đến, thời gian và mức hỗ trợ bạn chọn. Đề xuất thể hiện riêng phí nghiên cứu và tổ chức, dịch vụ du lịch, cùng chi phí phiên dịch hoặc chuyên gia nếu có, để bạn duyệt trước khi triển khai.</p></details>
        <details><summary>Tôi chưa biết nên bắt đầu ở bang nào.</summary><p>Đó chính là một câu hỏi cho bước nghiên cứu. Chúng ta sẽ xem khách hàng, đối tác, chuỗi cung ứng và nhu cầu của dự án trước khi chọn điểm đến.</p></details>
        <details><summary>Dịch vụ có dành cho ngành khác không?</summary><p>Có. Phân bón là một ví dụ. Hãy chia sẻ ngành hàng và mục tiêu của bạn để tôi đánh giá phạm vi công việc, hướng tiếp cận và nguồn lực cần thiết trước khi nhận kế hoạch.</p></details>
      </div>
    </section>

    <section id="trao-doi" className="us-contact us-section" aria-labelledby="us-contact-title"><div className="us-wrap us-contact-grid"><div><p className="us-eyebrow">Bắt đầu bằng một cuộc trao đổi</p><h2 id="us-contact-title">Bạn muốn tìm câu trả lời gì<br /><em>tại Mỹ?</em></h2><p>Chia sẻ sản phẩm, mục tiêu và khoảng thời gian dự kiến. Tôi sẽ trao đổi với bạn về hướng khảo sát và phạm vi hỗ trợ phù hợp.</p><a className="us-contact-email" href="mailto:trung@cookieparadise.co">trung@cookieparadise.co</a><p className="us-small">Trung Lê · Cookie Paradise Travel Company<br />Columbus, Indiana, Mỹ</p></div><BusinessBrief /></div></section>
    <footer className="us-wrap us-footer"><p>© {new Date().getFullYear()} Cookie Paradise Travel Company LLC</p><nav aria-label="Thông tin cuối trang"><a href="/">Du lịch Việt Nam</a><a href="/privacy">Chính sách bảo mật</a><a href="mailto:trung@cookieparadise.co">Liên hệ Trung</a></nav></footer>
  </main>;
}
