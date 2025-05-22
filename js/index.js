
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

// Variables globales
let students = [];
let filteredStudents = [];
const itemsPerPage = 10;
let currentPage = 1;

// Elementos del DOM
const studentsList = document.getElementById('studentsList');
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const totalStudentsEl = document.getElementById('totalStudents');
const todayScansEl = document.getElementById('todayScans');
const inactiveStudentsEl = document.getElementById('inactiveStudents');
const lastUpdateEl = document.getElementById('lastUpdate');
const paginationEl = document.getElementById('pagination');

// Formatear fecha
function formatDate(timestamp) {
    if (!timestamp) return 'Nunca';
    
    const date = timestamp.toDate();
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
        return `Hoy a las ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    } else if (diffInHours < 48) {
        return `Ayer a las ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    } else {
        return date.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Obtener estudiantes de Firestore
async function fetchStudents() {
    try {
        studentsList.innerHTML = `
            <tr>
                <td colspan="3" class="loading">
                    <div class="spinner"></div>
                </td>
            </tr>
        `;
        
        const querySnapshot = await db.collection("students").orderBy("scan_count", "desc").get();
        students = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                email: data.email,
                scan_count: data.scan_count || 0,
                last_scan: data.last_scan || null,
                created_at: data.created_at || null
            };
        });
        
        updateStatistics();
        filterStudents();
        updateLastUpdateTime();
    } catch (error) {
        console.error("Error al obtener estudiantes:", error);
        studentsList.innerHTML = `
            <tr>
                <td colspan="3" class="error">
                    <i class="fas fa-exclamation-triangle"></i> Error al cargar los datos
                </td>
            </tr>
        `;
    }
}

// Actualizar estadísticas
function updateStatistics() {
    totalStudentsEl.textContent = students.length;
    
    // Contar asistencias hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayScans = students.filter(student => {
        if (!student.last_scan) return false;
        const lastScanDate = student.last_scan.toDate();
        return lastScanDate >= today;
    }).length;
    
    todayScansEl.textContent = todayScans;
    
    // Contar estudiantes inactivos (0 scans)
    const inactiveStudents = students.filter(student => student.scan_count === 0).length;
    inactiveStudentsEl.textContent = inactiveStudents;
}

// Filtrar estudiantes según búsqueda
function filterStudents() {
    const searchTerm = searchInput.value.toLowerCase();
    
    if (searchTerm === '') {
        filteredStudents = [...students];
    } else {
        filteredStudents = students.filter(student => 
            student.email.toLowerCase().includes(searchTerm)
        );
    }
    
    currentPage = 1;
    renderStudents();
    renderPagination();
}

// Renderizar lista de estudiantes
function renderStudents() {
    if (filteredStudents.length === 0) {
        studentsList.innerHTML = `
            <tr>
                <td colspan="3">No se encontraron estudiantes</td>
            </tr>
        `;
        return;
    }
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedStudents = filteredStudents.slice(start, end);
    
    studentsList.innerHTML = paginatedStudents.map(student => {
        // Obtener iniciales para el avatar
        const initials = student.email.split('@')[0]
            .split('.')
            .map(part => part.charAt(0).toUpperCase())
            .join('');
        
        // Clasificar por cantidad de asistencias
        let countClass = 'low';
        if (student.scan_count > 10) countClass = 'high';
        else if (student.scan_count > 5) countClass = 'medium';
        
        return `
            <tr>
                <td>
                    <div class="email-cell">
                        <div class="avatar">${initials}</div>
                        ${student.email}
                    </div>
                </td>
                <td class="count-cell ${countClass}">${student.scan_count}</td>
                <td class="last-scan">${formatDate(student.last_scan)}</td>
            </tr>
        `;
    }).join('');
}

// Renderizar paginación
function renderPagination() {
    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
    
    if (totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // Botón anterior
    paginationHTML += `
        <button class="page-btn" id="prevPage" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    // Páginas
    for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `
            <button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">
                ${i}
            </button>
        `;
    }
    
    // Botón siguiente
    paginationHTML += `
        <button class="page-btn" id="nextPage" ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    paginationEl.innerHTML = paginationHTML;
    
    // Event listeners para los botones de paginación
    document.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            currentPage = parseInt(btn.dataset.page);
            renderStudents();
            renderPagination();
        });
    });
    
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderStudents();
            renderPagination();
        }
    });
    
    document.getElementById('nextPage')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderStudents();
            renderPagination();
        }
    });
}

// Actualizar el tiempo de última actualización
function updateLastUpdateTime() {
    const now = new Date();
    lastUpdateEl.textContent = `Última actualización: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
}

// Event listeners
searchInput.addEventListener('input', filterStudents);
refreshBtn.addEventListener('click', fetchStudents);

// Inicializar
fetchStudents();