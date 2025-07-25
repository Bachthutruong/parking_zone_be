# Parking Zone Backend API

Backend API cho hệ thống quản lý đặt chỗ đậu xe sân bay.

## Công nghệ sử dụng

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM cho MongoDB
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **express-validator** - Input validation
- **moment** - Date/time handling

## Cài đặt

1. **Clone repository và cài đặt dependencies:**
```bash
cd backend
npm install
```

2. **Tạo file .env:**
```bash
cp env.example .env
```

3. **Cấu hình MongoDB:**
- Cài đặt MongoDB trên máy local hoặc sử dụng MongoDB Atlas
- Cập nhật `MONGODB_URI` trong file `.env`

4. **Chạy server:**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký tài khoản
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/profile` - Lấy thông tin profile
- `PUT /api/auth/profile` - Cập nhật profile
- `PUT /api/auth/change-password` - Đổi mật khẩu
- `GET /api/auth/booking-terms` - Lấy điều khoản đặt chỗ

### Parking Lots
- `GET /api/parking` - Lấy danh sách bãi đậu xe
- `GET /api/parking/:id` - Lấy thông tin bãi đậu xe
- `GET /api/parking/type/:type` - Lấy bãi đậu xe theo loại

### Bookings
- `POST /api/bookings/check-availability` - Kiểm tra khả dụng
- `POST /api/bookings/create` - Tạo đặt chỗ
- `GET /api/bookings/my-bookings` - Lấy đặt chỗ của user
- `GET /api/bookings/:id` - Lấy thông tin đặt chỗ
- `PUT /api/bookings/:id/cancel` - Hủy đặt chỗ
- `GET /api/bookings/search` - Tìm kiếm đặt chỗ

### Addon Services
- `GET /api/addon-services` - Lấy danh sách dịch vụ bổ sung
- `GET /api/addon-services/:id` - Lấy thông tin dịch vụ
- `GET /api/addon-services/category/:category` - Lấy dịch vụ theo danh mục

### Discount Codes
- `GET /api/discount-codes/validate/:code` - Xác thực mã giảm giá
- `GET /api/discount-codes/:code` - Lấy thông tin mã giảm giá

### Admin Panel
- `GET /api/admin/dashboard` - Thống kê dashboard
- `GET /api/admin/bookings` - Quản lý đặt chỗ
- `PUT /api/admin/bookings/:id/status` - Cập nhật trạng thái đặt chỗ
- `GET /api/admin/users` - Quản lý người dùng
- `PUT /api/admin/users/:id/vip` - Cập nhật VIP status
- `GET /api/admin/settings` - Lấy cài đặt hệ thống
- `PUT /api/admin/settings` - Cập nhật cài đặt hệ thống

## Database Models

### User
- Thông tin người dùng, authentication, VIP status

### ParkingLot
- Thông tin bãi đậu xe, giá cả, khả dụng

### Booking
- Thông tin đặt chỗ, trạng thái, thanh toán

### AddonService
- Dịch vụ bổ sung, giá cả, danh mục

### DiscountCode
- Mã giảm giá, điều kiện sử dụng

### SystemSettings
- Cài đặt hệ thống, điều khoản

## Middleware

- **auth** - Xác thực JWT token
- **requireRole** - Kiểm tra quyền hạn
- **validate** - Validation input data

## Security Features

- JWT authentication
- Password hashing với bcrypt
- Input validation
- Rate limiting
- CORS configuration
- Helmet security headers

## Environment Variables

```env
PORT=5002
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/parking_zone
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
ADMIN_EMAIL=admin@parkingzone.com
ADMIN_PASSWORD=admin123
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Testing

```bash
npm test
```

## Production Deployment

1. Cài đặt dependencies:
```bash
npm install --production
```

2. Cấu hình environment variables cho production

3. Chạy server:
```bash
npm start
```

## License

MIT 