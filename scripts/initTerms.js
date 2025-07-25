const mongoose = require('mongoose');
const Terms = require('../models/Terms');
require('dotenv').config();

const defaultTermsData = [
  {
    section: 'bookingTerms',
    content: `1. Điều khoản đặt chỗ bãi đậu xe

• Khách hàng phải đặt chỗ trước ít nhất 1 giờ
• Thời gian đặt chỗ tối đa là 30 ngày
• Mỗi lần đặt chỗ tối thiểu 1 giờ
• Hủy đặt chỗ trước 2 giờ để được hoàn tiền

2. Thông tin cần thiết khi đặt chỗ

• Họ tên khách hàng
• Số điện thoại liên hệ
• Biển số xe
• Thời gian đặt chỗ (giờ đến và giờ đi)
• Loại bãi đậu xe mong muốn

3. Xác nhận đặt chỗ

• Hệ thống sẽ gửi SMS/Email xác nhận
• Khách hàng cần xác nhận trong vòng 15 phút
• Nếu không xác nhận, đặt chỗ sẽ tự động hủy`,
    isActive: true
  },
  {
    section: 'bookingRules',
    content: `1. Quy định sử dụng bãi đậu xe

• Tuân thủ hướng dẫn của nhân viên
• Đậu xe đúng vị trí được chỉ định
• Không để xe quá thời gian đã đặt
• Giữ gìn vệ sinh chung

2. Quy định về an toàn

• Tắt động cơ khi đậu xe
• Khóa xe cẩn thận
• Không để vật có giá trị trong xe
• Báo cáo ngay khi có sự cố

3. Quy định về thanh toán

• Thanh toán đầy đủ trước khi sử dụng
• Chấp nhận các phương thức thanh toán được hỗ trợ
• Giữ hóa đơn để đối soát`,
    isActive: true
  },
  {
    section: 'privacyPolicy',
    content: `1. Chính sách bảo mật thông tin

• Chúng tôi cam kết bảo vệ thông tin cá nhân của khách hàng
• Thông tin chỉ được sử dụng cho mục đích đặt chỗ và liên lạc
• Không chia sẻ thông tin với bên thứ ba

2. Thu thập thông tin

• Thông tin cá nhân: họ tên, số điện thoại, email
• Thông tin xe: biển số xe, loại xe
• Thông tin đặt chỗ: thời gian, vị trí

3. Sử dụng thông tin

• Xử lý đặt chỗ và thanh toán
• Gửi thông báo và xác nhận
• Cải thiện dịch vụ
• Liên lạc khẩn cấp

4. Bảo vệ thông tin

• Mã hóa dữ liệu
• Kiểm soát truy cập
• Sao lưu định kỳ
• Tuân thủ quy định pháp luật`,
    isActive: true
  },
  {
    section: 'contactInfo',
    content: `Thông tin liên hệ

🏢 Địa chỉ: 123 Đường ABC, Quận XYZ, TP.HCM
📞 Điện thoại: 090-123-4567
📧 Email: info@parkingzone.com
🌐 Website: www.parkingzone.com

Giờ làm việc:
• Thứ 2 - Thứ 6: 7:00 - 22:00
• Thứ 7 - Chủ nhật: 8:00 - 21:00

Hỗ trợ khách hàng:
• Hotline: 1900-1234
• Email: support@parkingzone.com
• Chat online: 24/7

Liên hệ khẩn cấp:
• Bảo vệ: 090-999-8888
• Kỹ thuật: 090-777-6666`,
    isActive: true
  },
  {
    section: 'timeSlotInterval',
    content: `Khoảng thời gian đặt chỗ

⏰ Khoảng thời gian: 30 phút
• Đặt chỗ theo khoảng 30 phút
• Ví dụ: 8:00, 8:30, 9:00, 9:30...

🕐 Giờ mở cửa: 6:00 - 24:00
• Có thể đặt chỗ từ 6:00 sáng
• Đặt chỗ tối đa đến 24:00

📅 Thời gian đặt trước:
• Tối thiểu: 1 giờ trước
• Tối đa: 30 ngày trước

⏱️ Thời gian tối thiểu:
• Mỗi lần đặt: 1 giờ
• Không giới hạn thời gian tối đa`,
    isActive: true
  },
  {
    section: 'cancellationPolicy',
    content: `Chính sách hủy đặt chỗ

❌ Hủy miễn phí:
• Trước 2 giờ: Hoàn tiền 100%
• Trước 1 giờ: Hoàn tiền 50%
• Dưới 1 giờ: Không hoàn tiền

⚠️ Lưu ý:
• Thời gian tính từ giờ đặt chỗ
• Hoàn tiền trong vòng 3-5 ngày làm việc
• Áp dụng cho tất cả loại bãi đậu xe

🔄 Thay đổi đặt chỗ:
• Có thể thay đổi thời gian trước 2 giờ
• Không tính phí thay đổi
• Chỉ được thay đổi 1 lần

📞 Liên hệ hủy:
• Hotline: 1900-1234
• Email: cancel@parkingzone.com
• App/Website: Trong mục "Đặt chỗ của tôi"`,
    isActive: true
  },
  {
    section: 'refundPolicy',
    content: `Chính sách hoàn tiền

💰 Hoàn tiền tự động:
• Hủy trước 2 giờ: 100% số tiền
• Hủy trước 1 giờ: 50% số tiền
• Dưới 1 giờ: Không hoàn tiền

⏰ Thời gian hoàn tiền:
• Thẻ tín dụng: 3-5 ngày làm việc
• Chuyển khoản: 1-2 ngày làm việc
• Ví điện tử: Ngay lập tức

📋 Điều kiện hoàn tiền:
• Đã thanh toán đầy đủ
• Hủy đúng quy định
• Thông tin tài khoản chính xác

❓ Trường hợp đặc biệt:
• Sự cố hệ thống: Hoàn tiền 100%
• Bảo trì bãi xe: Hoàn tiền 100%
• Thiên tai: Hoàn tiền 100%

📞 Liên hệ hoàn tiền:
• Hotline: 1900-1234
• Email: refund@parkingzone.com`,
    isActive: true
  }
];

async function initTerms() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing terms
    await Terms.deleteMany({});
    console.log('Cleared existing terms');

    // Insert default terms
    const result = await Terms.insertMany(defaultTermsData);
    console.log(`Inserted ${result.length} terms sections`);

    console.log('Terms initialization completed successfully');
  } catch (error) {
    console.error('Error initializing terms:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

initTerms(); 