// 1. En https://console.firebase.google.com abre tu proyecto.
// 2. Configuración del proyecto (engranaje) > General > Tus apps > App web (</>).
// 3. Copia los valores del objeto firebaseConfig que te muestra Firebase y pégalos aquí.
// Mientras apiKey empiece con "PEGA_", la app funciona en modo demostración (no guarda datos).
// Estos valores no son secretos: la seguridad la dan las reglas de firestore.rules.
export const firebaseConfig = {
  apiKey: "PEGA_AQUI_TU_API_KEY",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000"
};
