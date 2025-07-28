const nodemailer = require('nodemailer');
const NotificationTemplate = require('../models/NotificationTemplate');

class NotificationService {
  constructor() {
    this.emailTransporter = null;
    this.initEmailTransporter();
  }

  // Khởi tạo email transporter
  initEmailTransporter() {
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
    }
  }

  // Thay thế biến trong nội dung template
  replaceVariables(content, variables) {
    let result = content;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, variables[key] || `[${key}]`);
    });
    return result;
  }

  // Gửi email
  async sendEmail(templateName, recipientEmail, variables = {}) {
    try {
      if (!this.emailTransporter) {
        console.log('Email transporter not configured');
        return { success: false, error: 'Email service not configured' };
      }

      // Lấy template
      const template = await NotificationTemplate.findOne({ 
        name: templateName, 
        type: 'email',
        isActive: true 
      });

      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      // Thay thế biến
      const subject = this.replaceVariables(template.subject || '', variables);
      const content = this.replaceVariables(template.content, variables);

      // Gửi email
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: recipientEmail,
        subject: subject,
        html: content.replace(/\n/g, '<br>')
      };

      const info = await this.emailTransporter.sendMail(mailOptions);
      
      console.log('Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }
  }

  // Gửi SMS (mock implementation - cần tích hợp SMS service thực tế)
  async sendSMS(templateName, phoneNumber, variables = {}) {
    try {
      // Lấy template
      const template = await NotificationTemplate.findOne({ 
        name: templateName, 
        type: 'sms',
        isActive: true 
      });

      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      // Thay thế biến
      const content = this.replaceVariables(template.content, variables);

      // Mock SMS sending - trong thực tế sẽ tích hợp với SMS service
      console.log(`SMS to ${phoneNumber}: ${content}`);
      
      // TODO: Tích hợp với SMS service thực tế như Twilio, Nexmo, etc.
      // const smsResult = await smsService.send(phoneNumber, content);
      
      return { success: true, message: 'SMS sent (mock)' };
    } catch (error) {
      console.error('Error sending SMS:', error);
      return { success: false, error: error.message };
    }
  }

  // Gửi Push Notification (mock implementation - cần tích hợp FCM hoặc service khác)
  async sendPushNotification(templateName, deviceTokens, variables = {}) {
    try {
      // Lấy template
      const template = await NotificationTemplate.findOne({ 
        name: templateName, 
        type: 'push',
        isActive: true 
      });

      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      // Thay thế biến
      const content = this.replaceVariables(template.content, variables);

      // Mock push notification - trong thực tế sẽ tích hợp với FCM hoặc service khác
      console.log(`Push notification to devices: ${content}`);
      
      // TODO: Tích hợp với Firebase Cloud Messaging hoặc service khác
      // const pushResult = await fcmService.send(deviceTokens, {
      //   title: template.name,
      //   body: content
      // });
      
      return { success: true, message: 'Push notification sent (mock)' };
    } catch (error) {
      console.error('Error sending push notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Gửi thông báo booking confirmation
  async sendBookingConfirmation(booking, user) {
    const variables = {
      customerName: user.name,
      bookingId: booking._id,
      bookingDate: new Date(booking.bookingDate).toLocaleDateString('vi-VN'),
      startTime: booking.startTime,
      endTime: booking.endTime,
      parkingType: booking.parkingType?.name || 'Bãi đậu xe',
      totalAmount: booking.totalAmount?.toLocaleString('vi-VN') || '0',
      location: booking.parkingType?.description || 'Vị trí đậu xe'
    };

    const results = [];

    // Gửi email xác nhận
    if (user.email) {
      const emailResult = await this.sendEmail('Xác nhận đặt chỗ', user.email, variables);
      results.push({ type: 'email', ...emailResult });
    }

    // Gửi SMS nhắc nhở (nếu có số điện thoại)
    if (user.phone) {
      const smsResult = await this.sendSMS('Nhắc nhở đặt chỗ', user.phone, variables);
      results.push({ type: 'sms', ...smsResult });
    }

    return results;
  }

  // Gửi thông báo thanh toán
  async sendPaymentConfirmation(booking, user, paymentDetails) {
    const variables = {
      customerName: user.name,
      bookingId: booking._id,
      amount: booking.totalAmount?.toLocaleString('vi-VN') || '0',
      paymentMethod: paymentDetails.method || 'Thanh toán',
      paymentTime: new Date().toLocaleString('vi-VN')
    };

    const results = [];

    if (user.email) {
      const emailResult = await this.sendEmail('Xác nhận thanh toán', user.email, variables);
      results.push({ type: 'email', ...emailResult });
    }

    return results;
  }

  // Gửi thông báo hủy đặt chỗ
  async sendCancellationNotification(booking, user, refundAmount) {
    const variables = {
      customerName: user.name,
      bookingId: booking._id,
      refundAmount: refundAmount?.toLocaleString('vi-VN') || '0',
      refundTime: new Date().toLocaleString('vi-VN'),
      cancelReason: 'Hủy bởi khách hàng'
    };

    const results = [];

    if (user.email) {
      const emailResult = await this.sendEmail('Thông báo hủy đặt chỗ', user.email, variables);
      results.push({ type: 'email', ...emailResult });
    }

    return results;
  }

  // Gửi thông báo khuyến mãi
  async sendPromotionNotification(users, promotionData) {
    const variables = {
      discountPercent: promotionData.discountPercent?.toString() || '0',
      promoCode: promotionData.code || 'PROMO',
      expiryDate: promotionData.expiryDate || new Date().toLocaleDateString('vi-VN')
    };

    const results = [];

    for (const user of users) {
      if (user.email) {
        const emailResult = await this.sendEmail('Thông báo khuyến mãi', user.email, variables);
        results.push({ userId: user._id, type: 'email', ...emailResult });
      }
    }

    return results;
  }

  // Test gửi thông báo
  async testNotification(templateName, type, recipient, variables = {}) {
    switch (type) {
      case 'email':
        return await this.sendEmail(templateName, recipient, variables);
      case 'sms':
        return await this.sendSMS(templateName, recipient, variables);
      case 'push':
        return await this.sendPushNotification(templateName, [recipient], variables);
      default:
        return { success: false, error: 'Invalid notification type' };
    }
  }
}

module.exports = new NotificationService(); 