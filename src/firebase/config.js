import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCG6jVdzY4IgJC7ckV1D3thN8YhEYcjtZU',
  authDomain: 'movies-4bb32.firebaseapp.com',
  projectId: 'movies-4bb32',
  storageBucket: 'movies-4bb32.firebasestorage.app',
  messagingSenderId: '121790488667',
  appId: '1:121790488667:web:aa95aff8b1db8158b9df7e',
}

export function isFirebaseConfigured() {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId)
}

let app
let db

export function getFirebaseApp() {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase 환경 변수가 없습니다. 프로젝트 루트에 .env 파일을 만들고 VITE_FIREBASE_* 값을 채워 주세요.',
    )
  }
  if (!app) {
    app = initializeApp(firebaseConfig)
  }
  return app
}

export function getDb() {
  if (!db) {
    getFirebaseApp()
    db = getFirestore()
  }
  return db
}
