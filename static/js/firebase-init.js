// static/js/firebase-init.js

// Firebase SDK에서 필요한 함수들을 가져옵니다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { 
    getFirestore, doc, setDoc, getDoc, 
    collection, addDoc, onSnapshot, updateDoc,
    arrayUnion, Timestamp 
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// 본인의 Firebase 설정 코드를 입력합니다.
const firebaseConfig = {
    apiKey: "AIzaSyDtZCbjGHbU6ZrUWd_b2Du6zuYADWuHO9k",
    authDomain: "job-platform-8f2a5.firebaseapp.com",
    projectId: "job-platform-8f2a5",
    storageBucket: "job-platform-8f2a5.appspot.com",
    messagingSenderId: "826750887139",
    appId: "1:826750887139:web:faf06c37d74023ee3d11d6",
    measurementId: "G-E5Z9MC4ZZJ"
};

// Firebase 앱과 Firestore를 초기화합니다.
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 다른 파일(main.js)에서 사용할 수 있도록 내보냅니다(export).
export {
    db,
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    onSnapshot,
    updateDoc,
    arrayUnion,
    Timestamp
};