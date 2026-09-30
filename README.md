# Sistema de mantenimiento · Xele Fitness

Aplicación web para gestionar el mantenimiento preventivo de las 8 máquinas de la sala de musculación del Gimnasio Xele Fitness. Permite reportar fallas con foto desde el celular, llevar el plan preventivo por frecuencia y calcular los indicadores de gestión (Disponibilidad, MTBF, MTTR y cumplimiento del plan).

Funciona con **Firebase** (plan gratuito Spark): Firebase Hosting publica la página con un enlace propio (`https://tu-proyecto.web.app`), Authentication controla quién entra y Firestore guarda los datos en la nube.

## Estructura de la carpeta

```
xele-mantenimiento/
├── public/                  ← lo que se publica en internet
│   ├── index.html
│   ├── css/styles.css       ← diseño
│   ├── js/app.js            ← lógica de la aplicación
│   ├── js/datos.js          ← fichas técnicas y plan de las 8 máquinas
│   ├── js/firebase-config.js← credenciales de tu proyecto (debes completarlo)
│   └── img/                 ← fotos de las máquinas (XF-EQ-01.jpg … XF-EQ-08.jpg)
├── firestore.rules          ← reglas de seguridad de la base de datos
├── firestore.indexes.json
├── firebase.json            ← configuración de Firebase Hosting
├── .firebaserc              ← ID de tu proyecto de Firebase
└── package.json             ← comandos: npm run deploy, npm run dev
```

## Requisitos

- [Visual Studio Code](https://code.visualstudio.com/)
- [Node.js](https://nodejs.org/) versión LTS (incluye `npm`)
- Una cuenta de Google

## Paso 1 · Abrir y probar en modo demostración

1. En VS Code: **Archivo > Abrir carpeta…** y elige `xele-mantenimiento`.
2. Instala la extensión recomendada **Live Server** (VS Code la sugiere al abrir la carpeta).
3. Clic derecho en `public/index.html` > **Open with Live Server**. Se abre en `http://localhost:5500`.

Mientras no completes `firebase-config.js`, la app funciona en **modo demostración**: puedes navegar, reportar fallas y marcar tareas, pero nada se guarda.

## Paso 2 · Crear el proyecto en Firebase

1. Entra a <https://console.firebase.google.com> y crea un proyecto (por ejemplo `xele-mantenimiento`). Google Analytics es opcional.
2. **Authentication** > Comenzar > pestaña *Sign-in method* > activa **Correo electrónico/contraseña**.
3. **Firestore Database** > Crear base de datos > modo **producción** > ubicación `southamerica-east1` (São Paulo, la más cercana a Perú).
4. **Configuración del proyecto** (engranaje) > General > *Tus apps* > ícono **`</>`** (Web) > registra la app (no marques Hosting todavía). Copia los valores que aparecen en `firebaseConfig` y pégalos en `public/js/firebase-config.js`.
5. Abre `.firebaserc` y cambia `"tu-proyecto"` por el **ID del proyecto** (aparece en Configuración del proyecto).

## Paso 3 · Crear usuarios y definir al dueño

1. **Authentication** > *Users* > **Agregar usuario**: crea una cuenta (correo y contraseña) para el dueño y una para cada persona del personal de sala.
2. **Firestore Database** > **Iniciar colección**:
   - ID de colección: `ajustes`
   - ID del documento: `roles`
   - Campo: `duenos`, tipo **array**, con el correo del dueño **en minúsculas** (puedes agregar más de uno, por ejemplo el tuyo como administrador).

Los usuarios cuyo correo está en `duenos` ven las opciones de administración (cambiar el estado de las fallas, registrar costos y horas de parada, ajustar horas de operación). El resto solo reporta fallas y marca tareas del plan.

## Paso 4 · Publicar desde la terminal de VS Code

Abre la terminal (**Terminal > Nueva terminal**) y ejecuta:

```bash
npm install          # instala las herramientas de Firebase (solo la primera vez)
npm run login        # abre el navegador para iniciar sesión con tu cuenta de Google
npm run deploy       # publica la página y las reglas de seguridad
```

Al terminar verás la dirección de tu sistema, por ejemplo:

```
Hosting URL: https://xele-mantenimiento.web.app
```

Ese es el enlace que compartes con el dueño y el personal. En el celular pueden usar **Agregar a pantalla de inicio** para abrirlo como una app.

Cada vez que cambies algo, guarda y vuelve a ejecutar `npm run deploy`.

## Cambios frecuentes

| Quiero… | Archivo |
|---|---|
| Cambiar una tarea del plan o un dato de la ficha | `public/js/datos.js` |
| Agregar una máquina | `public/js/datos.js` + foto `public/img/XF-EQ-09.jpg` |
| Cambiar colores o tipografía | `public/css/styles.css` (variables al inicio) |
| Agregar un dueño o administrador | Firestore > `ajustes/roles` > campo `duenos` |
| Agregar personal | Firebase > Authentication > Agregar usuario |

## Cómo se calculan los indicadores

- **Horas operativas** = horas de operación por día (Ajustes) × días transcurridos del mes.
- **Disponibilidad** = (Horas operativas − Horas de parada) / Horas operativas.
- **MTBF** = (Horas operativas − Horas de parada) / N° de fallas del mes.
- **MTTR** = Horas de parada / N° de fallas resueltas.
- **Cumplimiento del plan** = tareas realizadas en el periodo vigente / tareas programadas. Las tareas diarias se reinician cada día, las semanales cada semana, y así sucesivamente.
- Una falla marcada como *fuera de servicio* suma tiempo de parada mientras siga abierta; al resolverla se usa el valor registrado por el dueño.

## Problemas comunes

- **La página queda en blanco:** abre la consola del navegador (F12). Si dice `auth/invalid-api-key`, revisa `firebase-config.js`.
- **No puedo iniciar sesión desde Live Server:** usa `http://localhost:5500` (no `127.0.0.1`), o agrega `127.0.0.1` en Authentication > Configuración > Dominios autorizados.
- **"No tienes permiso para guardar este cambio":** ejecuta `npm run deploy` para subir `firestore.rules`, y revisa que el correo del dueño esté en `ajustes/roles` en minúsculas.
- **Límite del plan gratuito:** Spark permite 50 000 lecturas y 20 000 escrituras de Firestore por día, más que suficiente para un gimnasio.
