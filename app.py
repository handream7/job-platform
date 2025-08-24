# 필요한 라이브러리들을 가져옵니다.
from flask import Flask, render_template, request
from flask_socketio import SocketIO
from flask_cors import CORS

# Flask 앱을 초기화합니다.
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-very-secret-key' 

# CORS 설정을 추가하여 모든 도메인에서의 Socket.IO 연결을 허용합니다.
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# 소켓 ID와 테스트 사용자 ID를 매핑하기 위한 딕셔너리
# 이제 공고 데이터는 여기에 저장하지 않습니다.
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

# 클라이언트 연결이 끊겼을 때 호출됩니다.
@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in sid_to_user:
        print(f"Client disconnected: {sid_to_user[request.sid]} ({request.sid})")
        del sid_to_user[request.sid]
    else:
        print(f"Client disconnected: {request.sid}")

# 사용자가 테스트 ID로 로그인할 때, 어떤 사용자가 접속했는지 서버가 알 수 있도록 등록합니다.
@socketio.on('register_user')
def handle_register_user(data):
    user_id = data.get('userId')
    if user_id:
        sid_to_user[request.sid] = user_id
        print(f"User registered: {user_id} with SID: {request.sid}")

# 이 스크립트가 직접 실행될 때 Flask 개발 서버를 시작합니다.
if __name__ == '__main__':
    print("Starting Flask-SocketIO server...")
    # Render와 같은 프로덕션 환경에서는 gunicorn을 사용하므로, 이 부분은 로컬 테스트용입니다.
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)