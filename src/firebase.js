// ARCHIVO: src/firebase.js

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// 👇 NUEVO: Importamos el servicio de "Almacén" (Storage)
import { getStorage } from "firebase/storage";

// Tu configuración (Déjala tal cual la tienes en tu archivo original)
const firebaseConfig = {
  // ... asegúrate de que aquí están tus claves (apiKey, authDomain, etc.) ...
//Datos copiados de google cuando hemos hecho la apikey
  apiKey: "AIzaSyBssdcmkFRY1tCFGp6fThbBgDjblUb_MPI",
  authDomain: "global-events-23a23.firebaseapp.com",
  projectId: "global-events-23a23",
  storageBucket: "global-events-23a23.firebasestorage.app",
  messagingSenderId: "432956551843",
  appId: "1:432956551843:web:77cc881d5a206f84ba8516"
};

// Inicializamos la App
const app = initializeApp(firebaseConfig);

// Exportamos la Base de Datos (db) y el Almacén (storage) para usarlos fuera
export const db = getFirestore(app);
export const storage = getStorage(app);