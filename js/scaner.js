
// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD6hQukIQlH7mbvNJMLyfPsbuSt_GQSZrw",
    authDomain: "seminario-d8721.firebaseapp.com",
    projectId: "seminario-d8721",
    storageBucket: "seminario-d8721.appspot.com",
    messagingSenderId: "318710187015",
    appId: "1:318710187015:web:e703442e858b3eed2ed6a2",
    measurementId: "G-PVMBHCX9KG"
};
// Inicializar Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Elementos del DOM
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const scanner = document.getElementById('scanner');
const resultDiv = document.getElementById('result');

// Variables para el escáner
let stream = null;
let scanning = false;
let canvasElement = document.createElement('canvas');
let canvasContext = canvasElement.getContext('2d');

// Iniciar el escáner
startButton.addEventListener('click', async () => {
    try {
        resultDiv.innerHTML = '<p>Preparando escáner...</p>';
        
        // Solicitar acceso a la cámara
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
        });
        
        scanner.srcObject = stream;
        scanner.play();
        
        startButton.disabled = true;
        stopButton.disabled = false;
        scanning = true;
        
        resultDiv.innerHTML = '<p>Escaneando código QR...</p>';
        
        // Iniciar el bucle de escaneo
        requestAnimationFrame(scanQR);
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
        resultDiv.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    }
});

// Detener el escáner
stopButton.addEventListener('click', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        scanner.srcObject = null;
    }
    
    scanning = false;
    startButton.disabled = false;
    stopButton.disabled = true;
    
    resultDiv.innerHTML = '<p>Escáner detenido. Presione "Iniciar Escáner" para continuar.</p>';
});

// Función para escanear el QR
function scanQR() {
    if (!scanning) return;
    
    if (scanner.readyState === scanner.HAVE_ENOUGH_DATA) {
        canvasElement.height = scanner.videoHeight;
        canvasElement.width = scanner.videoWidth;
        canvasContext.drawImage(scanner, 0, 0, canvasElement.width, canvasElement.height);
        
        const imageData = canvasContext.getImageData(0, 0, canvasElement.width, canvasElement.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });
        
        if (code) {
            handleScannedCode(code.data);
        } else {
            requestAnimationFrame(scanQR);
        }
    } else {
        requestAnimationFrame(scanQR);
    }
}

// Función para manejar el código escaneado
async function handleScannedCode(email) {
    // Validar que sea un email
    if (!validateEmail(email)) {
        resultDiv.innerHTML = `<p class="error">El código escaneado no es un email válido: ${email}</p>`;
        requestAnimationFrame(scanQR);
        return;
    }
    
    // Mostrar que estamos procesando
    resultDiv.innerHTML = `
        <p>Procesando asistencia para: <strong>${email}</strong></p>
        <div class="loading"></div>
    `;
    
    try {
        // Buscar al estudiante en Firestore
        const studentsRef = db.collection("students");
        const querySnapshot = await studentsRef.where("email", "==", email).get();
        
        if (querySnapshot.empty) {
            resultDiv.innerHTML = `
                <p class="error">Estudiante no encontrado: ${email}</p>
                <p>El email no está registrado en la base de datos.</p>
            `;
        } else {
            // Actualizar el registro del estudiante
            const doc = querySnapshot.docs[0];
            const studentData = doc.data();
            
            // Incrementar el contador y actualizar last_scan
            await doc.ref.update({
                scan_count: firebase.firestore.FieldValue.increment(1),
                last_scan: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Mostrar resultado exitoso
            resultDiv.innerHTML = `
                <p class="success">¡Asistencia registrada con éxito!</p>
                <div class="student-info">
                    <p><strong>Estudiante:</strong> ${email}</p>
                    <p><strong>Asistencias totales:</strong> ${studentData.scan_count + 1}</p>
                    <p><strong>Última asistencia:</strong> Ahora</p>
                </div>
            `;
        }
    } catch (error) {
        console.error("Error al actualizar la asistencia:", error);
        resultDiv.innerHTML = `
            <p class="error">Error al registrar la asistencia</p>
            <p>${error.message}</p>
        `;
    }
    
    // Esperar 3 segundos antes de volver a escanear
    setTimeout(() => {
        resultDiv.innerHTML = '<p>Escaneando código QR...</p>';
        requestAnimationFrame(scanQR);
    }, 4000);
}

// Función para validar email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Detener el escáner al cerrar la página
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});
