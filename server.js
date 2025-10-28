// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const fs = require('fs'); // Thư viện File System để làm việc với file

const app = express();
const PORT = 3000;
const JWT_SECRET = 'YOUR_SUPER_SECRET_KEY'; 
const DATA_FILE = 'db_data.json'; // Tên file lưu trữ

// Cấu hình Rate Limiting
const DEPOSIT_LIMIT = 5; 
const DEPOSIT_TIME_WINDOW_MS = 10 * 60 * 1000; // 10 phút

// Cấu hình Middleware
app.use(cors()); 
app.use(bodyParser.json());

// **********************************************
// LOGIC LƯU VÀ TẢI DỮ LIỆU TỪ FILE JSON
// **********************************************

let users = []; 
let nextUserId = 1; 

function loadUsers() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            const loadedData = JSON.parse(data);
            
            users = loadedData.users || [];
            
            if (users.length > 0) {
                 const maxId = users.reduce((max, user) => user.id > max ? user.id : max, 0);
                 nextUserId = maxId + 1;
            }
            console.log(`Đã tải ${users.length} người dùng từ file ${DATA_FILE}.`);
            return true;
        }
    } catch (e) {
        console.error(`LỖI: Không thể đọc hoặc phân tích file ${DATA_FILE}:`, e.message);
    }
    return false;
}

function saveUsers() {
    try {
        const dataToSave = { users };
        fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 4), 'utf8');
    } catch (e) {
        console.error(`LỖI: Không thể ghi dữ liệu vào ${DATA_FILE}:`, e.message);
    }
}

// **********************************************
// KHỞI TẠO VÀ CẤU HÌNH BAN ĐẦU
// **********************************************

const INITIAL_BALANCE = 0.00; 
const INITIAL_LIFETIME_DEPOSIT = 0.00;
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD_PLAINTEXT = '123456'; 


function setupInitialData() {
    if (!loadUsers() || users.length === 0) {
        
        const adminUser = {
            id: 0, 
            username: ADMIN_USERNAME,
            password: ADMIN_PASSWORD_PLAINTEXT, 
            isAdmin: true,
            balance: 0,
            lifetimeDeposit: 0,
            vipLevel: 0,
            fullName: 'ADMIN HỆ THỐNG',
            isNameVerified: true,
            email: 'admin@coinvid.com',
            fundPasswordHash: null,
            depositHistory: [] 
        };
        users.push(adminUser);

        bcrypt.hash('123456', 10).then(hashedPass => {
            const testUser = {
                id: nextUserId++,
                username: 'testuser',
                password: hashedPass,
                isAdmin: false,
                balance: 0.00,
                lifetimeDeposit: 0.00,
                vipLevel: 1,
                createdAt: new Date(),
                phone: '+8490123456',
                fullName: null,
                isNameVerified: false,
                email: null,
                fundPasswordHash: null,
                depositHistory: [] 
            };
            users.push(testUser);
            saveUsers();
            console.log("Đã khởi tạo Admin và TestUser mới.");
        });

    }
}

// Hàm tính cấp độ VIP
function calculateVipLevel(lifetimeDeposit) {
    if (lifetimeDeposit >= 800000) return 9;
    if (lifetimeDeposit >= 300000) return 8;
    if (lifetimeDeposit >= 100000) return 7;
    if (lifetimeDeposit >= 15000) return 6;
    if (lifetimeDeposit >= 5000) return 5;
    if (lifetimeDeposit >= 800) return 4;
    if (lifetimeDeposit >= 100) return 3;
    if (lifetimeDeposit >= 2) return 2;
    return 1;
}

// Hàm lấy mục tiêu nạp tiếp theo
function getNextVipTarget(currentLevel) {
    const targets = {
        1: 2, 
        2: 100, 
        3: 800, 
        4: 5000,
        5: 15000,
        6: 100000,
        7: 300000,
        8: 800000,
        9: 9999999,
    };
    return targets[currentLevel] || 9999999;
}


// **********************************************
// HÀM KIỂM TRA XÁC THỰC (Middleware Authentication)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && req.headers['authorization'].split(' ')[1]; 
    
    if (token == null) return res.status(401).json({ message: 'Token không hợp lệ.' }); 

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token đã hết hạn hoặc không hợp lệ.' }); 
        
        const fullUser = users.find(u => u.id === user.userId); 
        
        if (!fullUser) {
             console.error(`Lỗi: Không tìm thấy người dùng có ID ${user.userId} trong DB giả lập.`);
             return res.status(401).json({ message: 'Người dùng trong Token không tồn tại.' });
        }

        req.user = fullUser;
        next();
    });
}

// Middleware chỉ dành cho Admin
function authenticateAdmin(req, res, next) {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Truy cập bị từ chối: Chỉ dành cho Admin.' });
    }
    next();
}


// **********************************************
// 1. ROUTE XÁC THỰC (AUTH)
// **********************************************

// ROUTE ĐĂNG KÝ (REGISTER)
app.post('/api/auth/register', async (req, res) => {
    const { username, phone, password, inviteCode } = req.body; 

    if (!username || !phone || !password) {
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ Tên đăng nhập, SĐT và Mật khẩu.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }

    if (users.find(u => u.username === username)) {
        return res.status(400).json({ message: 'Tên người dùng đã tồn tại.' });
    }
    if (users.find(u => u.phone === phone)) {
        return res.status(400).json({ message: 'Số điện thoại đã được đăng ký.' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = {
            id: nextUserId++, 
            username,
            phone,
            password: hashedPassword,
            inviteCodeUsed: inviteCode || null,
            balance: INITIAL_BALANCE,
            lifetimeDeposit: INITIAL_LIFETIME_DEPOSIT,
            vipLevel: calculateVipLevel(INITIAL_LIFETIME_DEPOSIT),
            createdAt: new Date(),
            fullName: null, 
            isNameVerified: false, 
            isAdmin: false, 
            email: null,
            fundPasswordHash: null,
            depositHistory: [] 
        };

        users.push(newUser);
        saveUsers(); // LƯU SAU KHI ĐĂNG KÝ
        
        res.status(201).json({ 
            message: 'Đăng ký thành công!', 
            user: { id: newUser.id, username: newUser.username, balance: newUser.balance, phone: newUser.phone } 
        });

    } catch (error) {
        console.error('Lỗi server khi đăng ký:', error);
        res.status(500).json({ message: 'Lỗi server khi đăng ký.' });
    }
});

// ROUTE ĐĂNG NHẬP (LOGIN)
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username); 
    if (!user) {
        return res.status(400).json({ message: 'Tên người dùng hoặc mật khẩu không đúng.' });
    }
    
    let isMatch = false;

    if (user.isAdmin) {
        // ADMIN LOGIN: So sánh Plain Text trực tiếp (123456)
        if (user.password === password) {
            isMatch = true;
        }
    } else {
        // USER LOGIN: So sánh bằng mã hóa
        isMatch = await bcrypt.compare(password, user.password);
    }
    
    if (!isMatch) {
        return res.status(400).json({ message: 'Tên người dùng hoặc mật khẩu không đúng.' });
    }

    const payload = { userId: user.id, username: user.username, isAdmin: user.isAdmin };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }); 

    res.json({ 
        token, 
        message: 'Đăng nhập thành công!',
        user: { 
            id: user.id, 
            username: user.username, 
            balance: user.balance,
            vipLevel: user.vipLevel,
            lifetimeDeposit: user.lifetimeDeposit,
            isAdmin: user.isAdmin,
        }
    });
});

// **********************************************
// 2. ROUTE VÍ & CÀI ĐẶT
// **********************************************

// ROUTE NẠP TIỀN (DEPOSIT)
app.post('/api/wallet/deposit', authenticateToken, (req, res) => {
    const { amount } = req.body;
    const user = req.user; 
    
    // --- LOGIC RATE LIMITING ---
    const now = Date.now();
    user.depositHistory = user.depositHistory.filter(timestamp => (now - timestamp) < DEPOSIT_TIME_WINDOW_MS);
    
    if (user.depositHistory.length >= DEPOSIT_LIMIT) {
         return res.status(429).json({ message: `Bạn chỉ được nạp tối đa ${DEPOSIT_LIMIT} lần trong ${DEPOSIT_TIME_WINDOW_MS / 60000} phút.` });
    }
    
    user.depositHistory.push(now);
    // --- KẾT THÚC LOGIC RATE LIMITING ---

    if (typeof amount !== 'number' || amount <= 0) { return res.status(400).json({ message: 'Số tiền nạp không hợp lệ.' }); }
    
    user.balance += amount;
    user.lifetimeDeposit += amount; 
    const newVipLevel = calculateVipLevel(user.lifetimeDeposit);
    if (newVipLevel > user.vipLevel) { user.vipLevel = newVipLevel; }
    
    saveUsers(); // LƯU SAU KHI GIAO DỊCH
    res.json({ message: 'Nạp tiền thành công!', newBalance: user.balance, newVipLevel: user.vipLevel });
});

// ROUTE RÚT TIỀN (WITHDRAW)
app.post('/api/wallet/withdraw', authenticateToken, async (req, res) => {
    const { amount, fundPassword } = req.body;
    const user = req.user;

    if (!user.fundPasswordHash) { return res.status(403).json({ message: 'Vui lòng đặt Mật khẩu quỹ trước khi rút tiền.' }); }
    
    const isFundPasswordCorrect = await bcrypt.compare(fundPassword, user.fundPasswordHash);
    if (!isFundPasswordCorrect) { return res.status(400).json({ message: 'Mật khẩu quỹ không đúng.' }); }

    if (typeof amount !== 'number' || amount <= 0) { return res.status(400).json({ message: 'Số tiền rút không hợp lệ.' }); }
    if (amount > user.balance) { return res.status(400).json({ message: 'Số dư không đủ để thực hiện giao dịch.' }); }

    user.balance -= amount;
    saveUsers(); 
    res.json({ message: 'Rút tiền thành công!', newBalance: user.balance });
});


// ROUTE GIẢ LẬP LIÊN KẾT THẺ NGÂN HÀNG (Xác thực Tên thật)
// server.js - ĐOẠN CODE CẦN SỬA

// ROUTE GIẢ LẬP LIÊN KẾT THẺ NGÂN HÀNG (Xác thực Tên thật)
app.post('/api/wallet/bind-card', authenticateToken, (req, res) => {
    const { bankName, accountNumber, fullName } = req.body;
    const user = req.user;
    
    // Đã XÓA KIỂM TRA: if (user.isNameVerified) { return res.status(400).json({ message: 'Tên thật đã được xác minh trước đó.' }); }
    
    if (!bankName || !accountNumber || !fullName) { return res.status(400).json({ message: 'Vui lòng điền đủ thông tin ngân hàng và Họ tên.' }); }

    // Cập nhật giá trị mới
    user.fullName = fullName.toUpperCase();
    user.isNameVerified = true;
    user.bankName = bankName; // Lưu tên Ngân hàng mới
    user.accountNumber = accountNumber; // Lưu số tài khoản mới

    saveUsers(); 
    res.json({ message: 'Cập nhật liên kết thẻ thành công.', fullName: user.fullName });
});

// ROUTE ĐẶT/ĐỔI MẬT KHẨU QUỸ
app.post('/api/settings/fund-password', authenticateToken, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = req.user;

    if (newPassword.length < 6) { return res.status(400).json({ message: 'Mật khẩu quỹ phải có ít nhất 6 ký tự.' }); }
    if (user.fundPasswordHash) {
        if (!oldPassword) { return res.status(400).json({ message: 'Vui lòng nhập mật khẩu quỹ cũ.' }); }
        const isOldPasswordCorrect = await bcrypt.compare(oldPassword, user.fundPasswordHash);
        if (!isOldPasswordCorrect) { return res.status(400).json({ message: 'Mật khẩu quỹ cũ không đúng.' }); }
    }
    
    const salt = await bcrypt.genSalt(10);
    user.fundPasswordHash = await bcrypt.hash(newPassword, salt);
    saveUsers(); 
    res.json({ message: 'Mật khẩu quỹ đã được cập nhật thành công.' });
});

// ROUTE ĐỔI MẬT KHẨU ĐĂNG NHẬP
app.post('/api/settings/change-password', authenticateToken, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = req.user;

    if (newPassword.length < 6) { return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' }); }
    if (newPassword === oldPassword) { return res.status(400).json({ message: 'Mật khẩu mới không được giống mật khẩu cũ.' }); }
    
    let isOldPasswordCorrect;
    if (user.isAdmin) {
         isOldPasswordCorrect = (user.password === oldPassword);
    } else {
         isOldPasswordCorrect = await bcrypt.compare(oldPassword, user.password);
    }
    
    if (!isOldPasswordCorrect) { return res.status(400).json({ message: 'Mật khẩu đăng nhập cũ không đúng.' }); }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    user.password = hashedPassword;
    saveUsers(); 
    res.json({ message: 'Mật khẩu đăng nhập đã được thay đổi thành công.' });
});


// ROUTE CẬP NHẬT EMAIL
app.post('/api/settings/set-email', authenticateToken, (req, res) => {
    const { email } = req.body;
    if (!email || !email.includes('@')) { return res.status(400).json({ message: 'Email không hợp lệ.' }); }
    
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ message: 'Địa chỉ email này đã được sử dụng.' });
    }
    
    const user = users.find(u => u.id === req.user.id);
    user.email = email;
    saveUsers(); 
    res.json({ message: 'Địa chỉ thư (email) đã được gắn thành công.' });
});


// ROUTE CẬP NHẬT SỐ ĐIỆN THOẠI
app.post('/api/settings/change-phone', authenticateToken, (req, res) => {
    const { newPhone } = req.body;
    if (!newPhone || newPhone.length < 10) { return res.status(400).json({ message: 'Số điện thoại không hợp lệ.' }); }
    
    if (users.find(u => u.phone === newPhone && u.id !== req.user.id)) {
        return res.status(400).json({ message: 'Số điện thoại này đã được sử dụng bởi người dùng khác.' });
    }
    
    const user = users.find(u => u.id === req.user.id);
    user.phone = newPhone;
    saveUsers(); 
    res.json({ message: 'Số điện thoại đã được thay đổi thành công.' });
});


// **********************************************
// 3. ROUTE ADMIN (CẦN XÁC THỰC ADMIN)
// **********************************************

// ROUTE LẤY DANH SÁCH NGƯỜI DÙNG (CHỈ ADMIN)
app.get('/api/admin/users', authenticateToken, authenticateAdmin, (req, res) => {
    const userList = users.filter(u => !u.isAdmin).map(u => ({
        id: u.id,
        username: u.username,
        phone: u.phone,
        balance: u.balance,
        vipLevel: u.vipLevel,
        lifetimeDeposit: u.lifetimeDeposit,
        isNameVerified: u.isNameVerified,
        createdAt: u.createdAt,
    }));
    res.json(userList);
});

// ROUTE ĐIỀU CHỈNH SỐ DƯ NGƯỜI DÙNG (CHỈ ADMIN)
app.post('/api/admin/adjust-balance', authenticateToken, authenticateAdmin, (req, res) => {
    const { userId, amount, reason } = req.body;
    const targetUser = users.find(u => u.id === parseInt(userId)); 

    if (!targetUser || targetUser.isAdmin) {
        return res.status(404).json({ message: 'Người dùng không hợp lệ.' });
    }
    if (typeof amount !== 'number' || amount === 0) {
        return res.status(400).json({ message: 'Số tiền điều chỉnh không hợp lệ.' });
    }
    
    const oldBalance = targetUser.balance;
    targetUser.balance += amount;

    saveUsers();
    res.json({
        message: 'Điều chỉnh số dư thành công.',
        oldBalance: oldBalance,
        newBalance: targetUser.balance
    });
});

// ROUTE XÓA USER (CHỈ ADMIN)
app.delete('/api/admin/users/:userId', authenticateToken, authenticateAdmin, (req, res) => {
    const userIdToDelete = parseInt(req.params.userId);
    const initialLength = users.length;
    
    users = users.filter(user => user.id !== userIdToDelete);

    if (users.length < initialLength) {
        saveUsers();
        return res.json({ message: `Người dùng ID ${userIdToDelete} đã được xóa thành công.` });
    } else {
        return res.status(404).json({ message: `Không tìm thấy người dùng ID ${userIdToDelete}.` });
    }
});


// **********************************************
// 4. ROUTE THÔNG TIN CHUNG
// **********************************************
app.get('/api/user/profile', authenticateToken, (req, res) => {
    const user = req.user;
    const nextTarget = getNextVipTarget(user.vipLevel);
    
    res.json({
        username: user.username,
        vipLevel: user.vipLevel,
        lifetimeDeposit: user.lifetimeDeposit,
        nextVipTarget: nextTarget,
        phone: user.phone,
        fullName: user.fullName, 
        isNameVerified: user.isNameVerified,
        email: user.email, 
        fundPasswordSet: !!user.fundPasswordHash,
        bankName: user.bankName,
        accountNumber: user.accountNumber,
    });
});


// ROUTE LỖI 404 TỔNG QUÁT (ROUTE NÀY PHẢI LUÔN LÀ CUỐI CÙNG)
app.use((req, res, next) => {
    console.warn(`404 Not Found cho đường dẫn: ${req.url}`);
    res.status(404).json({ message: 'Route API không tồn tại.' });
});

// **********************************************
// Chạy Server
// **********************************************
app.listen(PORT, () => {
    setupInitialData(); 
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
    console.log(`Kiểm tra Rate Limit: ${DEPOSIT_LIMIT} lần mỗi ${DEPOSIT_TIME_WINDOW_MS / 60000} phút.`);
});

// Nội dung file server.js kết thúc