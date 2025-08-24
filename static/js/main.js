// --- 전역 변수 및 상태 관리 ---
let currentUser = { uid: null };
let currentRole = null;
let userProfile = null;
const allJobsData = new Map();
let reviewTimers = {}; // 리뷰 타이머를 관리하기 위한 객체
let dealerJobFilter = 'open'; // 딜러 뷰 필터 상태
let currentCancelInfo = {}; // 취소 정보를 담을 객체

// --- UI 요소 ---
const loginView = document.getElementById('login-view');
const testLoginForm = document.getElementById('test-login-form');
const userIdSelect = document.getElementById('user-id-select');

const profileSetupView = document.getElementById('profile-setup-view');
const appContainer = document.getElementById('app-container');

const storeProfileForm = document.getElementById('store-profile-form');
const dealerProfileForm = document.getElementById('dealer-profile-form');

const profileBtn = document.getElementById('profile-btn');
const profileModalView = document.getElementById('profile-modal-view');
const closeProfileModalBtn = document.getElementById('close-profile-modal-btn');
const profileDisplayContent = document.getElementById('profile-display-content');

const reviewModalView = document.getElementById('review-modal-view');
const closeReviewModalBtn = document.getElementById('close-review-modal-btn');
const reviewForm = document.getElementById('review-form');
const reviewFormContent = document.getElementById('review-form-content');
const reviewModalTitle = document.getElementById('review-modal-title');

const cancelModalView = document.getElementById('cancel-modal-view');
const closeCancelModalBtn = document.getElementById('close-cancel-modal-btn');
const storeCancelBtn = document.getElementById('store-cancel-btn');
const dealerCancelBtn = document.getElementById('dealer-cancel-btn');

const storeView = document.getElementById('store-view');
const dealerView = document.getElementById('dealer-view');
const createJobForm = document.getElementById('create-job-form');
const myJobsList = document.getElementById('my-jobs-list');
const allJobsList = document.getElementById('all-jobs-list');
const userInfoDiv = document.getElementById('userInfo');

const addTimeSlotBtn = document.getElementById('add-time-slot-btn');
const timeSlotsContainer = document.getElementById('time-slots-container');
const jobDateInput = document.getElementById('job-date');
const jobDayOfWeekSpan = document.getElementById('job-day-of-week');
const loadProfileInfoBtn = document.getElementById('load-profile-info-btn');

const filterOpenBtn = document.getElementById('filter-open-btn');
const filterClosedBtn = document.getElementById('filter-closed-btn');

// --- Socket.IO 연결 ---
const socket = io();

socket.on('connect', () => {
    console.log('Connected to server with SID:', socket.id);
    checkLoginState();
});

socket.on('initial_data', (jobs) => { allJobsData.clear(); jobs.forEach(job => allJobsData.set(job.id, job)); renderAllViews(); });
socket.on('job_added', (newJob) => { allJobsData.set(newJob.id, newJob); renderAllViews(); });
socket.on('job_updated', (updatedJob) => { allJobsData.set(updatedJob.id, updatedJob); renderAllViews(); });

// --- 로그인 및 화면 전환 로직 ---
function checkLoginState() {
    const userId = sessionStorage.getItem('userId');
    if (userId) {
        currentUser.uid = userId;
        socket.emit('register_user', { userId });
        userInfoDiv.textContent = `현재 사용자 ID: ${currentUser.uid}`;

        currentRole = userId.startsWith('shop') ? 'store' : 'dealer';
        
        const profileJSON = localStorage.getItem(`userProfile_${userId}`);
        
        if (profileJSON) {
            userProfile = JSON.parse(profileJSON);
        }

        if (userProfile) {
            showApp(currentRole);
        } else {
            showProfileSetup(currentRole);
        }
    } else {
        showView('login-view');
    }
}

testLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const userId = userIdSelect.value;
    sessionStorage.setItem('userId', userId);
    checkLoginState();
});

function showView(viewId) {
    ['login-view', 'profile-setup-view', 'app-container'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');
}

function showProfileSetup(role) {
    showView('profile-setup-view');
    if (role === 'store') {
        storeProfileForm.classList.remove('hidden');
        dealerProfileForm.classList.add('hidden');
    } else {
        dealerProfileForm.classList.remove('hidden');
        storeProfileForm.classList.add('hidden');
        populateAreaSelects(
            document.getElementById('dealer-residence'),
            document.getElementById('dealer-preference')
        );
    }
}

storeProfileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    userProfile = {
        name: document.getElementById('store-name').value,
        address: document.getElementById('store-address').value,
        phone: document.getElementById('store-phone').value,
        email: document.getElementById('store-email').value,
        reviews: [],
        cancellationCount: 0
    };
    localStorage.setItem(`userProfile_${currentUser.uid}`, JSON.stringify(userProfile));
    showApp(currentRole);
});

dealerProfileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    userProfile = {
        name: document.getElementById('dealer-name').value,
        gender: document.getElementById('dealer-gender').value,
        age: document.getElementById('dealer-age').value,
        residence: document.getElementById('dealer-residence').value,
        preference: document.getElementById('dealer-preference').value,
        experience: document.getElementById('dealer-experience-select').value,
        experienceDetail: document.getElementById('dealer-experience-detail').value,
        phone: document.getElementById('dealer-phone').value,
        email: document.getElementById('dealer-email').value,
        workHistory: [],
        reviews: [],
        cancellationCount: 0
    };
    localStorage.setItem(`userProfile_${currentUser.uid}`, JSON.stringify(userProfile));
    showApp(currentRole);
});

function showApp(role) {
    showView('app-container');
    if (role === 'store') {
        storeView.classList.remove('hidden');
        dealerView.classList.add('hidden');
    } else {
        dealerView.classList.remove('hidden');
        storeView.classList.add('hidden');
    }
    renderAllViews();
}

// --- 프로필 모달 로직 ---
profileBtn.addEventListener('click', () => {
    showUserProfileModal(currentUser.uid);
});

closeProfileModalBtn.addEventListener('click', () => {
    profileModalView.classList.add('hidden');
});

profileDisplayContent.addEventListener('click', (e) => {
    if(e.target.classList.contains('view-profile-btn')) {
        const userId = e.target.dataset.userId;
        showUserProfileModal(userId);
    }
    if (e.target.id === 'edit-profile-btn') {
        const userId = e.target.dataset.userId;
        renderProfileEditForm(userId);
    }
    if (e.target.id === 'save-profile-btn') {
        const userId = e.target.dataset.userId;
        saveProfile(userId);
    }
});

function showUserProfileModal(userId) {
    const profileJSON = localStorage.getItem(`userProfile_${userId}`);
    if (!profileJSON) {
        alert('프로필 정보를 찾을 수 없습니다.');
        return;
    }
    const userToShowProfile = JSON.parse(profileJSON);
    const userToShowRole = userId.startsWith('shop') ? 'store' : 'dealer';
    renderProfileModal(userToShowProfile, userToShowRole, userId);
    profileModalView.classList.remove('hidden');
}

function maskPhoneNumber(phone) {
    if (typeof phone !== 'string' || phone.length < 9) return phone;
    const parts = phone.replace(/-/g, '').match(/(\d{3})(\d{3,4})(\d{4})/);
    if (!parts) return phone;
    return `${parts[1]}-****-${parts[3]}`;
}

function maskEmail(email) {
    if (typeof email !== 'string' || !email.includes('@')) return email;
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 3) return email;
    return `${localPart.substring(0, 3)}***@${domain}`;
}

function renderStars(score) {
    const fullStars = Math.floor(score);
    const emptyStars = 5 - fullStars;
    let starsHtml = '';
    for (let i = 0; i < fullStars; i++) {
        starsHtml += `<span class="text-yellow-400">&#9733;</span>`;
    }
    for (let i = 0; i < emptyStars; i++) {
        starsHtml += `<span class="text-gray-300">&#9733;</span>`;
    }
    return starsHtml;
}

function renderProfileModal(profile, role, userId) {
    let content = '';
    if (role === 'store') {
        const reviews = profile.reviews || [];
        const avgWorkIntensity = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.ratings.workIntensity, 0) / reviews.length).toFixed(1) : 'N/A';
        const avgShopKindness = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.ratings.shopKindness, 0) / reviews.length).toFixed(1) : 'N/A';
        const avgExtraWork = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.ratings.extraWork, 0) / reviews.length).toFixed(1) : 'N/A';
        
        const reviewsHtml = reviews.map(r => `<li class="p-2 bg-gray-50 rounded"><button class="text-blue-600 hover:underline view-profile-btn" data-user-id="${r.dealerId}">${r.dealerId}</button> (평점: ${((r.ratings.workIntensity + r.ratings.shopKindness + r.ratings.extraWork) / 3).toFixed(1)})<p class="text-xs text-gray-600 pl-2">- ${r.notes || '내용 없음'}</p></li>`).join('') || '<li>받은 리뷰가 없습니다.</li>';
        
        const encodedAddress = encodeURIComponent(profile.address || '');
        const naverMapUrl = `https://map.naver.com/v5/search/${encodedAddress}`;
        const kakaoMapUrl = `https://map.kakao.com/link/search/${encodedAddress}`;
        const mapLinks = profile.address ? `
            <a href="${naverMapUrl}" target="_blank" title="네이버 지도에서 보기" class="ml-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.273 12.845L7.727 4H4v16h3.727V11.155L16.273 20H20V4h-3.727v8.845z" fill="#03C75A"/></svg>
            </a>
            <a href="${kakaoMapUrl}" target="_blank" title="카카오맵에서 보기" class="ml-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#FFCD00"/></svg>
            </a>
        ` : '';

        content = `
            <div class="space-y-4">
                <div><label class="font-bold">매장 이름</label><p class="p-2 bg-gray-100 rounded mt-1">${profile.name}</p></div>
                <div><label class="font-bold">매장 주소</label><p class="p-2 bg-gray-100 rounded mt-1 flex items-center">${profile.address}${mapLinks}</p></div>
                <div><label class="font-bold">매장 전화번호</label><p class="p-2 bg-gray-100 rounded mt-1">${profile.phone}</p></div>
                <div><label class="font-bold">이메일</label><p class="p-2 bg-gray-100 rounded mt-1">${maskEmail(profile.email)}</p></div>
                <div><label class="font-bold">매장 취소 횟수</label><p class="p-2 bg-gray-100 rounded mt-1">${profile.cancellationCount || 0}회</p></div>
                <div><label class="font-bold">딜러 리뷰</label>
                    <div class="text-sm p-2 bg-gray-100 rounded mt-1 space-y-1">
                        <p>업무 강도 쉬움: <span class="inline-block align-middle">${renderStars(avgWorkIntensity)}</span> (${avgWorkIntensity})</p>
                        <p>매장 친절도: <span class="inline-block align-middle">${renderStars(avgShopKindness)}</span> (${avgShopKindness})</p>
                        <p>딜러 외 근무안함: <span class="inline-block align-middle">${renderStars(avgExtraWork)}</span> (${avgExtraWork})</p>
                    </div>
                    <ul class="space-y-1 mt-1 max-h-40 overflow-y-auto">${reviewsHtml}</ul>
                </div>
            </div>
        `;
    } else { // dealer
         const workHistoryHtml = (profile.workHistory || []).map(history => 
            `<li class="p-2 bg-gray-50 rounded">${history.date} ${history.storeName} (${history.time})</li>`
         ).join('') || '<li>근무 이력이 없습니다.</li>';
         const reviews = profile.reviews || [];
         const avgOnTime = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.ratings.onTime, 0) / reviews.length).toFixed(1) : 'N/A';
         const avgDealerKindness = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.ratings.dealerKindness, 0) / reviews.length).toFixed(1) : 'N/A';
         const reviewsHtml = reviews.map(r => `<li class="p-2 bg-gray-50 rounded"><button class="text-blue-600 hover:underline view-profile-btn" data-user-id="${r.storeId}">${r.storeId}</button> (평점: ${((r.ratings.onTime + r.ratings.dealerKindness) / 2).toFixed(1)})<p class="text-xs text-gray-600 pl-2">- ${r.notes || '내용 없음'}</p></li>`).join('') || '<li>받은 리뷰가 없습니다.</li>';

         content = `
            <div class="space-y-4">
                <div><label class="font-bold">이름</label><p class="p-2 bg-gray-100 rounded mt-1">${profile.name}</p></div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="font-bold">성별</label><p class="p-2 bg-gray-100 rounded mt-1">${profile.gender}</p></div>
                    <div><label class="font-bold">나이</label><p class="p-2 bg-gray-100 rounded mt-1">${profile.age}</p></div>
                </div>
                <div><label class="font-bold">거주지역 / 선호지역</label><p class="p-2 bg-gray-100 rounded mt-1">${profile.residence} / ${profile.preference}</p></div>
                <div><label class="font-bold">경력</label><p class="p-2 bg-gray-100 rounded mt-1">${profile.experience}</p></div>
                <div><label class="font-bold">구체 경력</label><p class="p-2 bg-gray-100 rounded mt-1 whitespace-pre-wrap">${profile.experienceDetail || '없음'}</p></div>
                <div><label class="font-bold">전화번호</label><p class="p-2 bg-gray-100 rounded mt-1">${maskPhoneNumber(profile.phone)}</p></div>
                <div><label class="font-bold">이메일</label><p class="p-2 bg-gray-100 rounded mt-1">${maskEmail(profile.email)}</p></div>
                <div><label class="font-bold">딜러 취소 횟수</label><p class="p-2 bg-gray-100 rounded mt-1">${profile.cancellationCount || 0}회</p></div>
                <div><label class="font-bold">근무 이력</label><ul class="space-y-1 mt-1 max-h-40 overflow-y-auto">${workHistoryHtml}</ul></div>
                <div><label class="font-bold">매장 리뷰</label>
                     <div class="text-sm p-2 bg-gray-100 rounded mt-1 space-y-1">
                        <p>정시 도착: <span class="inline-block align-middle">${renderStars(avgOnTime)}</span> (${avgOnTime})</p>
                        <p>딜러 친절도: <span class="inline-block align-middle">${renderStars(avgDealerKindness)}</span> (${avgDealerKindness})</p>
                    </div>
                    <ul class="space-y-1 mt-1 max-h-40 overflow-y-auto">${reviewsHtml}</ul>
                </div>
            </div>
        `;
    }
    profileDisplayContent.innerHTML = content + (userId === currentUser.uid ? `<button id="edit-profile-btn" data-user-id="${userId}" class="mt-6 w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 btn">프로필 수정</button>` : '');
}

/**
 * 프로필 수정 폼을 렌더링하는 함수
 * @param {string} userId - 수정할 사용자의 ID
 */
function renderProfileEditForm(userId) {
    const profileJSON = localStorage.getItem(`userProfile_${userId}`);
    if (!profileJSON) {
        alert('프로필 정보를 찾을 수 없습니다.');
        return;
    }
    const profile = JSON.parse(profileJSON);
    const role = userId.startsWith('shop') ? 'store' : 'dealer';

    let content = '';
    if (role === 'store') {
        content = `
            <div class="space-y-4">
                <div>
                    <label for="store-name-edit" class="font-bold">매장 이름</label>
                    <input type="text" id="store-name-edit" class="mt-1 w-full p-2 border border-gray-300 rounded-md" value="${profile.name || ''}">
                </div>
                <div>
                    <label for="store-address-edit" class="font-bold">매장 주소</label>
                    <input type="text" id="store-address-edit" class="mt-1 w-full p-2 border border-gray-300 rounded-md" value="${profile.address || ''}">
                </div>
                <div>
                    <label for="store-phone-edit" class="font-bold">매장 전화번호</label>
                    <input type="tel" id="store-phone-edit" class="mt-1 w-full p-2 border border-gray-300 rounded-md" value="${profile.phone || ''}">
                </div>
                <div>
                    <label for="store-email-edit" class="font-bold">이메일</label>
                    <input type="email" id="store-email-edit" class="mt-1 w-full p-2 border border-gray-300 rounded-md" value="${profile.email || ''}">
                </div>
                <div><label class="font-bold">매장 취소 횟수</label><p class="p-2 bg-gray-100 rounded mt-1">${profile.cancellationCount || 0}회</p></div>
            </div>
        `;
    } else { // dealer
        const areas = ["서울 강동", "서울 강북", "서울 강남", "서울 강서", "경기북부", "경기남부", "인천", "강원", "충청북도", "충청남도", "경상북도", "경상남도", "전라북도", "전라남도"];
        const residenceOptions = areas.map(area => `<option value="${area}" ${profile.residence === area ? 'selected' : ''}>${area}</option>`).join('');
        const preferenceOptions = areas.map(area => `<option value="${area}" ${profile.preference === area ? 'selected' : ''}>${area}</option>`).join('');

        const experienceLevels = ["6개월", "1년", "1년반", "2년", "2년반", "3년 이상"];
        const experienceOptions = experienceLevels.map(level => `<option value="${level}" ${profile.experience === level ? 'selected' : ''}>${level}</option>`).join('');

        content = `
            <div class="space-y-4">
                <div><label class="font-bold">이름</label><p class="p-2 bg-gray-100 rounded mt-1">${profile.name}</p></div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label for="dealer-gender-edit" class="font-bold">성별</label>
                        <select id="dealer-gender-edit" class="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                            <option value="남" ${profile.gender === '남' ? 'selected' : ''}>남</option>
                            <option value="여" ${profile.gender === '여' ? 'selected' : ''}>여</option>
                        </select>
                    </div>
                    <div>
                        <label for="dealer-age-edit" class="font-bold">나이</label>
                        <input type="number" id="dealer-age-edit" class="mt-1 w-full p-2 border border-gray-300 rounded-md" value="${profile.age || ''}">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label for="dealer-residence-edit" class="font-bold">거주 지역</label>
                        <select id="dealer-residence-edit" class="mt-1 block w-full p-2 border border-gray-300 rounded-md">${residenceOptions}</select>
                    </div>
                    <div>
                        <label for="dealer-preference-edit" class="font-bold">선호 지역</label>
                        <select id="dealer-preference-edit" class="mt-1 block w-full p-2 border border-gray-300 rounded-md">${preferenceOptions}</select>
                    </div>
                </div>
                 <div>
                    <label for="dealer-experience-edit" class="font-bold">경력</label>
                    <select id="dealer-experience-edit" class="mt-1 block w-full p-2 border border-gray-300 rounded-md">${experienceOptions}</select>
                </div>
                <div>
                    <label for="dealer-experience-detail-edit" class="font-bold">구체 경력</label>
                    <textarea id="dealer-experience-detail-edit" rows="3" class="mt-1 w-full p-2 border border-gray-300 rounded-md">${profile.experienceDetail || ''}</textarea>
                </div>
                 <div>
                    <label for="dealer-phone-edit" class="font-bold">전화번호</label>
                    <input type="tel" id="dealer-phone-edit" class="mt-1 w-full p-2 border border-gray-300 rounded-md" value="${profile.phone || ''}">
                </div>
                <div>
                    <label for="dealer-email-edit" class="font-bold">이메일</label>
                    <input type="email" id="dealer-email-edit" class="mt-1 w-full p-2 border border-gray-300 rounded-md" value="${profile.email || ''}">
                </div>
            </div>
        `;
    }

    profileDisplayContent.innerHTML = content + `<button id="save-profile-btn" data-user-id="${userId}" class="mt-6 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 btn">프로필 저장</button>`;
}

/**
 * 수정한 프로필 정보를 저장하는 함수
 * @param {string} userId - 저장할 사용자의 ID
 */
function saveProfile(userId) {
    const profileJSON = localStorage.getItem(`userProfile_${userId}`);
    if (!profileJSON) {
        alert('프로필 정보를 찾을 수 없습니다.');
        return;
    }
    const profile = JSON.parse(profileJSON);
    const role = userId.startsWith('shop') ? 'store' : 'dealer';

    if (role === 'store') {
        profile.name = document.getElementById('store-name-edit').value;
        profile.address = document.getElementById('store-address-edit').value;
        profile.phone = document.getElementById('store-phone-edit').value;
        profile.email = document.getElementById('store-email-edit').value;
    } else { // dealer
        profile.gender = document.getElementById('dealer-gender-edit').value;
        profile.age = document.getElementById('dealer-age-edit').value;
        profile.residence = document.getElementById('dealer-residence-edit').value;
        profile.preference = document.getElementById('dealer-preference-edit').value;
        profile.experience = document.getElementById('dealer-experience-edit').value;
        profile.experienceDetail = document.getElementById('dealer-experience-detail-edit').value;
        profile.phone = document.getElementById('dealer-phone-edit').value;
        profile.email = document.getElementById('dealer-email-edit').value;
    }

    localStorage.setItem(`userProfile_${userId}`, JSON.stringify(profile));
    
    // 현재 로그인한 사용자의 프로필을 수정했다면 전역 변수도 업데이트
    if (userId === currentUser.uid) {
        userProfile = profile;
    }

    alert('프로필이 성공적으로 수정되었습니다.');
    showUserProfileModal(userId); // 수정 후 다시 프로필 조회 모드로 전환
}

// --- 새 공고 양식 로직 ---
jobDateInput.addEventListener('change', (e) => {
    const selectedDate = e.target.value;
    if (selectedDate) {
        const date = new Date(selectedDate);
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const dayOfWeek = days[date.getUTCDay()]; 
        jobDayOfWeekSpan.textContent = `(${dayOfWeek})`;
    } else {
        jobDayOfWeekSpan.textContent = '';
    }
});

loadProfileInfoBtn.addEventListener('click', () => {
    if (userProfile) {
        document.getElementById('job-address').value = userProfile.address || '';
        document.getElementById('job-contact').value = userProfile.phone || '';
    }
});

function createTimeSlotElement() {
    const div = document.createElement('div');
    div.className = 'flex items-center space-x-2';
    div.innerHTML = `
        <input type="time" class="time-input w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" step="300" required>
        <input type="number" class="personnel-input w-24 text-center px-3 py-2 border border-gray-300 rounded-md shadow-sm" placeholder="인원" min="1" required>
        <button type="button" class="remove-time-slot-btn text-red-500 hover:text-red-700 font-bold text-xl">&times;</button>
    `;
    timeSlotsContainer.appendChild(div);
}

addTimeSlotBtn.addEventListener('click', createTimeSlotElement);

timeSlotsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-time-slot-btn')) {
        e.target.parentElement.remove();
    }
});

// 페이지 로드 시 기본으로 시간 입력 필드 하나 추가
createTimeSlotElement();

// --- 렌더링 함수 ---
function renderAllViews() {
    if (!currentUser.uid) return;
    if (currentRole === 'store') {
        renderMyJobs();
    } else {
        renderAllJobs();
    }
}

function renderMyJobs() {
    const myJobs = [...allJobsData.values()].filter(job => job.storeId === currentUser.uid);
    myJobs.sort((a, b) => new Date(b.date) - new Date(a.date));
    myJobsList.innerHTML = myJobs.length === 0 ? '<p class="text-gray-500">아직 등록한 공고가 없습니다.</p>' : '';
    myJobs.forEach(jobData => {
        const jobCard = document.createElement('div');
        jobCard.className = 'border p-4 rounded-lg bg-gray-50 job-card';
        
        const date = new Date(jobData.date);
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const dayOfWeek = days[date.getUTCDay()];
        const formattedDate = `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. (${dayOfWeek})`;

        const contentHtml = `
            <div class="flex justify-between items-center cursor-pointer toggle-details-btn">
                <h3 class="text-lg font-bold">${formattedDate} 공고</h3>
                <div class="flex items-center space-x-3">
                    <span class="text-xs font-bold py-1 px-3 rounded-full ${jobData.status === 'open' ? 'status-open' : 'status-closed'}">${jobData.status === 'open' ? '모집중' : '마감'}</span>
                    <span class="toggle-arrow text-2xl">&#9660;</span>
                </div>
            </div>
            <div class="job-details mt-2"></div>
        `;
        
        jobCard.innerHTML = contentHtml;
        myJobsList.appendChild(jobCard);
        
        renderJobDetails(jobCard.querySelector('.job-details'), jobData);
    });
}


function renderJobDetails(container, jobData) {
     const timeSlotsHtml = (jobData.timeSlots || []).map(slot => {
        const applicantsForSlot = (jobData.applicants || []).filter(app => app.time === slot.time);
        const applicantsHtml = applicantsForSlot.map(app => {
            const isSelected = (slot.selectedDealers || []).includes(app.dealerId);
            let actionHtml = '';

            const workStartTime = new Date(`${jobData.date}T${slot.time}`);
            const now = new Date();

            if (isSelected && now > workStartTime) {
                const reviewAvailableTime = workStartTime.getTime() + 24 * 60 * 60 * 1000;
                const isReviewable = now.getTime() > reviewAvailableTime;
                const timerId = `store-review-timer-${jobData.id}-${app.dealerId}-${slot.time.replace(':', '')}`;
                const hasReviewed = (userProfile.completedReviews || []).some(r => r.jobId === jobData.id && r.time === slot.time && r.reviewedUser === app.dealerId);

                if (hasReviewed) {
                    actionHtml = `<button class="bg-gray-400 text-white text-xs px-3 py-1 rounded-md cursor-not-allowed" disabled>리뷰완료</button>`;
                } else if (isReviewable) {
                    clearInterval(reviewTimers[timerId]);
                    actionHtml = `<button data-job-id="${jobData.id}" data-dealer-id="${app.dealerId}" data-time="${slot.time}" class="store-review-btn bg-purple-600 text-white px-3 py-1 text-sm rounded-md hover:bg-purple-700 btn">리뷰</button>`;
                } else {
                    actionHtml = `<button id="${timerId}" class="bg-gray-400 text-white text-xs px-3 py-1 rounded-md cursor-not-allowed" disabled>리뷰</button>`;
                    if (!reviewTimers[timerId]) {
                         reviewTimers[timerId] = setInterval(() => {
                            if (new Date().getTime() > reviewAvailableTime) {
                                clearInterval(reviewTimers[timerId]);
                                renderAllViews();
                            }
                        }, 1000 * 60); // 1분마다 체크
                    }
                }
            } else if (slot.status === 'open' && !isSelected) {
                const hasBeenSelectedInAnotherSlot = (jobData.timeSlots || []).some(s => (s.selectedDealers || []).includes(app.dealerId));
                if (hasBeenSelectedInAnotherSlot) {
                    actionHtml = `<button class="bg-gray-400 text-white px-3 py-1 text-sm rounded-md cursor-not-allowed" disabled>선택불가</button>`;
                } else {
                    actionHtml = `<button data-job-id="${jobData.id}" data-dealer-id="${app.dealerId}" data-time="${app.time}" class="select-dealer-btn bg-green-500 text-white px-3 py-1 text-sm rounded-md hover:bg-green-600 btn">선택</button>`;
                }
            } else if (isSelected) {
                actionHtml = `<span class="text-sm font-bold text-green-600">선택됨</span>`;
            }

            return `
            <div class="flex justify-between items-center p-2 bg-white rounded-md mt-1 border">
                <div>
                    <button class="text-sm font-medium text-blue-600 hover:underline view-profile-btn" data-user-id="${app.dealerId}">${app.dealerId}</button>
                    <p class="text-xs text-gray-500">${new Date(app.appliedAt).toLocaleString('ko-KR')}</p>
                </div>
                ${actionHtml}
            </div>`;
        }).join('') || '<p class="text-xs text-gray-500 mt-1">지원자 없음</p>';

        return `
            <div class="mt-2 pt-2 border-t">
                <h5 class="font-bold">${slot.time} (${(slot.selectedDealers || []).length}/${slot.personnel}명 모집) ${slot.status === 'closed' ? '<span class="text-red-500">(마감)</span>': ''}</h5>
                ${applicantsHtml}
            </div>
        `;
    }).join('');

    const taxText = jobData.tax === '3.3' ? '3.3%' : '없음';
    const transportText = jobData.transportFee > 0 ? `${jobData.transportFee}만원` : '없음';

    container.innerHTML = `
        <div class="text-sm text-gray-700">
            <p><strong>주소:</strong> ${jobData.address || '정보 없음'}</p>
            <p><strong>시급:</strong> ${jobData.wage ? parseInt(jobData.wage).toLocaleString() : '정보 없음'}원</p>
            <p><strong>세금:</strong> ${taxText}</p>
            <p><strong>보장 시간:</strong> ${jobData.guaranteedHours || '정보 없음'}시간</p>
            <p><strong>식사 지원:</strong> ${jobData.mealSupport || '없음'}</p>
            <p><strong>교통비:</strong> ${transportText}</p>
            <p><strong>복장:</strong> 상의(${jobData.dressCodeTop || '상관없음'}), 하의(${jobData.dressCodeBottom || '상관없음'})</p>
            <p><strong>기타:</strong> ${jobData.notes || '없음'}</p>
        </div>
        <div class="mt-4"><h4 class="font-semibold text-md">시간대별 지원자 목록</h4>${timeSlotsHtml}</div>`;
}

/**
 * ✨ 여기가 수정된 부분입니다 ✨
 * 지도 아이콘 컨테이너에 'inline-flex' 스타일을 추가하여 아이콘이 옆으로 나열되도록 했습니다.
 */
function renderAllJobs() {
    const filteredJobs = [...allJobsData.values()].filter(job => {
        if (dealerJobFilter === 'open') return job.status === 'open';
        if (dealerJobFilter === 'closed') return job.status === 'closed';
        return true;
    });

    filteredJobs.sort((a, b) => new Date(b.date) - new Date(a.date));
    allJobsList.innerHTML = filteredJobs.length === 0 ? `<p class="text-gray-500 col-span-full text-center">해당하는 공고가 없습니다.</p>` : '';
    
    filteredJobs.forEach(jobData => {
        const jobElement = document.createElement('div');
        jobElement.className = 'bg-white p-4 rounded-lg shadow-md job-card flex flex-col';
        
        const date = new Date(jobData.date);
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const dayOfWeek = days[date.getUTCDay()];
        const formattedDate = `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. (${dayOfWeek})`;

        const statusClass = jobData.status === 'open' ? 'status-open' : 'status-closed';
        const statusText = jobData.status === 'open' ? '모집중' : '마감';

        const headerHtml = `
            <div class="flex justify-between items-center cursor-pointer toggle-details-btn">
                <div>
                    <h3 class="text-lg font-bold">${formattedDate}</h3>
                    <p class="text-sm font-semibold text-gray-700">${jobData.storeId}</p>
                </div>
                <div class="flex items-center space-x-3">
                     <span class="text-xs font-bold py-1 px-2 rounded-full ${statusClass}">${statusText}</span>
                    <span class="toggle-arrow text-2xl">&#9660;</span>
                </div>
            </div>
        `;

        const taxText = jobData.tax === '3.3' ? '3.3%' : '없음';
        const transportText = jobData.transportFee > 0 ? `${jobData.transportFee}만원` : '없음';
        
        const timeSlotsWithButtonsHtml = (jobData.timeSlots || []).map(slot => {
            const applicantCount = (jobData.applicants || []).filter(app => app.time === slot.time).length;
            let buttonHtml = '';

            if (slot.status === 'closed') {
                if ((slot.selectedDealers || []).includes(currentUser.uid)) {
                    const workStartTime = new Date(`${jobData.date}T${slot.time}`);
                    const reviewAvailableTime = workStartTime.getTime() + 24 * 60 * 60 * 1000;
                    const now = new Date().getTime();
                    const isReviewable = now > reviewAvailableTime;
                    const timerId = `review-timer-${jobData.id}-${slot.time.replace(':', '')}`;
                    const hasReviewed = (userProfile.completedReviews || []).some(r => r.jobId === jobData.id && r.time === slot.time);
                    
                    let reviewButtonHtml = '';
                    if(hasReviewed) {
                        reviewButtonHtml = `<button class="bg-gray-400 text-white text-sm py-1 px-3 rounded-md cursor-not-allowed" disabled>리뷰완료</button>`;
                    } else if (isReviewable) {
                        clearInterval(reviewTimers[timerId]);
                        reviewButtonHtml = `<button data-job-id="${jobData.id}" data-time="${slot.time}" data-store-id="${jobData.storeId}" class="dealer-review-btn bg-purple-600 text-white text-sm py-1 px-3 rounded-md hover:bg-purple-700 btn">리뷰 작성</button>`;
                    } else {
                        reviewButtonHtml = `<button id="${timerId}" class="bg-gray-400 text-white text-xs py-1 px-3 rounded-md cursor-not-allowed" disabled>리뷰 (24:00:00)</button>`;
                        if (!reviewTimers[timerId]) {
                            reviewTimers[timerId] = setInterval(() => {
                                const remaining = reviewAvailableTime - new Date().getTime();
                                if (remaining <= 0) {
                                    clearInterval(reviewTimers[timerId]);
                                    renderAllViews();
                                } else {
                                    const hours = String(Math.floor(remaining / 3600000)).padStart(2, '0');
                                    const minutes = String(Math.floor((remaining % 3600000) / 60000)).padStart(2, '0');
                                    const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
                                    const timerEl = document.getElementById(timerId);
                                    if (timerEl) timerEl.textContent = `리뷰 (${hours}:${minutes}:${seconds})`;
                                }
                            }, 1000);
                        }
                    }
                    buttonHtml = `<div class="flex items-center space-x-2">
                                    <span class="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded">근무확정</span>
                                    ${reviewButtonHtml}
                                </div>`;
                } else {
                     buttonHtml = `<button class="bg-gray-500 text-white text-sm py-1 px-3 rounded-md cursor-not-allowed" disabled>마감</button>`;
                }
            } else {
                const hasAppliedToSlot = (jobData.applicants || []).some(app => app.dealerId === currentUser.uid && app.time === slot.time);
                const hasBeenSelectedInAnotherSlot = (jobData.timeSlots || []).some(s => (s.selectedDealers || []).includes(currentUser.uid));
                const applicantText = applicantCount > 0 ? ` (${applicantCount}명 지원)` : '';
                
                if (hasBeenSelectedInAnotherSlot && !hasAppliedToSlot) {
                    buttonHtml = `<button class="bg-gray-400 text-white text-sm py-1 px-3 rounded-md cursor-not-allowed" disabled>지원불가</button>`;
                } else if (hasAppliedToSlot) {
                    buttonHtml = `<button class="bg-green-500 text-white text-sm py-1 px-3 rounded-md cursor-not-allowed" disabled>지원완료${applicantText}</button>`;
                } else {
                    buttonHtml = `<button data-job-id="${jobData.id}" data-time="${slot.time}" class="apply-btn bg-blue-600 text-white text-sm py-1 px-3 rounded-md hover:bg-blue-700 btn">지원하기${applicantText}</button>`;
                }
            }
            return `
                <div class="flex justify-between items-center py-2 border-t">
                    <span class="font-semibold">${slot.time} / ${slot.personnel}명</span>
                    ${buttonHtml}
                </div>
            `;
        }).join('');

        const detailsHtml = `
            <div class="job-details mt-4">
                <div class="flex-grow">
                    <p class="font-bold text-gray-800"><button class="text-blue-600 hover:underline view-profile-btn" data-user-id="${jobData.storeId}">${jobData.storeId}</button></p>
                    <p class="text-sm text-gray-500 mb-2 flex items-center"><strong>주소:</strong>&nbsp;<span class="job-address-span">${jobData.address || '정보 없음'}</span></p>
                    <p class="text-sm text-gray-500 mb-2"><strong>시급:</strong> ${jobData.wage ? parseInt(jobData.wage).toLocaleString() : '정보 없음'}원</p>
                    <p class="text-sm text-gray-500 mb-2"><strong>세금:</strong> ${taxText}</p>
                    <p class="text-sm text-gray-500 mb-2"><strong>보장 시간:</strong> ${jobData.guaranteedHours || '정보 없음'}시간</p>
                    <p class="text-sm text-gray-500 mb-2"><strong>식사 지원:</strong> ${jobData.mealSupport || '없음'}</p>
                    <p class="text-sm text-gray-500 mb-2"><strong>교통비:</strong> ${transportText}</p>
                    <p class="text-sm text-gray-500 mb-2"><strong>복장:</strong> 상의(${jobData.dressCodeTop || '상관없음'}), 하의(${jobData.dressCodeBottom || '상관없음'})</p>
                    <p class="text-sm text-gray-600"><strong>기타:</strong> ${jobData.notes || '없음'}</p>
                </div>
                <div class="mt-4">
                    <h4 class="font-semibold text-md border-t pt-2">시간대별 지원</h4>
                    <div class="space-y-1">${timeSlotsWithButtonsHtml}</div>
                </div>
            </div>
        `;

        jobElement.innerHTML = headerHtml + detailsHtml;

        const addressSpan = jobElement.querySelector('.job-address-span');
        if(jobData.address && addressSpan){
            const encodedAddress = encodeURIComponent(jobData.address);
            const naverMapUrl = `https://map.naver.com/v5/search/${encodedAddress}`;
            const kakaoMapUrl = `https://map.kakao.com/link/search/${encodedAddress}`;
            
            const mapLinksContainer = document.createElement('span');
            // 아이콘 컨테이너에 'inline-flex' 클래스를 추가하여 가로 정렬을 보장합니다.
            mapLinksContainer.className = 'inline-flex items-center';
            mapLinksContainer.innerHTML = `
                <a href="${naverMapUrl}" target="_blank" title="네이버 지도에서 보기" class="ml-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.273 12.845L7.727 4H4v16h3.727V11.155L16.273 20H20V4h-3.727v8.845z" fill="#03C75A"/></svg>
                </a>
                <a href="${kakaoMapUrl}" target="_blank" title="카카오맵에서 보기" class="ml-1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#FFCD00"/></svg>
                </a>
            `;
            addressSpan.parentElement.appendChild(mapLinksContainer);
        }
        
        allJobsList.appendChild(jobElement);
    });
}

// --- 이벤트 핸들러 ---
createJobForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const timeSlots = [];
    const timeSlotElements = timeSlotsContainer.querySelectorAll('.flex');
    timeSlotElements.forEach(el => {
        const time = el.querySelector('.time-input').value;
        const personnel = el.querySelector('.personnel-input').value;
        if (time && personnel) {
            timeSlots.push({ time, personnel, status: 'open', selectedDealers: [] });
        }
    });

    if (timeSlots.length === 0) {
        alert('최소 하나 이상의 시간과 인원을 입력해야 합니다.');
        return;
    }

    const jobData = {
        date: document.getElementById('job-date').value,
        timeSlots: timeSlots,
        wage: document.getElementById('job-wage').value,
        tax: document.getElementById('job-tax').value,
        guaranteedHours: document.getElementById('job-guaranteed-hours').value,
        mealSupport: document.getElementById('job-meal-support').value,
        transportFee: document.getElementById('job-transport-fee').value,
        dressCodeTop: document.getElementById('job-dresscode-top').value,
        dressCodeBottom: document.getElementById('job-dresscode-bottom').value,
        address: document.getElementById('job-address').value,
        contact: document.getElementById('job-contact').value,
        notes: document.getElementById('job-notes').value,
    };
    
    socket.emit('create_job', jobData); 
    
    createJobForm.reset();
    jobDayOfWeekSpan.textContent = '';
    timeSlotsContainer.innerHTML = '';
    createTimeSlotElement();
});

allJobsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('apply-btn')) {
        const { jobId, time } = e.target.dataset;
        socket.emit('apply_for_job', { jobId, time });
    }
    if (e.target.classList.contains('dealer-review-btn')) {
        const { jobId, time, storeId } = e.target.dataset;
        openReviewModal('dealer', { jobId, time, storeId });
    }
     if (e.target.closest('.view-profile-btn')) {
        const userId = e.target.closest('.view-profile-btn').dataset.userId;
        showUserProfileModal(userId);
    }
    if (e.target.closest('.toggle-details-btn')) {
        const card = e.target.closest('.job-card');
        card.classList.toggle('collapsed');
        card.querySelector('.job-details').classList.toggle('hidden');
    }
});

myJobsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('select-dealer-btn')) {
        const { jobId, dealerId, time } = e.target.dataset;
        if (confirm(`${time} 시간대에 ${dealerId}... 님을 선택하시겠습니까?`)) {
            socket.emit('select_dealer', { jobId, dealerId, time });
        }
    }
    if (e.target.classList.contains('store-review-btn')) {
        const { jobId, time, dealerId } = e.target.dataset;
        openReviewModal('store', { jobId, time, dealerId });
    }
    if (e.target.closest('.view-profile-btn')) {
        const userId = e.target.closest('.view-profile-btn').dataset.userId;
        showUserProfileModal(userId);
    }
    if (e.target.closest('.toggle-details-btn')) {
        const card = e.target.closest('.job-card');
        card.classList.toggle('collapsed');
        card.querySelector('.job-details').classList.toggle('hidden');
    }
});
        
filterOpenBtn.addEventListener('click', () => {
    dealerJobFilter = 'open';
    filterOpenBtn.classList.replace('bg-gray-200', 'bg-blue-600');
    filterOpenBtn.classList.add('text-white');
    filterClosedBtn.classList.replace('bg-blue-600', 'bg-gray-200');
    filterClosedBtn.classList.remove('text-white');
    renderAllJobs();
});

filterClosedBtn.addEventListener('click', () => {
    dealerJobFilter = 'closed';
    filterClosedBtn.classList.replace('bg-gray-200', 'bg-blue-600');
    filterClosedBtn.classList.add('text-white');
    filterOpenBtn.classList.replace('bg-blue-600', 'bg-gray-200');
    filterOpenBtn.classList.remove('text-white');
    renderAllJobs();
});

// --- 리뷰 모달 로직 ---
let currentReviewInfo = {};
function openReviewModal(reviewerRole, reviewData) {
    currentReviewInfo = { reviewerRole, ...reviewData };
    reviewModalTitle.textContent = reviewerRole === 'dealer' ? '매장 리뷰 작성' : '딜러 리뷰 작성';
    
    let formHtml = '';
    if (reviewerRole === 'dealer') {
        formHtml = `
            ${createStarRatingHtml('workIntensity', '업무 강도 쉬움')}
            ${createStarRatingHtml('shopKindness', '매장 친절도')}
            ${createStarRatingHtml('extraWork', '딜러 외 근무안함(청소,정리)')}
            <div>
                <label for="review-notes" class="block text-sm font-medium text-gray-700">기타 사항 (선택)</label>
                <textarea id="review-notes" rows="3" class="mt-1 w-full p-2 border border-gray-300 rounded-md"></textarea>
            </div>
        `;
    } else { // store
        formHtml = `
            ${createStarRatingHtml('onTime', '정시 도착')}
            ${createStarRatingHtml('dealerKindness', '딜러 친절도')}
            <div>
                <label for="review-notes" class="block text-sm font-medium text-gray-700">기타 사항 (선택)</label>
                <textarea id="review-notes" rows="3" class="mt-1 w-full p-2 border border-gray-300 rounded-md"></textarea>
            </div>
        `;
    }
    reviewFormContent.innerHTML = formHtml;
    reviewModalView.classList.remove('hidden');
}

function createStarRatingHtml(id, label) {
    return `
        <div>
            <label class="block text-sm font-medium text-gray-700">${label}</label>
            <div class="flex space-x-1 text-3xl text-gray-300 star-rating" data-id="${id}">
                <span data-value="1" class="cursor-pointer">&#9733;</span>
                <span data-value="2" class="cursor-pointer">&#9733;</span>
                <span data-value="3" class="cursor-pointer">&#9733;</span>
                <span data-value="4" class="cursor-pointer">&#9733;</span>
                <span data-value="5" class="cursor-pointer">&#9733;</span>
            </div>
            <input type="hidden" id="rating-${id}" value="0">
        </div>
    `;
}

closeReviewModalBtn.addEventListener('click', () => {
    reviewModalView.classList.add('hidden');
});

reviewFormContent.addEventListener('click', (e) => {
    const star = e.target.closest('span[data-value]');
    if (star) {
        const container = star.parentElement;
        const rating = star.dataset.value;
        const ratingId = container.dataset.id;
        document.getElementById(`rating-${ratingId}`).value = rating;
        Array.from(container.children).forEach((s, index) => {
            s.style.color = index < rating ? '#FBBF24' : '#D1D5DB';
        });
    }
});

reviewForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    let reviewData = {};
    if (currentReviewInfo.reviewerRole === 'dealer') {
        reviewData = {
            dealerId: currentUser.uid,
            ratings: {
                workIntensity: parseInt(document.getElementById('rating-workIntensity').value),
                shopKindness: parseInt(document.getElementById('rating-shopKindness').value),
                extraWork: parseInt(document.getElementById('rating-extraWork').value),
            },
            notes: document.getElementById('review-notes').value,
        };
        const storeProfile = JSON.parse(localStorage.getItem(`userProfile_${currentReviewInfo.storeId}`)) || {reviews: []};
        if (!storeProfile.reviews) storeProfile.reviews = [];
        storeProfile.reviews.push(reviewData);
        localStorage.setItem(`userProfile_${currentReviewInfo.storeId}`, JSON.stringify(storeProfile));

        const jobData = allJobsData.get(currentReviewInfo.jobId);
        if (!userProfile.workHistory) userProfile.workHistory = [];
        userProfile.workHistory.push({
            date: jobData.date,
            storeName: currentReviewInfo.storeId,
            time: currentReviewInfo.time
        });
        if (!userProfile.completedReviews) userProfile.completedReviews = [];
        userProfile.completedReviews.push({jobId: currentReviewInfo.jobId, time: currentReviewInfo.time});
        localStorage.setItem(`userProfile_${currentUser.uid}`, JSON.stringify(userProfile));

    } else { // store
         reviewData = {
            storeId: currentUser.uid,
            ratings: {
                onTime: parseInt(document.getElementById('rating-onTime').value),
                dealerKindness: parseInt(document.getElementById('rating-dealerKindness').value),
            },
            notes: document.getElementById('review-notes').value,
        };
        const dealerProfile = JSON.parse(localStorage.getItem(`userProfile_${currentReviewInfo.dealerId}`)) || {reviews: []};
        if (!dealerProfile.reviews) dealerProfile.reviews = [];
        dealerProfile.reviews.push(reviewData);
        localStorage.setItem(`userProfile_${currentReviewInfo.dealerId}`, JSON.stringify(dealerProfile));

        if (!userProfile.completedReviews) userProfile.completedReviews = [];
        userProfile.completedReviews.push({jobId: currentReviewInfo.jobId, time: currentReviewInfo.time, reviewedUser: currentReviewInfo.dealerId});
        localStorage.setItem(`userProfile_${currentUser.uid}`, JSON.stringify(userProfile));
    }
    
    console.log('리뷰 제출:', reviewData);

    reviewForm.reset();
    reviewModalView.classList.add('hidden');
    renderAllViews();
    alert('리뷰가 제출되었습니다!');
});

/**
 * 딜러 프로필 생성 시, 지역 선택 목록을 채워주는 함수입니다.
 * @param {HTMLElement} residenceSelectEl - 거주 지역 select 요소
 * @param {HTMLElement} preferenceSelectEl - 선호 지역 select 요소
 */
function populateAreaSelects(residenceSelectEl, preferenceSelectEl) {
    const areas = ["서울 강동", "서울 강북", "서울 강남", "서울 강서", "경기북부", "경기남부", "인천", "강원", "충청북도", "충청남도", "경상북도", "경상남도", "전라북도", "전라남도"];
    
    residenceSelectEl.innerHTML = '';
    preferenceSelectEl.innerHTML = '';
    
    areas.forEach(area => {
        residenceSelectEl.innerHTML += `<option value="${area}">${area}</option>`;
        preferenceSelectEl.innerHTML += `<option value="${area}">${area}</option>`;
    });
}