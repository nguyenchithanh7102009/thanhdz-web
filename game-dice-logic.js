// game-dice-logic.js

document.addEventListener('DOMContentLoaded', initializeGameLogic);

// --- CẤU HÌNH GAME ---
const API_BASE_URL = 'https://api.coinwit.net';
const BETTING_TIME = 50; // Thời gian đặt cược (50 -> 1)
const ROLL_START_TIME = 0; // Bắt đầu lắc (0 -> -6)
const ANNOUNCE_START_TIME = -6; // Bắt đầu công bố (-6 -> -10)
const SESSION_END_TIME = -10; // Tổng thời gian phiên (50s + 6s + 4s = 60s)

// --- BIẾN TRẠNG THÁI GAME ---
let currentSessionId = 0; // Thay đổi từ 0 để bắt đầu từ #1
let timeRemaining = BETTING_TIME;
let gameInterval;
let gameState = 'BETTING'; 
let stagedBetAmount = 0;
let selectedBetType = null;
let virtualBalance = 10000000; // Giả lập số dư 10M (Cần hiện)

// --- DOM ELEMENTS ---
const timerElement = document.getElementById('countdown-timer');
const statusElement = document.getElementById('game-status');
const sessionIdElement = document.getElementById('current-session-id');
const diceElements = [
    document.getElementById('dice-1'),
    document.getElementById('dice-2'),
    document.getElementById('dice-3')
];
const betOptions = document.querySelectorAll('.bet-option');
const confirmBetBtn = document.getElementById('btn-confirm-bet');
const resultSummaryElement = document.getElementById('result-summary');
const resultTagsElement = document.getElementById('result-tags');
const historyGrid = document.getElementById('history-grid');

// **************************************************
// PHẦN 1: LOGIC GAME VÀ TIMER
// **************************************************

// Hàm lấy ID phiên mới (Bắt đầu từ 1 và tăng dần)
const getNextSessionId = () => {
    // Lấy ID phiên cuối cùng đã lưu (mô phỏng server) hoặc bắt đầu từ 1
    let lastId = parseInt(localStorage.getItem('lastSessionId')) || 0;
    lastId++;
    localStorage.setItem('lastSessionId', lastId);
    return lastId;
};

const updateBettingState = (open) => {
    betOptions.forEach(btn => btn.classList.toggle('disabled', !open));
    confirmBetBtn.disabled = !open;
    document.getElementById('btn-tai').classList.remove('selected');
    document.getElementById('btn-xiu').classList.remove('selected');
    selectedBetType = null;
    stagedBetAmount = 0;
    updateStagedInfoDisplay();
};

// Hàm chuyển trạng thái (StateMachine)
const transitionState = () => {
    
    if (timeRemaining > ROLL_START_TIME) {
        // Giai đoạn 1: Đặt cược (50s -> 1s)
        gameState = 'BETTING';
        statusElement.textContent = 'MỞ CƯỢC';
        updateBettingState(true);
        resultSummaryElement.textContent = 'Sẵn sàng đặt cược...';
        resultTagsElement.innerHTML = '';
        updateDiceDisplay('?');
        
    } else if (timeRemaining > ANNOUNCE_START_TIME) {
        // Giai đoạn 2: Lắc xúc xắc (0s -> -6s)
        gameState = 'ROLLING';
        statusElement.textContent = 'ĐÓNG CƯỢC - LẮC XÚC XẮC!';
        updateBettingState(false);
        resultSummaryElement.textContent = 'Đang lắc...';
        
        if (timeRemaining === ROLL_START_TIME) {
             startDiceAnimation(); // Bắt đầu khi chuyển từ 1s sang 0s
        }

    } else {
        // Giai đoạn 3: Công bố kết quả (-6s -> -10s)
        gameState = 'ANNOUNCING';
        statusElement.textContent = 'CÔNG BỐ KẾT QUẢ!';
        
        if (timeRemaining === ANNOUNCE_START_TIME) {
             // Đảm bảo kết quả đã được xử lý xong
        }
        
        resultSummaryElement.textContent = 'Chờ phiên mới...';
    }
    
    // Cập nhật hiển thị timer (Sử dụng dấu trừ cho số âm)
    timerElement.textContent = timeRemaining > 0 
        ? timeRemaining.toString().padStart(2, '0')
        : (timeRemaining === 0 ? "00" : `-${Math.abs(timeRemaining).toString().padStart(2, '0')}`);
};

// Hàm chính chạy timer
const startSessionTimer = () => {
    if (gameInterval) clearInterval(gameInterval);
    
    // CẬP NHẬT PHIÊN MỚI
    currentSessionId = getNextSessionId();
    sessionIdElement.textContent = `#${currentSessionId}`;
    
    timeRemaining = BETTING_TIME; // Bắt đầu từ 50

    gameInterval = setInterval(() => {
        
        if (timeRemaining <= SESSION_END_TIME) {
            // Hết 60s (50 -> -10), bắt đầu phiên mới
            clearInterval(gameInterval);
            return startSessionTimer();
        }
        
        transitionState();
        timeRemaining--;
        
    }, 1000);
};

// **************************************************
// PHẦN 2: LOGIC XÚC XẮC VÀ KẾT QUẢ
// **************************************************

const updateDiceDisplay = (values) => {
    if (Array.isArray(values)) {
        diceElements.forEach((dice, index) => dice.textContent = values[index]);
    } else {
        diceElements.forEach(dice => dice.textContent = values);
    }
};

let diceAnimationTimeout;

const startDiceAnimation = () => {
    if (diceAnimationTimeout) clearTimeout(diceAnimationTimeout);
    
    diceElements.forEach(dice => dice.classList.add('rolling'));
    
    let diceResults = [];

    // Lắc 2 giây từ trái sang phải (Tổng 6 giây)
    diceElements.forEach((dice, index) => {
        diceAnimationTimeout = setTimeout(() => {
            dice.classList.remove('rolling');
            
            // Random kết quả
            const result = Math.floor(Math.random() * 6) + 1;
            dice.textContent = result;
            diceResults.push(result);

            // Công bố kết quả chính thức sau khi xúc xắc cuối cùng dừng (2s * 3 = 6s)
            if (index === diceElements.length - 1) {
                setTimeout(() => processDiceResult(diceResults), 100); 
            }
        }, (index + 1) * 2000); // 2 giây/xúc xắc
    });
};

const processDiceResult = (results) => {
    const total = results.reduce((sum, val) => sum + val, 0);
    const isBig = total >= 11; // Tài: 11-18
    const isEven = total % 2 === 0;

    const resultType = isBig ? 'Tài' : 'Xỉu';
    const resultParity = isEven ? 'Chẵn' : 'Lẻ';
    const resultColorType = isBig ? 'Lớn' : 'Nhỏ'; 

    // Cập nhật giao diện
    resultSummaryElement.textContent = `Tổng: ${total} (${resultType})`;
    resultSummaryElement.style.color = isBig ? '#FF6347' : '#50C878'; 
    
    resultTagsElement.innerHTML = `
        <div class="result-tag" style="background-color: ${isBig ? '#DC143C' : '#2E8B57'}">${resultType}</div>
        <div class="result-tag" style="background-color: ${isEven ? '#2196F3' : '#ff9800'}">${resultParity}</div>
    `;

    // CẬP NHẬT LỊCH SỬ CẦU
    updateHistory(total, resultColorType, resultParity);
};

// **************************************************
// PHẦN 3: LỊCH SỬ CẦU
// **************************************************

let historyData = [];

const updateHistory = (total, type, parity) => {
    const historyItem = document.createElement('div');
    historyItem.classList.add('history-item');
    historyItem.classList.add(type.includes('Lớn') ? 'Lớn' : 'Nhỏ'); 

    historyItem.textContent = total;
    historyItem.title = `${type} - ${parity} (Tổng: ${total})`;
    
    historyGrid.prepend(historyItem);

    if (historyGrid.children.length > 50) {
        historyGrid.removeChild(historyGrid.lastChild);
    }
};


// **************************************************
// PHẦN 4: LOGIC ĐẶT CƯỢC VÀ KHỞI TẠO
// **************************************************

const updateStagedInfoDisplay = () => {
    const infoElement = document.getElementById('bet-info-staged');
    const displayType = {
        'tai': 'TÀI',
        'xiu': 'XỈU'
    }[selectedBetType] || '';

    if (selectedBetType) {
        infoElement.textContent = `Chọn cược: ${stagedBetAmount.toLocaleString()} VND vào ${displayType}`;
    } else {
        infoElement.textContent = 'Chọn cửa & mức cược';
    }
    document.getElementById('btn-confirm-bet').disabled = stagedBetAmount <= 0 || !selectedBetType || gameState !== 'BETTING';
};

// Hàm chính khởi tạo
async function initializeGameLogic() {
    // --- HÀM CẬP NHẬT SỐ DƯ ---
    const setBalance = (newBalance) => {
        virtualBalance = newBalance;
        // Hiển thị số dư
        document.getElementById('current-balance-display').textContent = newBalance.toLocaleString('vi-VN', { minimumFractionDigits: 2 });
    };
    setBalance(virtualBalance); 

    // --- LOGIC ĐẶT CƯỢC ---
    document.querySelectorAll('.bet-option').forEach(btn => {
        btn.addEventListener('click', () => {
            if (gameState !== 'BETTING') return;
            document.querySelectorAll('.bet-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedBetType = btn.dataset.type;
            updateStagedInfoDisplay();
        });
    });

    document.querySelectorAll('.quick-bet-grid button').forEach(btn => {
        btn.addEventListener('click', () => {
            if (gameState !== 'BETTING') return;
            const amountAttr = btn.dataset.amount;
            let amount;

            if (btn.id === 'btn-all-in') {
                 amount = virtualBalance;
            } else {
                 amount = parseInt(amountAttr);
            }
            
            stagedBetAmount += amount;
            if (stagedBetAmount > virtualBalance) stagedBetAmount = virtualBalance;

            updateStagedInfoDisplay();
        });
    });

    document.getElementById('btn-confirm-bet').addEventListener('click', () => {
        if (gameState !== 'BETTING' || stagedBetAmount <= 0 || !selectedBetType) return;
        
        document.getElementById('bet-message').textContent = `Đã gửi cược ${stagedBetAmount.toLocaleString()} VND vào ${selectedBetType.toUpperCase()}.`;
        
        virtualBalance -= stagedBetAmount;
        setBalance(virtualBalance);
        
        stagedBetAmount = 0;
        document.querySelectorAll('.bet-option').forEach(b => b.classList.remove('selected'));
        selectedBetType = null;
        updateStagedInfoDisplay();
    });

    // --- BẮT ĐẦU VÒNG LẶP GAME ---
    startSessionTimer();
}