const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  // Booking terms and rules
  bookingTerms: {
    type: String,
    default: 'Vui lòng đọc kỹ các quy định và điều khoản trước khi đặt chỗ đậu xe.',
    trim: true
  },
  bookingRules: {
    type: String,
    default: '1. Khách hàng phải đến đúng giờ đã đặt.\n2. Không được để xe quá thời gian đã đặt.\n3. Tuân thủ các quy định an toàn của bãi đậu xe.\n4. Khách hàng chịu trách nhiệm về tài sản trong xe.\n5. Bãi đậu xe không chịu trách nhiệm về thiệt hại do thiên tai.',
    trim: true
  },
  
  // Configurable terms checkboxes
  termsCheckboxes: [{
    id: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    isRequired: {
      type: Boolean,
      default: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    order: {
      type: Number,
      default: 0
    }
  }],
  
  // Contract terms for printing
  contractTerms: {
    type: String,
    default: '<h2>停車場使用合約條款</h2><p>1. 本合約適用於所有使用本停車場服務的客戶。</p><p>2. 客戶應遵守停車場的所有規定和安全措施。</p><p>3. 停車場管理方保留在緊急情況下移動車輛的權利。</p><p>4. 客戶應確保車輛保險有效，並承擔車輛安全責任。</p><p>5. 本合約受當地法律管轄。</p>',
    trim: true
  },
  
  // Contact information
  contactInfo: {
    phone: {
      type: String,
      default: '+886 2 1234 5678',
      trim: true
    },
    email: {
      type: String,
      default: 'info@parkingzone.com',
      trim: true
    },
    address: {
      type: String,
      default: '123 Parking Street, Taipei, Taiwan',
      trim: true
    },
    website: {
      type: String,
      default: 'https://parkingzone.com',
      trim: true
    }
  },
  
  // Contact content configuration for confirmation page
  contactContent: {
    title: {
      type: String,
      default: '聯繫信息',
      trim: true
    },
    content: {
      type: String,
      default: '如有任何問題，請隨時聯繫我們。我們將竭誠為您服務。',
      trim: true
    },
    imageUrl: {
      type: String,
      default: '',
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    showContactInfo: {
      type: Boolean,
      default: true
    }
  },
  
  // Business hours
  businessHours: {
    open: {
      type: String,
      default: '06:00',
      trim: true
    },
    close: {
      type: String,
      default: '22:00',
      trim: true
    },
    is24Hours: {
      type: Boolean,
      default: false
    }
  },
  
  // VIP settings
  defaultVIPDiscount: {
    type: Number,
    default: 10, // 10% discount for VIP users
    min: 0,
    max: 100
  },
  
  // Booking time settings
  bookingAdvanceHours: {
    type: Number,
    default: 24, // Minimum advance booking time in hours
    min: 0
  },
  maxBookingDays: {
    type: Number,
    default: 30, // Maximum days in advance for booking
    min: 1
  },
  minBookingDays: {
    type: Number,
    default: 3, // Minimum days required for booking
    min: 1,
    max: 30
  },
  autoCancelMinutes: {
    type: Number,
    default: 15, // Auto cancel if not checked in within minutes
    min: 0
  },
  
  // Time slot settings
  timeSlotInterval: {
    type: Number,
    default: 15, // 15 minutes intervals
    enum: [15, 30, 45, 60]
  },
  
  // Notification settings
  notificationSettings: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    smsNotifications: {
      type: Boolean,
      default: false
    },
    reminderHours: {
      type: Number,
      default: 2, // Send reminder 2 hours before check-in
      min: 0
    },
    confirmationEmail: {
      type: Boolean,
      default: true
    },
    reminderEmail: {
      type: Boolean,
      default: true
    }
  },
  
  // Payment settings
  paymentSettings: {
    acceptCash: {
      type: Boolean,
      default: true
    },
    acceptCreditCard: {
      type: Boolean,
      default: true
    },
    acceptOnlinePayment: {
      type: Boolean,
      default: false
    },
    currency: {
      type: String,
      default: 'TWD',
      trim: true
    },
    taxRate: {
      type: Number,
      default: 0, // Tax rate in percentage
      min: 0,
      max: 100
    }
  },

  // Luggage settings
  luggageSettings: {
    freeLuggageCount: {
      type: Number,
      default: 1, // Number of free luggage items
      min: 0
    },
    luggagePricePerItem: {
      type: Number,
      default: 100, // Price per additional luggage item
      min: 0
    },
    luggageContent: {
      title: {
        type: String,
        default: '行李注意事項',
        trim: true
      },
      description: {
        type: String,
        default: '請注意您的行李安全，建議將貴重物品隨身攜帶。',
        trim: true
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // System settings
  maintenanceMode: {
    enabled: {
      type: Boolean,
      default: false
    },
    message: {
      type: String,
      default: 'Hệ thống đang bảo trì. Vui lòng thử lại sau.',
      trim: true
    }
  },
  

}, {
  timestamps: true
});

// Ensure only one settings document exists
systemSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};



module.exports = mongoose.model('SystemSettings', systemSettingsSchema); 