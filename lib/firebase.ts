import { initializeApp, getApps, getApp } from "firebase/app"
import { getDatabase, ref, set, onValue, update, remove, push } from "firebase/database"

const firebaseConfig = {
  apiKey: "AIzaSyBbdvplshjdt1aV6xbejVO9X1xRB_uNlb4",
  authDomain: "speedry-c455a.firebaseapp.com",
  databaseURL: "https://speedry-c455a-default-rtdb.firebaseio.com",
  projectId: "speedry-c455a",
  storageBucket: "speedry-c455a.firebasestorage.app",
  messagingSenderId: "283673371514",
  appId: "1:283673371514:web:009e6e2707e0530163acc3",
  measurementId: "G-SR9PFNNZGY",
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
const database = getDatabase(app)

export { database, ref, set, onValue, update, remove, push }
