// script.js
document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:3000/api'; 
    
    // **********************************************
    // HÀM HỖ TRỢ CHUNG
    // **********************************************

    function showMessage(formId, message, isError = true) {
        const messageElement = document.getElementById(`${formId}-message`);
        if (messageElement) { 
             messageElement.textContent = message;
             messageElement.style.color = isError ? '#ff4d4f' : '#90ee90';
             messageElement.style.display = 'block';
        }
    }

    function clearMessages() {
        const loginMsg = document.getElementById('login-message');
        const registerMsg = document.getElementById('register-message');
        if (loginMsg) loginMsg.textContent = '';
        if (registerMsg) registerMsg.textContent = '';
    }

    function isLoggedIn() {
        return localStorage.getItem('authToken') ? true : false;
    }

    function requireLogin(e) {
        if (!isLoggedIn()) {
            e.preventDefault(); 
            window.location.href = 'login.html'; 
            return false; 
        }
        return true;
    }

    // **********************************************
    // 1. LOGIC TƯƠNG TÁC TRÊN index.html 
    // **********************************************
    
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    if (navItems.length > 0) { 
        
        // --- LOGIC TẢI DỮ LIỆU TRANG CHỦ --- (Giữ nguyên hoặc đã xóa tạm thời)

        // Logic Navigation và Buttons
        navItems.forEach(item => {
            item.addEventListener('click', function(e) {
                const tabName = this.querySelector('p').textContent;

                if (tabName !== 'Trang đầu') {
                     if (!requireLogin(e)) { return; }
                }
                
                navItems.forEach(i => i.classList.remove('active'));
                this.classList.add('active');

                if (tabName !== 'Hồ sơ' && tabName !== 'Trang đầu') {
                    e.preventDefault(); 
                    console.log(`Chức năng ${tabName} đang được xây dựng.`);
                }
            });
        });

        // --- HÀM handleTransaction (Nếu có) ---
    }


    // **********************************************
    // 2. LOGIC TƯƠNG TÁC TRÊN login.html (ĐÃ SỬA LỖI NULL)
    // **********************************************
    
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (showRegisterLink && showLoginLink) { 
        showRegisterLink.onclick = function(e) {
            e.preventDefault();
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
            clearMessages(); 
        }

        showLoginLink.onclick = function(e) {
            e.preventDefault();
            registerForm.style.display = 'none';
            loginForm.style.display = 'block';
            clearMessages(); 
        }
    }

    const registerBtn = document.getElementById('register-btn');
    if (registerBtn) {
        registerBtn.addEventListener('click', async () => {
            
            // Lấy các phần tử input
            const usernameInput = document.getElementById('register-username');
            const countryCodeSelect = document.getElementById('country-code');
            const phoneInput = document.getElementById('register-phone');
            const passwordInput = document.getElementById('register-password');
            const confirmPasswordInput = document.getElementById('register-confirm-password');
            const inviteCodeInput = document.getElementById('register-invite-code');

            // --- LỖI TẠI ĐÂY: KHẮC PHỤC BẰNG CÁCH DÙNG TOÁN TỬ OPTIONAL CHAINING (nếu không có, gán rỗng) ---
            const username = usernameInput ? usernameInput.value : '';
            const countryCode = countryCodeSelect ? countryCodeSelect.value : '';
            const phoneInputValue = phoneInput ? phoneInput.value : '';
            const password = passwordInput ? passwordInput.value : '';
            const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';
            const inviteCode = inviteCodeInput ? inviteCodeInput.value : '';
            
            const phone = countryCode + phoneInputValue; 
            
            clearMessages();

            if (!username || !phoneInputValue || !password || !confirmPassword) { 
                showMessage('register', 'Vui lòng điền đầy đủ Tên đăng nhập, SĐT và Mật khẩu.', true);
                return;
            }
            if (password.length < 6) {
                showMessage('register', 'Mật khẩu phải có ít nhất 6 ký tự.', true);
                return;
            }
            if (password !== confirmPassword) {
                showMessage('register', 'Mật khẩu xác nhận không khớp.', true);
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        username, 
                        phone, 
                        password, 
                        inviteCode
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    showMessage('register', `Đăng ký thành công! ${data.message}`, false);
                    setTimeout(() => { 
                         if (showLoginLink) showLoginLink.click(); 
                    }, 1500); 
                } else {
                    showMessage('register', `Đăng ký thất bại: ${data.message}`, true);
                }
            } catch (error) {
                showMessage('register', 'Không thể kết nối đến server backend (Kiểm tra server.js).', true);
            }
        });
    }

    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) { 
        loginBtn.addEventListener('click', async () => {
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            clearMessages();

            if (!username || !password) {
                showMessage('login', 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.', true);
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    showMessage('login', `Chào mừng, ${data.user.username}!`, false);
                    localStorage.setItem('authToken', data.token); 
                    localStorage.setItem('lastUsername', data.user.username);
                    
                    let redirectPage = 'index.html'; 
                    if (data.user.isAdmin) {
                        redirectPage = 'admin.html';
                    }

                    setTimeout(() => { 
                        window.location.href = redirectPage;
                    }, 1500);
                } else {
                    showMessage('login', `Đăng nhập thất bại: ${data.message}`, true);
                }
            } catch (error) {
                showMessage('login', 'Không thể kết nối đến server backend (Kiểm tra server.js).', true);
            }
        });
    }
});
// Nội dung file script.js kết thúc