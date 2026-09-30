# Sistema de mantenimiento · Xele Fitness (versión web sin servidor)

Aplicación web para el mantenimiento preventivo de las 8 máquinas de la sala de musculación del Gimnasio Xele Fitness: estado de la sala, fichas técnicas, plan preventivo por frecuencia, reporte de fallas con foto e indicadores (Disponibilidad, MTBF, MTTR y cumplimiento del plan).

Esta versión no necesita base de datos: **los datos se guardan en el navegador del dispositivo** donde se usa. Es ideal para demostraciones y para usarla desde una sola computadora o celular.

## Estructura

```
xele-mantenimiento-web/
├── index.html
├── css/styles.css     ← diseño (colores al inicio del archivo)
├── js/app.js          ← lógica de la aplicación
├── js/datos.js        ← fichas técnicas y plan de las 8 máquinas
└── img/               ← fotos XF-EQ-01.jpg … XF-EQ-08.jpg
```

## Probar en tu computadora

1. Abre la carpeta en VS Code (**Archivo > Abrir carpeta…**).
2. Instala la extensión **Live Server**.
3. Clic derecho en `index.html` > **Open with Live Server**.

## Publicar en GitHub Pages desde VS Code

1. Instala Git desde <https://git-scm.com> y crea una cuenta en <https://github.com>.
2. En VS Code, ícono **Control de código fuente** (barra izquierda) > **Publicar en GitHub** > **repositorio público**.
3. En github.com, abre el repositorio > **Settings** > **Pages** > *Branch*: `main`, carpeta `/ (root)` > **Save**.
4. En 1–2 minutos queda en `https://TU-USUARIO.github.io/xele-mantenimiento-web/`.

Para actualizar: guarda los cambios, en **Control de código fuente** escribe un mensaje, pulsa **Confirmar** y luego **Sincronizar cambios**.

## Importante

- Cada dispositivo tiene sus propios datos: lo que registras en tu computadora no aparece en otro celular.
- Borrar el historial o los datos del navegador borra los registros. Usa **Exportar CSV** en Fallas para respaldarlos.
- Para que varias personas compartan los mismos datos se necesita una base de datos en la nube (por ejemplo, la versión con Firebase).
