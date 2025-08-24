# 필요한 라이브러리들을 가져옵니다.
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import uuid
from datetime import datetime

# Flask 앱을 초기화합니다.
app = Flask(__name__)
# 보안을 위해 실제 운영 환경에서는 시크릿 키를 안전하게 관리해야 합니다.
app.config['SECRET_KEY'] = 'your-very-secret-key' 
# SocketIO를 Flask 앱에 연결합니다.
socketio = SocketIO(app)

# 데이터를 메모리에 저장하기 위한 변수입니다. 
# 실제 서비스에서는 데이터베이스(예: PostgreSQL, MySQL, MongoDB)를 사용해야 합니다.
jobs = {}
# 소켓 ID와 테스트 사용자 ID를 매핑하기 위한 딕셔너리
sid_to_user = {}

# --- Flask 라우트 ---
# 웹사이트의 기본 페이지를 렌더링합니다.
@app.route('/')
def index():
    return render_template('index.html')

# --- SocketIO 이벤트 핸들러 ---

# 클라이언트가 서버에 연결되었을 때 호출됩니다.
@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")
    # 새로운 클라이언트에게 현재 모든 공고 목록을 전송합니다.
    emit('initial_data', list(jobs.values()))

# 클라이언트 연결이 끊겼을 때 호출됩니다.
@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in sid_to_user:
        print(f"Client disconnected: {sid_to_user[request.sid]} ({request.sid})")
        del sid_to_user[request.sid]
    else:
        print(f"Client disconnected: {request.sid}")

# 사용자가 테스트 ID로 로그인할 때 호출됩니다.
@socketio.on('register_user')
def handle_register_user(data):
    user_id = data.get('userId')
    if user_id:
        sid_to_user[request.sid] = user_id
        print(f"User registered: {user_id} with SID: {request.sid}")

# '매장'이 새로운 구인 공고를 생성했을 때 호출됩니다.
@socketio.on('create_job')
def handle_create_job(data):
    user_id = sid_to_user.get(request.sid)
    if not user_id:
        print("Unregistered user tried to create a job.")
        return

    print(f"New detailed job received from {user_id}: {data}")
    
    # 시간대를 시간순으로 정렬합니다.
    time_slots = data.get('timeSlots', [])
    time_slots.sort(key=lambda x: x.get('time', ''))

    # 새로운 공고 객체를 생성합니다.
    job_id = str(uuid.uuid4()) # 고유한 ID 생성
    new_job = {
        'id': job_id,
        'storeId': user_id, # request.sid 대신 등록된 사용자 ID 사용
        'status': 'open', # 공고 전체의 상태
        'applicants': [],
        'createdAt': datetime.utcnow().isoformat() + 'Z',
        
        # 프론트엔드에서 받은 상세 정보 추가
        'date': data.get('date'),
        'timeSlots': time_slots, # 정렬된 시간대 정보
        'wage': data.get('wage'),
        'tax': data.get('tax'),
        'guaranteedHours': data.get('guaranteedHours'),
        'mealSupport': data.get('mealSupport'),
        'transportFee': data.get('transportFee'),
        'dressCodeTop': data.get('dressCodeTop'),
        'dressCodeBottom': data.get('dressCodeBottom'),
        'address': data.get('address'),
        'contact': data.get('contact'),
        'notes': data.get('notes')
    }
    
    # 메모리에 공고를 저장합니다.
    jobs[job_id] = new_job
    
    # 'job_added' 이벤트를 모든 클라이언트에게 전송하여 새 공고를 알립니다.
    emit('job_added', new_job, broadcast=True)

# '딜러'가 공고에 지원했을 때 호출됩니다.
@socketio.on('apply_for_job')
def handle_apply_for_job(data):
    user_id = sid_to_user.get(request.sid)
    if not user_id:
        print("Unregistered user tried to apply for a job.")
        return

    job_id = data.get('jobId')
    time_slot_time = data.get('time')
    job = jobs.get(job_id)
    
    if not job or job['status'] != 'open':
        return

    # 지원하려는 시간대가 마감되었는지 확인
    target_slot = next((slot for slot in job.get('timeSlots', []) if slot.get('time') == time_slot_time), None)
    if not target_slot or target_slot.get('status') == 'closed':
        print(f"Attempted to apply to a closed time slot: {time_slot_time}")
        return

    print(f"Application received for job {job_id} at {time_slot_time} from {user_id}")
    
    # 해당 시간대에 이미 지원했는지 확인
    if any(app['dealerId'] == user_id and app.get('time') == time_slot_time for app in job.get('applicants', [])):
        print(f"User {user_id} already applied for job {job_id} at {time_slot_time}")
        return

    # 지원자 정보에 시간대를 포함하여 추가
    applicant_info = {
        'dealerId': user_id,
        'appliedAt': datetime.utcnow().isoformat() + 'Z',
        'time': time_slot_time 
    }
    job['applicants'].append(applicant_info)
    
    # 'job_updated' 이벤트를 모든 클라이언트에게 전송
    emit('job_updated', job, broadcast=True)

# '매장'이 지원자 중 한 명을 선택했을 때 호출됩니다.
@socketio.on('select_dealer')
def handle_select_dealer(data):
    store_id = sid_to_user.get(request.sid)
    if not store_id:
        print("Unregistered user tried to select a dealer.")
        return

    job_id = data.get('jobId')
    dealer_id = data.get('dealerId')
    time_slot_time = data.get('time')
    job = jobs.get(job_id)

    # 공고를 올린 매장 본인만 딜러를 선택할 수 있도록 확인
    if job and job['storeId'] == store_id and job['status'] == 'open':
        
        # 해당 시간대를 찾아서 선택된 딜러 추가
        for slot in job.get('timeSlots', []):
            if slot.get('time') == time_slot_time:
                # selectedDealers 필드가 없으면 생성
                if 'selectedDealers' not in slot:
                    slot['selectedDealers'] = []

                # 이미 선택된 딜러인지, 슬롯이 열려있는지 확인
                if dealer_id not in slot.get('selectedDealers', []) and slot.get('status') == 'open':
                    slot['selectedDealers'].append(dealer_id)
                    print(f"Dealer {dealer_id} selected for time slot {time_slot_time} in job {job_id}.")

                    # 필요한 인원수와 선택된 딜러 수가 같은지 확인
                    if len(slot['selectedDealers']) >= int(slot.get('personnel', 1)):
                        slot['status'] = 'closed'
                        slot['closedAt'] = datetime.utcnow().isoformat() + 'Z' # 마감 시간 기록
                        print(f"Time slot {time_slot_time} for job {job_id} is now closed.")
                break
        
        # 모든 시간대가 마감되었는지 확인
        all_slots_closed = all(slot.get('status') == 'closed' for slot in job.get('timeSlots', []))
        if all_slots_closed:
            job['status'] = 'closed'
            print(f"All time slots for job {job_id} are closed. Job status is now closed.")

        # 'job_updated' 이벤트를 모든 클라이언트에게 전송
        emit('job_updated', job, broadcast=True)


# 이 스크립트가 직접 실행될 때 Flask 개발 서버를 시작합니다.
# if __name__ == '__main__':
#     print("Starting Flask-SocketIO server...")
#     # eventlet을 사용하여 서버를 실행합니다.
#     socketio.run(app, host='0.0.0.0', port=5000)