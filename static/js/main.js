// main.js

// --- 전역 변수 및 상태 관리 ---
let currentUser = { uid: null };
let currentRole = null;
let userProfile = null;
const allJobsData = new Map();
let reviewTimers = {};
let dealerJobFilter = 'open';
let currentReviewInfo = {};
let currentCancellationInfo = {}; // ✨ 채용 취소 정보 저장을 위한 전역 변수

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
});

// --- 로그인 및 화면 전환 로직 ---
async function checkLoginState() {
    const userId = sessionStorage.getItem('userId');
    if (userId) {
        currentUser.uid = userId;
        socket.emit('register_user', { userId });
        userInfoDiv.textContent = `현재 사용자 ID: ${currentUser.uid}`;
        currentRole = userId.startsWith('shop') ? 'store' : 'dealer';
        
        const userDocRef = db.collection("users").doc(userId);
        
        try {
            const docSnap = await userDocRef.get();
            if (docSnap.exists) {
                userProfile = docSnap.data();
                showApp(currentRole);
            } else {
                userProfile = null;
                showProfileSetup(currentRole);
            }
        } catch (error) {
            console.error("Firestore 프로필 로딩 오류:", error);
            alert("프로필 정보 로딩에 실패했습니다.");
        }
    } else {
        showView('login-view');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const userId = sessionStorage.getItem('userId');
    if (userId) {
        checkLoginState();
    } else {
        showView('login-view');
    }
});

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
        cancellationCount: 0,
        createdAt: firebase.firestore.Timestamp.now()
    };
    
    db.collection("users").doc(currentUser.uid).set(userProfile)
        .then(() => { showApp(currentRole); })
        .catch((error) => { console.error("Firestore 저장 오류: ", error); });
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
        cancellationCount: 0,
        createdAt: firebase.firestore.Timestamp.now()
    };

    db.collection("users").doc(currentUser.uid).set(userProfile)
        .then(() => { showApp(currentRole); })
        .catch((error) => { console.error("Firestore 저장 오류: ", error); });
});

let unsubscribeJobs = null; 

function showApp(role) {
    showView('app-container');
    if (role === 'store') {
        storeView.classList.remove('hidden');
        dealerView.classList.add('hidden');
    } else {
        dealerView.classList.remove('hidden');
        storeView.classList.add('hidden');
    }
    
    if (unsubscribeJobs) unsubscribeJobs();

    const jobsCollectionRef = db.collection("jobs");
    unsubscribeJobs = jobsCollectionRef.onSnapshot((querySnapshot) => {
        allJobsData.clear();
        querySnapshot.forEach((doc) => {
            allJobsData.set(doc.id, { id: doc.id, ...doc.data() });
        });
        renderAllViews();
    });
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

// --- 프로필 모달 로직 ---
profileBtn.addEventListener('click', () => {
    showUserProfileModal(currentUser.uid);
});

closeProfileModalBtn.addEventListener('click', () => {
    profileModalView.classList.add('hidden');
});

profileDisplayContent.addEventListener('click', async (e) => {
    if(e.target.classList.contains('view-profile-btn')) {
        const userId = e.target.dataset.userId;
        showUserProfileModal(userId);
    }
    if (e.target.id === 'edit-profile-btn') {
        const userId = e.target.dataset.userId;
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
            renderProfileEditForm(userId, userDoc.data());
        }
    }
    if (e.target.id === 'save-profile-btn') {
        const userId = e.target.dataset.userId;
        saveProfile(userId);
    }
});

async function showUserProfileModal(userId) {
    try {
        const docSnap = await db.collection("users").doc(userId).get();
        if (docSnap.exists) {
            const userToShowProfile = docSnap.data();
            const userToShowRole = userId.startsWith('shop') ? 'store' : 'dealer';
            renderProfileModal(userToShowProfile, userToShowRole, userId);
            profileModalView.classList.remove('hidden');
        } else {
            alert('프로필 정보를 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error("프로필 로드 오류:", error);
        alert('프로필 정보를 불러오는 데 실패했습니다.');
    }
}

function renderProfileModal(profile, role, userId) {
    // ✨ 메시지 버튼 HTML을 담을 변수
    let messageButtonHtml = '';
    
    // ✨ 현재 보는 프로필이 내 프로필이 아니고, 이메일 정보가 있을 경우에만 버튼 생성
    if (userId !== currentUser.uid && profile.email) {
        messageButtonHtml = `
            <a href="mailto:${profile.email}" class="ml-2 bg-green-500 text-white px-3 py-2 text-sm rounded-md hover:bg-green-600 btn whitespace-nowrap">
                메세지
            </a>
        `;
    }

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
                
                <!-- ✨ 수정된 이메일 표시 부분 -->
                <div>
                    <label class="font-bold">이메일</label>
                    <div class="flex items-center mt-1">
                        <p class="p-2 bg-gray-100 rounded flex-grow">${maskEmail(profile.email)}</p>
                        ${messageButtonHtml}
                    </div>
                </div>

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

                <!-- ✨ 수정된 이메일 표시 부분 -->
                <div>
                    <label class="font-bold">이메일</label>
                    <div class="flex items-center mt-1">
                        <p class="p-2 bg-gray-100 rounded flex-grow">${maskEmail(profile.email)}</p>
                        ${messageButtonHtml}
                    </div>
                </div>
                
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

function renderProfileEditForm(userId, profile) {
    const role = userId.startsWith('shop') ? 'store' : 'dealer';
    let content = '';
    if (role === 'store') {
        content = `
            <div class="space-y-4">
                <div><label for="store-name-edit" class="font-bold">매장 이름</label><input type="text" id="store-name-edit" class="mt-1 w-full p-2 border border-gray-300 rounded-md" value="${profile.name || ''}"></div>
                <div><label for="store-address-edit" class="font-bold">매장 주소</label><input type="text" id="store-address-edit" class="mt-1 w-full p-2 border border-gray-300 rounded-md" value="${profile.address || ''}"></div>
                <div><label for="store-phone-edit" class="font-bold">매장 전화번호</label><input type="tel" id="store-phone-edit" class="mt-1 w-full p-2 border border-gray-300 rounded-md" value="${profile.phone || ''}"></div>
                <div><label for="store-email-edit" class="font-bold">이메일</label><input type="email" id="store-email-edit" class="mt-1 w-full p-2 border border-gray-300 rounded-md" value="${profile.email || ''}"></div>
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
                 <div><label for="dealer-gender-edit" class="font-bold">성별</label><select id="dealer-gender-edit" class="mt-1 block w-full p-2 border border-gray-300 rounded-md"><option value="남" ${profile.gender === '남' ? 'selected' : ''}>남</option><option value="여" ${profile.gender === '여' ? 'selected' : ''}>여</option></select></div>
                <div><label for="dealer-age-edit" class="font-bold">나이</label><input type="number" id="dealer-age-edit" class="mt-1 w-full p-2 border border-gray-300 rounded-md" value="${profile.age || ''}"></div>
                <div><label for="dealer-residence-edit" class="font-bold">거주 지역</label><select id="dealer-residence-edit" class="mt-1 block w-full p-2 border border-gray-300 rounded-md">${residenceOptions}</select></div>
                <div><label for="dealer-preference-edit" class="font-bold">선호 지역</label><select id="dealer-preference-edit" class="mt-1 block w-full p-2 border border-gray-300 rounded-md">${preferenceOptions}</select></div>
                 <div><label for="dealer-experience-edit" class="font-bold">경력</label><select id="dealer-experience-edit" class="mt-1 block w-full p-2 border border-gray-300 rounded-md">${experienceOptions}</select></div>
                <div><label for="dealer-experience-detail-edit" class="font-bold">구체 경력</label><textarea id="dealer-experience-detail-edit" rows="3" class="mt-1 w-full p-2 border border-gray-300 rounded-md">${profile.experienceDetail || ''}</textarea></div>
                 <div><label for="dealer-phone-edit" class="font-bold">전화번호</label><input type="tel" id="dealer-phone-edit" class="mt-1 w-full p-2 border border-gray-300 rounded-md" value="${profile.phone || ''}"></div>
                <div><label for="dealer-email-edit" class="font-bold">이메일</label><input type="email" id="dealer-email-edit" class="mt-1 w-full p-2 border border-gray-300 rounded-md" value="${profile.email || ''}"></div>
            </div>
        `;
    }
    profileDisplayContent.innerHTML = content + `<button id="save-profile-btn" data-user-id="${userId}" class="mt-6 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 btn">프로필 저장</button>`;
}

async function saveProfile(userId) {
    const role = userId.startsWith('shop') ? 'store' : 'dealer';
    let updatedData = {};
    if (role === 'store') {
        updatedData = {
            name: document.getElementById('store-name-edit').value,
            address: document.getElementById('store-address-edit').value,
            phone: document.getElementById('store-phone-edit').value,
            email: document.getElementById('store-email-edit').value,
        };
    } else {
        updatedData = {
            gender: document.getElementById('dealer-gender-edit').value,
            age: document.getElementById('dealer-age-edit').value,
            residence: document.getElementById('dealer-residence-edit').value,
            preference: document.getElementById('dealer-preference-edit').value,
            experience: document.getElementById('dealer-experience-edit').value,
            experienceDetail: document.getElementById('dealer-experience-detail-edit').value,
            phone: document.getElementById('dealer-phone-edit').value,
            email: document.getElementById('dealer-email-edit').value,
        };
    }
    const userDocRef = db.collection("users").doc(userId);
    try {
        await userDocRef.update(updatedData);
        alert('프로필이 성공적으로 수정되었습니다.');
        if (userId === currentUser.uid) {
            userProfile = { ...userProfile, ...updatedData };
        }
        showUserProfileModal(userId);
    } catch (error) {
        console.error("프로필 업데이트 오류:", error);
        alert('프로필 수정에 실패했습니다.');
    }
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
    // 1. 화면을 다시 그리기 전, 현재 열려있는 공고 카드의 ID를 기억합니다.
    const openCardIds = new Set();
    myJobsList.querySelectorAll('.job-card').forEach(card => {
        const details = card.querySelector('.job-details');
        if (details && !details.classList.contains('hidden')) {
            const jobId = card.querySelector('.toggle-details-btn')?.dataset.jobId;
            if (jobId) openCardIds.add(jobId);
        }
    });

    // 기존 공고 목록 필터링 및 정렬
    const myJobs = [...allJobsData.values()]
        .filter(job => job.storeId === currentUser.uid)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    // 기존 공고 목록 초기화 및 새로 그리기
    myJobsList.innerHTML = myJobs.length === 0 ? '<p class="text-gray-500">아직 등록한 공고가 없습니다.</p>' : '';
    myJobs.forEach(jobData => {
        const jobCard = document.createElement('div');
        // ✨ card 자체에 'collapsed' 클래스를 적용하여 화살표 방향을 제어합니다.
        jobCard.className = 'border p-4 rounded-lg bg-gray-50 job-card';
        
        const date = jobData.date ? new Date(jobData.date) : new Date();
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const dayOfWeek = days[date.getUTCDay()];
        const formattedDate = `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. (${dayOfWeek})`;

        const contentHtml = `
            <div class="flex justify-between items-center cursor-pointer toggle-details-btn" data-job-id="${jobData.id}">
                <h3 class="text-lg font-bold">${formattedDate} 공고</h3>
                <div class="flex items-center space-x-3">
                    <span class="text-xs font-bold py-1 px-3 rounded-full ${jobData.status === 'open' ? 'status-open' : 'status-closed'}">${jobData.status === 'open' ? '모집중' : '마감'}</span>
                    <span class="toggle-arrow text-2xl">&#9660;</span>
                </div>
            </div>
            <div class="job-details mt-2 hidden"></div>
        `;
        
        jobCard.innerHTML = contentHtml;
        myJobsList.appendChild(jobCard);
    });

    // 3. 목록을 모두 그린 후, 이전에 열려있던 카드를 다시 열어줍니다.
    myJobsList.querySelectorAll('.job-card').forEach(card => {
        const jobId = card.querySelector('.toggle-details-btn')?.dataset.jobId;
        if (jobId && openCardIds.has(jobId)) {
            const details = card.querySelector('.job-details');
            const jobData = allJobsData.get(jobId);
            if (details && jobData) {
                renderJobDetails(details, jobData); // 상세 내용을 다시 렌더링
                details.classList.remove('hidden');  // 상세 내용을 보이게 함
                card.classList.add('collapsed');     // 화살표 방향 아이콘 회전
            }
        }
    });
}

function renderJobDetails(container, jobData) {
    const sortedTimeSlots = [...(jobData.timeSlots || [])].sort((a, b) => a.time.localeCompare(b.time));

    const timeSlotsHtml = sortedTimeSlots.map(slot => {
       const applicantsForSlot = (jobData.applicants || []).filter(app => app.time === slot.time);
       const applicantsHtml = applicantsForSlot.map(app => {
           const isSelected = (slot.selectedDealers || []).includes(app.dealerId);
           let actionHtml = '';

           if (isSelected) {
                // --- ✨ 수정된 부분 시작 ---

                // 리뷰 버튼 로직 (기존과 동일)
                let reviewButtonHtml = '';
                const hasReviewed = (userProfile.completedReviews || []).some(
                    review => review.jobId === jobData.id && review.time === slot.time && review.reviewedUser === app.dealerId
                );
                if (hasReviewed) {
                    reviewButtonHtml = `<button class="bg-gray-400 text-white px-2 py-1 text-xs rounded-md cursor-not-allowed" disabled>리뷰완료</button>`;
                } else {
                    const workDateTimeForReview = new Date(`${jobData.date}T${slot.time}`);
                    const nowForReview = new Date();
                    const hoursSinceWork = (nowForReview - workDateTimeForReview) / (1000 * 60 * 60);
                    const reviewPeriodStartHours = 12;
                    const reviewPeriodEndHours = 168;
                    if (hoursSinceWork >= reviewPeriodStartHours && hoursSinceWork <= reviewPeriodEndHours) {
                        reviewButtonHtml = `<button data-job-id="${jobData.id}" data-dealer-id="${app.dealerId}" data-time="${slot.time}" class="write-dealer-review-btn bg-purple-600 text-white px-2 py-1 text-xs rounded-md hover:bg-purple-700 btn">리뷰쓰기</button>`;
                    } else if (hoursSinceWork < reviewPeriodStartHours) {
                        const hoursLeft = (reviewPeriodStartHours - hoursSinceWork).toFixed(0);
                        reviewButtonHtml = `<button class="bg-gray-400 text-white px-2 py-1 text-xs rounded-md cursor-not-allowed" title="근무 종료 12시간 후부터 작성 가능합니다. (${hoursLeft}시간 남음)" disabled>리뷰쓰기</button>`;
                    } else {
                        reviewButtonHtml = `<button class="bg-gray-400 text-white px-2 py-1 text-xs rounded-md cursor-not-allowed" title="리뷰 작성 기간(7일)이 지났습니다." disabled>기간만료</button>`;
                    }
                }

                // 취소 버튼 로직 (시간 확인 기능 추가)
                let cancellationButtonHtml = '';
                const workDateTime = new Date(`${jobData.date}T${slot.time}`);
                const now = new Date();

                if (now > workDateTime) {
                    // 현재 시간이 근무 시간을 지났으면 '취소불가' 버튼 표시
                    cancellationButtonHtml = `<button class="bg-gray-400 text-white px-2 py-1 text-xs rounded-md cursor-not-allowed" disabled>취소불가</button>`;
                } else {
                    // 근무 시간 전이면 활성화된 '취소' 버튼 표시
                    cancellationButtonHtml = `<button data-job-id="${jobData.id}" data-dealer-id="${app.dealerId}" data-time="${slot.time}" class="cancel-selection-btn bg-red-500 text-white px-2 py-1 text-xs rounded-md hover:bg-red-600 btn">취소</button>`;
                }

                actionHtml = `
                    <div class="flex items-center space-x-2">
                        <span class="text-sm font-bold text-green-600">선택됨</span>
                        ${cancellationButtonHtml}
                        ${reviewButtonHtml}
                    </div>
                `;
                // --- ✨ 수정된 부분 끝 ---
           } else if (slot.status === 'open') {
               const hasBeenSelectedInAnotherSlot = (jobData.timeSlots || []).some(s => (s.selectedDealers || []).includes(app.dealerId));
               if (hasBeenSelectedInAnotherSlot) {
                   actionHtml = `<button class="bg-gray-400 text-white px-3 py-1 text-sm rounded-md cursor-not-allowed" disabled>선택불가</button>`;
               } else {
                   actionHtml = `<button data-job-id="${jobData.id}" data-dealer-id="${app.dealerId}" data-time="${app.time}" class="select-dealer-btn bg-green-500 text-white px-3 py-1 text-sm rounded-md hover:bg-green-600 btn">선택</button>`;
               }
           }
           return `
           <div class="flex justify-between items-center p-2 bg-white rounded-md mt-1 border">
               <div>
                   <button class="text-sm font-medium text-blue-600 hover:underline view-profile-btn" data-user-id="${app.dealerId}">${app.dealerId}</button>
                   <p class="text-xs text-gray-500">${app.appliedAt.toDate().toLocaleString('ko-KR')}</p>
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

function renderAllJobs() {
    const openCardIds = new Set();
    allJobsList.querySelectorAll('.job-card').forEach(card => {
        if (!card.querySelector('.job-details')?.classList.contains('hidden')) {
            openCardIds.add(card.dataset.jobId);
        }
    });

    const filteredJobs = [...allJobsData.values()].filter(job => {
        if (dealerJobFilter === 'open') return job.status === 'open';
        if (dealerJobFilter === 'closed') return job.status === 'closed';
        return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    allJobsList.innerHTML = filteredJobs.length === 0 ? `<p class="text-gray-500 col-span-full text-center">해당하는 공고가 없습니다.</p>` : '';
    
    filteredJobs.forEach(jobData => {
        const jobElement = document.createElement('div');
        jobElement.className = 'bg-white p-4 rounded-lg shadow-md job-card flex flex-col';
        jobElement.dataset.jobId = jobData.id;
        
        const date = new Date(jobData.date);
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const dayOfWeek = days[date.getUTCDay()];
        const formattedDate = `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. (${dayOfWeek})`;

        const statusClass = jobData.status === 'open' ? 'status-open' : 'status-closed';
        const statusText = jobData.status === 'open' ? '모집중' : '마감';

        const timeSlotsWithButtonsHtml = (jobData.timeSlots || []).map(slot => {
            let buttonHtml = '';
            
            if (slot.status === 'closed') {
                if ((slot.selectedDealers || []).includes(currentUser.uid)) {
                    let reviewButtonHtml = '';
                    const hasReviewed = (userProfile.completedReviews || []).some(
                        review => review.jobId === jobData.id && review.time === slot.time
                    );

                    if (hasReviewed) {
                        reviewButtonHtml = `<button class="ml-2 bg-gray-400 text-white text-xs font-bold px-2 py-1 rounded cursor-not-allowed" disabled>리뷰완료</button>`;
                    } else {
                        const workDateTime = new Date(`${jobData.date}T${slot.time}`);
                        const now = new Date();
                        const hoursSinceWork = (now - workDateTime) / (1000 * 60 * 60);

                        const reviewPeriodStartHours = 12;
                        const reviewPeriodEndHours = 168; // 7일 * 24시간

                        if (hoursSinceWork >= reviewPeriodStartHours && hoursSinceWork <= reviewPeriodEndHours) {
                            reviewButtonHtml = `<button data-job-id="${jobData.id}" data-store-id="${jobData.storeId}" data-time="${slot.time}" class="write-review-btn ml-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded hover:bg-purple-700 btn">리뷰쓰기</button>`;
                        } else if (hoursSinceWork < reviewPeriodStartHours) {
                            const hoursLeft = (reviewPeriodStartHours - hoursSinceWork).toFixed(0);
                            reviewButtonHtml = `<button class="ml-2 bg-gray-400 text-white text-xs font-bold px-2 py-1 rounded cursor-not-allowed" title="근무 종료 12시간 후부터 작성 가능합니다. (${hoursLeft}시간 남음)" disabled>리뷰쓰기</button>`;
                        } else {
                            reviewButtonHtml = `<button class="ml-2 bg-gray-400 text-white text-xs font-bold px-2 py-1 rounded cursor-not-allowed" title="리뷰 작성 기간(7일)이 지났습니다." disabled>기간만료</button>`;
                        }
                    }
                    buttonHtml = `<span class="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded">근무확정</span>${reviewButtonHtml}`;
                } else {
                     buttonHtml = `<button class="bg-gray-500 text-white text-sm py-1 px-3 rounded-md cursor-not-allowed" disabled>마감</button>`;
                }
            } else {
                const hasAppliedToSlot = (jobData.applicants || []).some(app => app.dealerId === currentUser.uid && app.time === slot.time);
                const hasBeenSelectedInAnotherSlot = (jobData.timeSlots || []).some(s => (s.selectedDealers || []).includes(currentUser.uid));
                if (hasBeenSelectedInAnotherSlot && !hasAppliedToSlot) {
                    buttonHtml = `<button class="bg-gray-400 text-white text-sm py-1 px-3 rounded-md cursor-not-allowed" disabled>지원불가</button>`;
                } else if (hasAppliedToSlot) {
                    buttonHtml = `<button class="bg-green-500 text-white text-sm py-1 px-3 rounded-md cursor-not-allowed" disabled>지원완료</button>`;
                } else {
                    buttonHtml = `<button data-job-id="${jobData.id}" data-time="${slot.time}" class="apply-btn bg-blue-600 text-white text-sm py-1 px-3 rounded-md hover:bg-blue-700 btn">지원하기</button>`;
                }
            }

            const applicantsForSlot = (jobData.applicants || []).filter(app => app.time === slot.time);
            const applicantCount = applicantsForSlot.length;
            const applicantCountText = `<span class="text-sm text-gray-600 w-20 text-right">(${applicantCount}명 지원)</span>`;

            return `
                <div class="flex justify-between items-center py-2 border-t">
                    <span class="font-semibold">${slot.time} / ${slot.personnel}명</span>
                    <div class="flex items-center space-x-2">
                         ${buttonHtml}
                         ${applicantCountText}
                    </div>
                </div>
            `;
        }).join('');

        const taxText = jobData.tax === '3.3' ? '3.3%' : '없음';
        const transportText = jobData.transportFee > 0 ? `${jobData.transportFee}만원` : '없음';

        const detailsHtml = `
            <div class="job-details mt-4 hidden">
                <div class="flex-grow text-sm text-gray-700 space-y-1">
                    <p><strong>매장:</strong> <button class="text-blue-600 hover:underline view-profile-btn" data-user-id="${jobData.storeId}">${jobData.storeId}</button></p>
                    <p><strong>주소:</strong> ${jobData.address || '정보 없음'}</p>
                    <p><strong>시급:</strong> ${jobData.wage ? parseInt(jobData.wage).toLocaleString() : '정보 없음'}원</p>
                    <p><strong>세금:</strong> ${taxText}</p>
                    <p><strong>보장 시간:</strong> ${jobData.guaranteedHours || '정보 없음'}시간</p>
                    <p><strong>식사 지원:</strong> ${jobData.mealSupport || '없음'}</p>
                    <p><strong>교통비:</strong> ${transportText}</p>
                    <p><strong>복장:</strong> 상의(${jobData.dressCodeTop || '상관없음'}), 하의(${jobData.dressCodeBottom || '상관없음'})</p>
                    <p><strong>기타:</strong> ${jobData.notes || '없음'}</p>
                </div>
                <div class="mt-4">
                    <h4 class="font-semibold text-md border-t pt-2">시간대별 지원</h4>
                    <div class="space-y-1">${timeSlotsWithButtonsHtml}</div>
                </div>
            </div>
        `;

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

        jobElement.innerHTML = headerHtml + detailsHtml;
        allJobsList.appendChild(jobElement);
    });

    allJobsList.querySelectorAll('.job-card').forEach(card => {
        if (openCardIds.has(card.dataset.jobId)) {
            card.querySelector('.job-details').classList.remove('hidden');
        }
    });
}

// --- 이벤트 핸들러 ---
createJobForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const timeSlots = [];
    timeSlotsContainer.querySelectorAll('.flex').forEach(el => {
        const time = el.querySelector('.time-input').value;
        const personnel = el.querySelector('.personnel-input').value;
        if (time && personnel) {
            timeSlots.push({ time, personnel: parseInt(personnel), status: 'open', selectedDealers: [] });
        }
    });
    if (timeSlots.length === 0) {
        alert('최소 하나 이상의 시간과 인원을 입력해야 합니다.');
        return;
    }
    const jobData = {
        storeId: currentUser.uid,
        status: 'open',
        applicants: [],
        createdAt: firebase.firestore.Timestamp.now(),
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
    db.collection("jobs").add(jobData)
        .then(docRef => console.log("새 공고 등록 성공:", docRef.id))
        .catch(error => console.error("공고 등록 실패:", error));
    createJobForm.reset();
    jobDayOfWeekSpan.textContent = '';
    timeSlotsContainer.innerHTML = '';
    createTimeSlotElement();
});

allJobsList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('view-profile-btn')) {
        const userId = e.target.dataset.userId;
        showUserProfileModal(userId);
    }
    if (e.target.classList.contains('apply-btn')) {
        const { jobId, time } = e.target.dataset;
        const jobDocRef = db.collection("jobs").doc(jobId);
        const applicantInfo = {
            dealerId: currentUser.uid,
            appliedAt: firebase.firestore.Timestamp.now(),
            time: time 
        };
        try {
            await jobDocRef.update({
                applicants: firebase.firestore.FieldValue.arrayUnion(applicantInfo)
            });
            console.log("지원 완료!");
        } catch (error) {
            console.error("지원 처리 중 오류:", error);
        }
    }
    if (e.target.classList.contains('write-review-btn')) {
        const { jobId, storeId, time } = e.target.dataset;
        openReviewModal('dealer', { jobId, storeId, time });
    }
    if (e.target.closest('.toggle-details-btn')) {
        const card = e.target.closest('.job-card');
        card.querySelector('.job-details').classList.toggle('hidden');
    }
});

myJobsList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('view-profile-btn')) {
        const userId = e.target.dataset.userId;
        showUserProfileModal(userId);
        return;
    }

    if (e.target.classList.contains('select-dealer-btn')) {
        const { jobId, dealerId, time } = e.target.dataset;
        if (!confirm(`${time} 시간대에 ${dealerId} 님을 선택하시겠습니까?`)) return;
        const jobDocRef = db.collection("jobs").doc(jobId);
        try {
            const docSnap = await jobDocRef.get();
            if (docSnap.exists) {
                const jobData = docSnap.data();
                const newTimeSlots = jobData.timeSlots.map(slot => {
                    if (slot.time === time) {
                        if (!slot.selectedDealers) slot.selectedDealers = [];
                        slot.selectedDealers.push(dealerId);
                        if (slot.selectedDealers.length >= slot.personnel) {
                            slot.status = 'closed';
                        }
                    }
                    return slot;
                });
                const allSlotsClosed = newTimeSlots.every(slot => slot.status === 'closed');
                await jobDocRef.update({
                    timeSlots: newTimeSlots,
                    status: allSlotsClosed ? 'closed' : 'open'
                });
                console.log("딜러 선택 완료!");
            }
        } catch (error) {
            console.error("딜러 선택 처리 중 오류:", error);
        }
    }
    
    // ✨ 추가된 부분: 취소 버튼 이벤트 처리
    if (e.target.classList.contains('cancel-selection-btn')) {
        const { jobId, dealerId, time } = e.target.dataset;
        openCancellationModal({ jobId, dealerId, time });
    }
    if (e.target.classList.contains('write-dealer-review-btn')) {
        const { jobId, dealerId, time } = e.target.dataset;
        // 'store'가 'dealer'를 리뷰하는 모달을 엽니다.
        openReviewModal('store', { jobId, dealerId, time });
    }

    if (e.target.closest('.toggle-details-btn')) {
        const card = e.target.closest('.job-card');
        const details = card.querySelector('.job-details');
        const isHidden = details.classList.contains('hidden');
        if (isHidden) {
            const jobId = card.querySelector('.toggle-details-btn').dataset.jobId;
            const jobData = allJobsData.get(jobId);
            if (jobData) {
                renderJobDetails(details, jobData);
            }
        }
        details.classList.toggle('hidden');
        card.classList.toggle('collapsed', !isHidden);
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

// --- 리뷰 모달 로직 (Firestore 연동 완료) ---
function openReviewModal(reviewerRole, reviewData) {
    currentReviewInfo = { reviewerRole, ...reviewData };
    reviewModalTitle.textContent = reviewerRole === 'dealer' ? '매장 리뷰 작성' : '딜러 리뷰 작성';
    let formHtml = '';
    if (reviewerRole === 'dealer') {
        formHtml = `
            ${createStarRatingHtml('workIntensity', '업무 강도 쉬움')}
            ${createStarRatingHtml('shopKindness', '매장 친절도')}
            ${createStarRatingHtml('extraWork', '딜러 외 근무안함(청소,정리)')}
        `;
    } else { // store
        formHtml = `
            ${createStarRatingHtml('onTime', '정시 도착')}
            ${createStarRatingHtml('dealerKindness', '딜러 친절도')}
        `;
    }
    reviewFormContent.innerHTML = formHtml + `
        <div>
            <label for="review-notes" class="block text-sm font-medium text-gray-700">기타 사항 (선택)</label>
            <textarea id="review-notes" rows="3" class="mt-1 w-full p-2 border border-gray-300 rounded-md"></textarea>
        </div>
    `;
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

reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let reviewData;
    let targetUserId;
    let reviewerUpdateData = {};
    let isDealerReviewing = currentReviewInfo.reviewerRole === 'dealer';

    // 1. 리뷰 데이터와 리뷰어의 업데이트 데이터 준비 (근무 이력 추가는 여기서 제외)
    if (isDealerReviewing) {
        targetUserId = currentReviewInfo.storeId; // 리뷰 대상: 매장
        reviewData = {
            dealerId: currentUser.uid,
            ratings: {
                workIntensity: parseInt(document.getElementById('rating-workIntensity').value),
                shopKindness: parseInt(document.getElementById('rating-shopKindness').value),
                extraWork: parseInt(document.getElementById('rating-extraWork').value),
            },
            notes: document.getElementById('review-notes').value,
            createdAt: firebase.firestore.Timestamp.now()
        };
        reviewerUpdateData = {
            completedReviews: firebase.firestore.FieldValue.arrayUnion({
                jobId: currentReviewInfo.jobId, 
                time: currentReviewInfo.time
            })
        };
    } else { // 매장이 리뷰할 때
        targetUserId = currentReviewInfo.dealerId; // 리뷰 대상: 딜러
        reviewData = {
            storeId: currentUser.uid,
            ratings: {
                onTime: parseInt(document.getElementById('rating-onTime').value),
                dealerKindness: parseInt(document.getElementById('rating-dealerKindness').value),
            },
            notes: document.getElementById('review-notes').value,
            createdAt: firebase.firestore.Timestamp.now()
        };
        reviewerUpdateData = {
            completedReviews: firebase.firestore.FieldValue.arrayUnion({
                jobId: currentReviewInfo.jobId, 
                time: currentReviewInfo.time, 
                reviewedUser: currentReviewInfo.dealerId
            })
        };
    }

    try {
        const reviewerDocRef = db.collection("users").doc(currentUser.uid);
        const targetUserDocRef = db.collection("users").doc(targetUserId);

        // 2. 리뷰 저장 및 리뷰어의 '리뷰완료' 상태 업데이트
        await targetUserDocRef.update({
            reviews: firebase.firestore.FieldValue.arrayUnion(reviewData)
        });
        await reviewerDocRef.update(reviewerUpdateData);

        // 3. ✨ 양측 모두 리뷰를 완료했는지 확인
        const targetUserSnap = await targetUserDocRef.get();
        const targetUserProfile = targetUserSnap.data();
        const otherPartyHasReviewed = (targetUserProfile.completedReviews || []).some(review => {
            if (isDealerReviewing) { // 내가 딜러 -> 상대방(매장)이 나에 대한 리뷰를 썼는지 확인
                return review.jobId === currentReviewInfo.jobId &&
                       review.time === currentReviewInfo.time &&
                       review.reviewedUser === currentUser.uid;
            } else { // 내가 매장 -> 상대방(딜러)이 나에 대한 리뷰를 썼는지 확인
                return review.jobId === currentReviewInfo.jobId &&
                       review.time === currentReviewInfo.time;
            }
        });

        // 4. ✨ 양측 모두 리뷰를 완료했다면, 딜러의 근무 이력에 추가
        if (otherPartyHasReviewed) {
            const dealerId = isDealerReviewing ? currentUser.uid : currentReviewInfo.dealerId;
            const storeId = isDealerReviewing ? currentReviewInfo.storeId : currentUser.uid;
            const jobData = allJobsData.get(currentReviewInfo.jobId);
            
            const workHistoryData = {
                date: jobData.date,
                storeName: storeId,
                time: currentReviewInfo.time
            };

            const dealerDocRef = db.collection("users").doc(dealerId);
            await dealerDocRef.update({
                workHistory: firebase.firestore.FieldValue.arrayUnion(workHistoryData)
            });
            console.log(`${dealerId}의 근무 이력이 추가되었습니다.`);
        }

        // 5. 로컬 프로필 데이터 갱신 및 UI 업데이트
        const updatedProfileSnap = await reviewerDocRef.get();
        if(updatedProfileSnap.exists) { userProfile = updatedProfileSnap.data(); }
        
        alert('리뷰가 성공적으로 제출되었습니다!');
        reviewForm.reset();
        reviewModalView.classList.add('hidden');
        renderAllViews(); 

    } catch (error) {
        console.error("리뷰 제출 및 근무 이력 처리 오류: ", error);
        alert("리뷰 제출에 실패했습니다.");
    }
});

// --- ✨ 채용 취소 관련 함수들 시작 ---
function openCancellationModal(info) {
    currentCancellationInfo = info;

    const existingModal = document.getElementById('cancellation-modal-view');
    if (existingModal) existingModal.remove();

    const modalHtml = `
        <div class="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md relative">
             <button id="close-cancellation-modal-btn" class="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button>
             <h2 class="text-2xl font-bold mb-6 text-center">채용 취소</h2>
             <form id="cancellation-form">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">취소 주체</label>
                        <div class="mt-2 space-y-2">
                            <div class="flex items-center">
                                <input id="cancel-by-store" name="cancellation-by" type="radio" value="store" class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300" checked>
                                <label for="cancel-by-store" class="ml-3 block text-sm font-medium text-gray-700">매장 취소</label>
                            </div>
                            <div class="flex items-center">
                                <input id="cancel-by-dealer" name="cancellation-by" type="radio" value="dealer" class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300">
                                <label for="cancel-by-dealer" class="ml-3 block text-sm font-medium text-gray-700">딜러 취소</label>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label for="cancellation-reason" class="block text-sm font-medium text-gray-700">취소 사유 (필수)</label>
                        <textarea id="cancellation-reason" rows="3" class="mt-1 w-full p-2 border border-gray-300 rounded-md" required></textarea>
                    </div>
                </div>
                <button type="submit" class="mt-4 w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 btn">취소 확정</button>
             </form>
        </div>
    `;
    
    const modalBackdrop = document.createElement('div');
    modalBackdrop.id = 'cancellation-modal-view';
    modalBackdrop.className = 'modal-backdrop flex justify-center items-center fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 z-50';
    modalBackdrop.innerHTML = modalHtml;
    
    document.body.appendChild(modalBackdrop);

    document.getElementById('close-cancellation-modal-btn').addEventListener('click', closeCancellationModal);
    document.getElementById('cancellation-form').addEventListener('submit', handleCancellationSubmit);
}

function closeCancellationModal() {
    const modal = document.getElementById('cancellation-modal-view');
    if (modal) modal.remove();
}

async function handleCancellationSubmit(e) {
    e.preventDefault();
    const reason = document.getElementById('cancellation-reason').value;
    if (!reason.trim()) {
        alert('취소 사유를 반드시 입력해야 합니다.');
        return;
    }
    const cancelledBy = document.querySelector('input[name="cancellation-by"]:checked').value;
    const { jobId, dealerId, time } = currentCancellationInfo;

    const jobDocRef = db.collection("jobs").doc(jobId);
    const cancelledById = cancelledBy === 'store' ? currentUser.uid : dealerId;
    const userToPenalizeRef = db.collection("users").doc(cancelledById);

    try {
        await db.runTransaction(async (transaction) => {
            const jobDoc = await transaction.get(jobDocRef);
            if (!jobDoc.exists) {
                throw "해당 공고를 찾을 수 없습니다.";
            }

            const jobData = jobDoc.data();
            const newTimeSlots = jobData.timeSlots.map(slot => {
                if (slot.time === time) {
                    slot.selectedDealers = (slot.selectedDealers || []).filter(id => id !== dealerId);
                    slot.status = 'open';
                }
                return slot;
            });

            transaction.update(jobDocRef, {
                timeSlots: newTimeSlots,
                status: 'open'
            });

            transaction.update(userToPenalizeRef, {
                cancellationCount: firebase.firestore.FieldValue.increment(1)
            });
        });

        alert('채용이 성공적으로 취소되었습니다.');
        closeCancellationModal();
    } catch (error) {
        console.error("채용 취소 처리 중 오류: ", error);
        alert("채용 취소에 실패했습니다. 다시 시도해주세요.");
    }
}
// --- ✨ 채용 취소 관련 함수들 끝 ---

// --- 기타 유틸리티 함수 ---
function populateAreaSelects(residenceSelectEl, preferenceSelectEl) {
    const areas = ["서울 강동", "서울 강북", "서울 강남", "서울 강서", "경기북부", "경기남부", "인천", "강원", "충청북도", "충청남도", "경상북도", "경상남도", "전라북도", "전라남도"];
    residenceSelectEl.innerHTML = '<option value="">선택</option>';
    preferenceSelectEl.innerHTML = '<option value="">선택</option>';
    areas.forEach(area => {
        residenceSelectEl.innerHTML += `<option value="${area}">${area}</option>`;
        preferenceSelectEl.innerHTML += `<option value="${area}">${area}</option>`;
    });
}
