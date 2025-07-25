const mongoose = require('mongoose');
const NotificationTemplate = require('../models/NotificationTemplate');
require('dotenv').config();

const defaultTemplates = [
  {
    name: 'Xác nhận đặt chỗ',
    type: 'email',
    subject: 'Xác nhận đặt chỗ bãi đậu xe - ParkEase',
    content: `Xin chào {{customerName}},

Cảm ơn bạn đã đặt chỗ bãi đậu xe với ParkEase.

Chi tiết đặt chỗ:
- Mã đặt chỗ: {{bookingId}}
- Ngày đặt: {{bookingDate}}
- Thời gian: {{startTime}} - {{endTime}}
- Loại bãi: {{parkingType}}
- Tổng tiền: {{totalAmount}} TWD
- Vị trí: {{location}}

Vui lòng đến đúng thời gian đã đặt. Nếu có thay đổi, vui lòng liên hệ chúng tôi.

Trân trọng,
Đội ngũ ParkEase`,
    description: 'Email xác nhận khi khách hàng đặt chỗ thành công',
    variables: ['customerName', 'bookingId', 'bookingDate', 'startTime', 'endTime', 'parkingType', 'totalAmount', 'location'],
    isActive: true
  },
  {
    name: 'Nhắc nhở đặt chỗ',
    type: 'sms',
    content: `Xin chào {{customerName}}, 
Đặt chỗ của bạn sẽ bắt đầu sau {{reminderTime}}. 
Mã: {{bookingId}}, Thời gian: {{startTime}}-{{endTime}}, 
Vị trí: {{location}}. 
Cảm ơn bạn đã sử dụng ParkEase!`,
    description: 'SMS nhắc nhở trước khi đặt chỗ bắt đầu',
    variables: ['customerName', 'reminderTime', 'bookingId', 'startTime', 'endTime', 'location'],
    isActive: true
  },
  {
    name: 'Xác nhận thanh toán',
    type: 'email',
    subject: 'Xác nhận thanh toán - ParkEase',
    content: `Xin chào {{customerName}},

Thanh toán của bạn đã được xác nhận thành công.

Chi tiết thanh toán:
- Mã đặt chỗ: {{bookingId}}
- Số tiền: {{amount}} TWD
- Phương thức: {{paymentMethod}}
- Thời gian: {{paymentTime}}
- Trạng thái: Đã thanh toán

Hóa đơn đã được gửi kèm theo email này.

Trân trọng,
Đội ngũ ParkEase`,
    description: 'Email xác nhận khi thanh toán thành công',
    variables: ['customerName', 'bookingId', 'amount', 'paymentMethod', 'paymentTime'],
    isActive: true
  },
  {
    name: 'Thông báo hủy đặt chỗ',
    type: 'email',
    subject: 'Xác nhận hủy đặt chỗ - ParkEase',
    content: `Xin chào {{customerName}},

Đặt chỗ của bạn đã được hủy thành công.

Chi tiết hủy:
- Mã đặt chỗ: {{bookingId}}
- Số tiền hoàn: {{refundAmount}} TWD
- Thời gian hủy: {{refundTime}}
- Lý do: {{cancelReason}}

Tiền sẽ được hoàn về tài khoản trong vòng 3-5 ngày làm việc.

Trân trọng,
Đội ngũ ParkEase`,
    description: 'Email xác nhận khi khách hàng hủy đặt chỗ',
    variables: ['customerName', 'bookingId', 'refundAmount', 'refundTime', 'cancelReason'],
    isActive: true
  },
  {
    name: 'Thông báo khuyến mãi',
    type: 'push',
    content: `🎉 Khuyến mãi đặc biệt!

Giảm {{discountPercent}}% cho đặt chỗ bãi xe
Mã: {{promoCode}}
Hạn sử dụng: {{expiryDate}}

Đặt chỗ ngay để nhận ưu đãi!`,
    description: 'Push notification thông báo khuyến mãi',
    variables: ['discountPercent', 'promoCode', 'expiryDate'],
    isActive: true
  }
];

async function initNotificationTemplates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing templates
    await NotificationTemplate.deleteMany({});
    console.log('Cleared existing notification templates');

    // Insert default templates
    const result = await NotificationTemplate.insertMany(defaultTemplates);
    console.log(`Inserted ${result.length} notification templates`);

    console.log('Notification templates initialization completed successfully');
  } catch (error) {
    console.error('Error initializing notification templates:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

initNotificationTemplates(); 