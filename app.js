// 1. INICIALIZAR FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyCkcv1owsl4X3Vt-W-CYPP831k1SOU0gHQ",
    authDomain: "gestor-de-cobro-cc6ee.firebaseapp.com",
    projectId: "gestor-de-cobro-cc6ee",
    storageBucket: "gestor-de-cobro-cc6ee.firebasestorage.app",
    messagingSenderId: "85188432371",
    appId: "1:85188432371:web:cc76df4b14fe9023d58286"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let usuarios = [];
let todosLosClientes = []; 
let clientes = []; 
let usuarioLogueado = null;
let clienteActivo = null;
let chart;
let confirmCallback = null;

// 2. SISTEMA DE ALERTAS PERSONALIZADAS
function mostrarAlerta(mensaje, tipo = 'info') {
    const modal = document.getElementById('modalAlerta');
    const icono = document.getElementById('alertaIcono');
    const titulo = document.getElementById('alertaTitulo');
    const msj = document.getElementById('alertaMensaje');
    const boton = document.getElementById('alertaBtn');

    msj.innerText = mensaje;

    if (tipo === 'error') {
        icono.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
        icono.className = 'mx-auto w-12 h-12 flex items-center justify-center rounded-full text-2xl mb-2 bg-red-500/20 text-red-500 border border-red-500/30';
        titulo.innerText = 'Error';
        titulo.className = 'text-sm font-black text-red-400 uppercase tracking-wider';
        boton.className = 'w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl transition mt-2 text-xs';
    } else if (tipo === 'success') {
        icono.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        icono.className = 'mx-auto w-12 h-12 flex items-center justify-center rounded-full text-2xl mb-2 bg-emerald-500/20 text-emerald-500 border border-emerald-500/30';
        titulo.innerText = 'Éxito';
        titulo.className = 'text-sm font-black text-emerald-400 uppercase tracking-wider';
        boton.className = 'w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition mt-2 text-xs';
    } else {
        icono.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
        icono.className = 'mx-auto w-12 h-12 flex items-center justify-center rounded-full text-2xl mb-2 bg-blue-500/20 text-blue-500 border border-blue-500/30';
        titulo.innerText = 'Información';
        titulo.className = 'text-sm font-black text-blue-400 uppercase tracking-wider';
        boton.className = 'w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl transition mt-2 text-xs';
    }

    modal.classList.remove('hidden');
}

function cerrarAlerta() {
    document.getElementById('modalAlerta').classList.add('hidden');
}

function mostrarConfirmacion(mensaje, callback) {
    document.getElementById('confirmMensaje').innerText = mensaje;
    confirmCallback = callback;
    document.getElementById('modalConfirm').classList.remove('hidden');
}

function cerrarConfirm() {
    document.getElementById('modalConfirm').classList.add('hidden');
    confirmCallback = null;
}

function ejecutarConfirmacion() {
    if (confirmCallback) confirmCallback();
    cerrarConfirm();
}

// 3. UTILIDADES DE CÁLCULO
function obtenerEstado(fechaRaw) {
    if (!fechaRaw) return { idx: 0, nombre: 'Al Corriente', color: '#9ca3af', badge: 'bg-gray-500 text-white' }; 
    let hoy = new Date();
    hoy.setHours(0,0,0,0);
    let [y, m, d] = fechaRaw.split('-');
    let fechaPago = new Date(y, m - 1, d);
    fechaPago.setHours(0,0,0,0);
    
    let diffDias = Math.round((fechaPago - hoy) / (1000 * 60 * 60 * 24));
    
    if (diffDias > 1) return { idx: 0, nombre: 'Al Corriente', color: '#9ca3af', badge: 'bg-gray-500 text-white' };
    if (diffDias === 1) return { idx: 1, nombre: 'Próximo (Mañana)', color: '#22c55e', badge: 'bg-green-500 text-white' };
    if (diffDias === 0) return { idx: 2, nombre: 'Para Hoy', color: '#eab308', badge: 'bg-yellow-500 text-black' };
    if (diffDias >= -3 && diffDias < 0) return { idx: 3, nombre: 'Vencido', color: '#f97316', badge: 'bg-orange-500 text-white' };
    return { idx: 4, nombre: 'Alerta (Mora)', color: '#ef4444', badge: 'bg-red-500 text-white' };
}

// 4. ESCUCHAR DATOS DESDE LA NUBE
db.collection("usuarios").onSnapshot((snapshot) => {
    usuarios = [];
    snapshot.forEach((doc) => usuarios.push({ id: doc.id, ...doc.data() }));
    if (usuarios.length === 0) {
        db.collection("usuarios").add({ nombre: 'Admin Principal', user: 'admin', pass: '1234', rol: 'admin', cedula: '000-000000-0000A' });
    }
    if (usuarioLogueado && usuarioLogueado.rol === 'admin') renderUsuarios();
});

db.collection("clientes").onSnapshot((snapshot) => {
    todosLosClientes = [];
    snapshot.forEach((doc) => todosLosClientes.push({ id: doc.id, ...doc.data() }));
    procesarCarteraLocal(); 
});

function procesarCarteraLocal() {
    if (!usuarioLogueado) return;
    if (usuarioLogueado.rol === 'admin') {
        clientes = todosLosClientes; 
    } else {
        clientes = todosLosClientes.filter(c => c.creadorUser === usuarioLogueado.user);
    }
    renderClientes();
    renderScorecardList();
    initChart();
}

// 5. FUNCIONES DE SESIÓN E INTERFAZ
function entrarSistema() {
    let inputUser = document.getElementById('loginUser').value.trim();
    let inputPass = document.getElementById('loginPass').value.trim();
    
    if(usuarios.length === 0) {
        mostrarAlerta('Cargando base de datos. Da clic de nuevo en 2 segundos.', 'info');
        return;
    }

    let encontrado = usuarios.find(x => x.user === inputUser && x.pass === inputPass);
    
    if (encontrado) {
        usuarioLogueado = encontrado;
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('roleText').innerText = `Usuario: ${encontrado.nombre} (${encontrado.rol.toUpperCase()})`;
        
        if (encontrado.rol === 'analista') {
            document.getElementById('nav-personal').classList.add('hidden');
        } else {
            document.getElementById('nav-personal').classList.remove('hidden');
        }

        document.getElementById('loginUser').value = '';
        document.getElementById('loginPass').value = '';

        procesarCarteraLocal();
        if (encontrado.rol === 'admin') renderUsuarios();
        switchTab('scorecard');
    } else {
        mostrarAlerta('Credenciales incorrectas.', 'error');
    }
}

function cerrarSesion() {
    usuarioLogueado = null;
    clientes = []; 
    document.getElementById('loginScreen').classList.remove('hidden');
    switchTab('scorecard');
}

function switchTab(id) {
    if (usuarioLogueado && usuarioLogueado.rol === 'analista' && id === 'personal') {
        mostrarAlerta('Acceso restringido a este módulo.', 'error');
        return;
    }
    ['scorecard', 'clientes', 'personal', 'simulador'].forEach(t => {
        document.getElementById('tab-' + t).classList.add('hidden');
        document.getElementById('nav-' + t).classList.replace('text-blue-400', 'text-gray-400');
    });
    document.getElementById('tab-' + id).classList.remove('hidden');
    document.getElementById('nav-' + id).classList.replace('text-gray-400', 'text-blue-400');
    if (id === 'scorecard') initChart();
}

// 6. MÉTODOS DE GUARDADO (FIREBASE)
function guardarNuevoCliente(e) {
    e.preventDefault();
    const nombre = document.getElementById('cliNombre').value.trim();
    const cedula = document.getElementById('cliCedula').value.trim();
    const tel = document.getElementById('cliTel').value.trim();
    const dir = document.getElementById('cliDireccion').value.trim();
    const monto = parseFloat(document.getElementById('cliMonto').value);
    const interesDecimal = parseFloat(document.getElementById('cliInteres').value) / 100;
    const plazo = parseInt(document.getElementById('cliPlazo').value);
    
    const fechaPagoRaw = document.getElementById('cliFechaPago').value;
    const [y, m, d] = fechaPagoRaw.split('-');

    let comision = 200;
    if (monto >= 10000 && monto < 15000) comision = 400;
    else if (monto >= 15000 && monto < 25000) comision = 600;
    else if (monto >= 25000 && monto < 50000) comision = 800;
    else if (monto >= 50000) comision = 1200;

    let financiado = monto + comision;
    let totalPagar = financiado * (1 + interesDecimal);
    let cuota = totalPagar / plazo;

    db.collection("clientes").add({
        nombre: nombre,
        cedula: cedula,
        telefono: tel,
        direccion: dir,
        saldo: totalPagar,
        cuota: cuota,
        fecha1: new Date().toLocaleDateString('es-NI'),
        fecha2: `Próx. pago: ${d}/${m}/${y}`, 
        fechaPagoRaw: fechaPagoRaw,
        creadorUser: usuarioLogueado.user,     
        creadorNombre: usuarioLogueado.nombre, 
        pagado: false,
        historial: []
    }).then(() => {
        document.getElementById('formNuevoCliente').reset();
        cerrarModalNuevoCliente();
        mostrarAlerta('¡Préstamo guardado y sincronizado!', 'success');
    }).catch(err => mostrarAlerta('Error: ' + err, 'error'));
}

function aplicarAbono() {
    let m = parseFloat(document.getElementById('inputAbonoMonto').value);
    if (!m || m <= 0) return mostrarAlerta('Ingrese un monto válido mayor a cero', 'error');

    let nuevoSaldo = clienteActivo.saldo - m;
    let nuevoHistorial = [...(clienteActivo.historial || [])];
    nuevoHistorial.unshift({ fecha: new Date().toLocaleDateString('es-NI'), monto: m });

    db.collection("clientes").doc(clienteActivo.id).update({
        saldo: nuevoSaldo,
        historial: nuevoHistorial,
        pagado: (nuevoSaldo <= 0)
    }).then(() => {
        document.getElementById('inputAbonoMonto').value = '';
        mostrarAlerta(`Abono de C$ ${m.toFixed(2)} sincronizado exitosamente.`, 'success');
        clienteActivo.saldo = nuevoSaldo;
        clienteActivo.historial = nuevoHistorial;
        document.getElementById('kdSaldo').innerText = `C$ ${clienteActivo.saldo.toFixed(2)}`;
        actualizarTicketPreview(m);
        renderHistorialKardex();
    }).catch(err => mostrarAlerta('Error: ' + err, 'error'));
}

function aplicarCuotaCompleta() {
    document.getElementById('inputAbonoMonto').value = clienteActivo.cuota.toFixed(2);
    aplicarAbono();
}

function guardarUsuario(e) {
    e.preventDefault();
    db.collection("usuarios").add({
        nombre: document.getElementById('usrNombre').value.trim(),
        cedula: document.getElementById('usrCedula').value.trim(),
        user: document.getElementById('usrUser').value.trim(),
        pass: document.getElementById('usrPass').value.trim(),
        rol: document.getElementById('usrRol').value
    }).then(() => {
        mostrarAlerta('Nuevo usuario registrado en la base de datos.', 'success');
        e.target.reset();
    }).catch(err => mostrarAlerta('Error: ' + err, 'error'));
}

// 7. ACTUALIZACIONES VISUALES
function initChart() {
    let ctx = document.getElementById('scoreChart').getContext('2d');
    if (chart) chart.destroy();

    const estados = ['Al Corriente', 'Próximo', 'Para Hoy', 'Vencido', 'Mora (Alerta)'];
    const colores = ['#9ca3af', '#22c55e', '#eab308', '#f97316', '#ef4444']; 
    let montos = [0, 0, 0, 0, 0];
    let total = 0;

    clientes.forEach(c => {
        if (!c.pagado) {
            let est = obtenerEstado(c.fechaPagoRaw);
            montos[est.idx] += c.saldo;
            total += c.saldo;
        }
    });

    let dataMontos = total > 0 ? montos : [1,0,0,0,0];

    chart = new Chart(ctx, {
        type: 'pie',
        data: { labels: estados, datasets: [{ data: dataMontos, backgroundColor: colores, borderWidth: 0 }] },
        options: { plugins: { legend: { display: false } }, animation: { animateRotate: true, duration: 1200 } }
    });

    document.getElementById('scorecardHistorial').innerHTML = estados.map((estado, i) => `
        <div class="flex justify-between items-center bg-gray-900/40 p-2 rounded-lg">
            <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full" style="background-color: ${colores[i]}"></span>
                <span class="text-white text-[10px] font-bold">${estado}</span>
            </div>
            <span class="text-[10px] font-black" style="color: ${colores[i]}">C$ ${montos[i].toLocaleString('es-NI', {minimumFractionDigits:2})}</span>
        </div>
    `).join('');
    document.getElementById('totalCarteraDisplay').innerText = `C$ ${total.toLocaleString('es-NI', {minimumFractionDigits:2})}`;
}

function renderClientes() {
    let cont = document.getElementById('listaClientesContainer');
    let q = document.getElementById('searchClientInput').value.toLowerCase();
    let list = clientes.filter(c => c.nombre.toLowerCase().includes(q) || c.cedula.includes(q));

    cont.innerHTML = list.map(c => {
        let infoCreador = (usuarioLogueado.rol === 'admin' && c.creadorNombre) 
            ? ` | Asesor: ${c.creadorNombre}` 
            : '';

        return `
        <div onclick="abrirKardex('${c.id}')" class="glass-card p-3 rounded-xl flex justify-between items-center cursor-pointer hover:bg-gray-800/80 transition">
            <div>
                <h4 class="font-bold text-sm text-white">${c.nombre}</h4>
                <p class="text-[10px] text-gray-400">Cédula: ${c.cedula}${infoCreador}</p>
            </div>
            <div class="text-right">
                <span class="text-xs font-black text-blue-400 block">C$ ${c.saldo.toFixed(2)}</span>
                <span class="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">Cuota: C$ ${c.cuota.toFixed(2)}</span>
            </div>
        </div>
    `}).join('');
}

function renderScorecardList() {
    let cont = document.getElementById('scorecardClientList');
    cont.innerHTML = clientes.map(c => {
        let est = obtenerEstado(c.fechaPagoRaw);
        return `
        <div onclick="abrirKardex('${c.id}')" class="p-3 flex justify-between items-center ${c.pagado ? 'bg-emerald-900/30' : 'bg-transparent'} hover:bg-gray-800 transition cursor-pointer">
            <div class="flex flex-col">
                <strong class="text-white text-[11px] font-black tracking-wide">${c.nombre}</strong>
                <span class="text-[10px] text-gray-300 mt-1">${c.fecha1 || ''}</span>
                <span class="text-[9px] text-gray-500 italic">${c.fecha2 || ''}</span>
            </div>
            <div class="flex flex-col items-end text-right">
                <strong class="text-white text-[11px] font-black">C$ ${c.saldo.toLocaleString('es-NI', {minimumFractionDigits:2})}</strong>
                <span class="text-[10px] text-gray-300 mt-0.5">Cuota: ${c.cuota.toLocaleString('es-NI', {minimumFractionDigits:2})}</span>
                <span class="text-[9px] mt-1 px-2 py-0.5 rounded font-bold ${est.badge}">${c.pagado ? 'PAGADO' : est.nombre}</span>
            </div>
        </div>
    `}).join('');
}

function renderUsuarios() {
    let cont = document.getElementById('listaUsuariosContainer');
    cont.innerHTML = usuarios.map(u => `
        <div class="bg-gray-900/60 p-2.5 rounded-xl border border-gray-800 flex justify-between items-center">
            <div>
                <strong class="text-white block">${u.nombre}</strong>
                <span class="text-[9px] text-gray-400">User: ${u.user} | Cédula: ${u.cedula}</span>
            </div>
            <span class="text-[9px] uppercase px-2 py-0.5 rounded font-bold ${u.rol === 'admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}">${u.rol}</span>
        </div>
    `).join('');
}

function renderHistorialKardex() {
    let cont = document.getElementById('kdHistorial');
    if (!clienteActivo.historial || clienteActivo.historial.length === 0) {
        cont.innerHTML = `<span class="text-gray-500 italic">Sin movimientos registrados</span>`;
        return;
    }
    cont.innerHTML = clienteActivo.historial.map(h => {
        if (h.monto < 0) {
            return `
            <div class="flex justify-between items-center border-b border-gray-800 pb-1">
                <div>
                    <span class="text-gray-400 block">${h.fecha}</span>
                    <span class="text-[8px] text-orange-400 uppercase font-bold">${h.nota || 'Cargo'}</span>
                </div>
                <strong class="text-orange-500">+ C$ ${Math.abs(h.monto).toFixed(2)}</strong>
            </div>`;
        } else {
            return `
            <div class="flex justify-between items-center border-b border-gray-800 pb-1">
                <span class="text-gray-400">${h.fecha}</span>
                <strong class="text-emerald-400">- C$ ${h.monto.toFixed(2)}</strong>
            </div>`;
        }
    }).join('');
}

// 8. CONTROLES DE KARDEX Y SIMULADOR
function abrirKardex(id) {
    clienteActivo = clientes.find(c => c.id === id);
    if (!clienteActivo) return;

    document.getElementById('kdNombre').innerText = clienteActivo.nombre;
    document.getElementById('kdCedula').innerText = clienteActivo.cedula;
    document.getElementById('kdSaldo').innerText = `C$ ${clienteActivo.saldo.toFixed(2)}`;
    document.getElementById('kdCuotaValor').innerText = `C$ ${clienteActivo.cuota.toFixed(2)}`;
    
    document.getElementById('btnLlamar').href = `tel:${clienteActivo.telefono}`;
    document.getElementById('btnWhatsapp').href = `https://wa.me/505${clienteActivo.telefono}?text=Hola%20${encodeURIComponent(clienteActivo.nombre)},%20le%20recordamos%20su%20pago.`;
    document.getElementById('btnMapa').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clienteActivo.direccion + ', Matagalpa')}`;

    let adminActions = document.getElementById('kardexAdminActions');
    if (adminActions) {
        if (usuarioLogueado.rol === 'admin') {
            adminActions.classList.remove('hidden');
        } else {
            adminActions.classList.add('hidden');
        }
    }

    actualizarTicketPreview(0);
    renderHistorialKardex();
    document.getElementById('modalKardex').classList.remove('hidden');
}

function actualizarTicketPreview(montoAbonado) {
    let nom = clienteActivo.nombre.padEnd(23).substring(0, 23);
    let monStr = (`C$ ${montoAbonado.toFixed(2)}`).padStart(14);
    let salStr = (`C$ ${clienteActivo.saldo.toFixed(2)}`).padStart(14);
    document.getElementById('ticketPreviewBox').innerText = 
`================================
         FASTMONEY PRO       
     MATAGALPA - NICARAGUA      
================================
RECIBO PAGO:     #REC-${Date.now().toString().slice(-6)}
--------------------------------
CLIENTE: ${nom}
--------------------------------
MONTO RECIBIDO: ${monStr}
NUEVO SALDO:    ${salStr}
================================
  ¡GRACIAS POR SU PUNTUAL PAGO! `;
}

function calcularSimulacion() {
    let elMonto = document.getElementById('simMonto');
    if(!elMonto) return;
    
    const principal = parseFloat(elMonto.value) || 0;
    let comision = 200; 
    if (principal >= 10000 && principal < 15000) comision = 400;
    else if (principal >= 15000 && principal < 25000) comision = 600;
    else if (principal >= 25000 && principal < 50000) comision = 800;
    else if (principal >= 50000) comision = 1200;

    const financiado = principal + comision;
    const interesTotal = financiado * 0.30; 
    const totalPagar = financiado + interesTotal;
    const cuotaEfectiva = totalPagar / 40;  

    document.getElementById('simComision').textContent = `C$ ${comision.toFixed(2)}`;
    document.getElementById('simFinanciado').textContent = `C$ ${financiado.toLocaleString('es-NI', {minimumFractionDigits:2})}`;
    document.getElementById('simInteres').textContent = `C$ ${interesTotal.toLocaleString('es-NI', {minimumFractionDigits:2})}`;
    document.getElementById('simTotal').textContent = `C$ ${totalPagar.toLocaleString('es-NI', {minimumFractionDigits:2})}`;
    document.getElementById('simCuota').textContent = `C$ ${cuotaEfectiva.toFixed(2)}`;
}

// 9. EDICIÓN, ELIMINACIÓN Y NUEVOS CARGOS (REFINANCIAMIENTO)
function eliminarCliente() {
    mostrarConfirmacion(`¿Eliminar definitivamente a ${clienteActivo.nombre}? Esta acción borra todo su historial de cobros y no se puede deshacer.`, () => {
        db.collection("clientes").doc(clienteActivo.id).delete().then(() => {
            mostrarAlerta('Cliente eliminado del sistema.', 'success');
            cerrarKardex();
        }).catch(err => mostrarAlerta('Error al eliminar: ' + err, 'error'));
    });
}

function abrirModalEditar() {
    document.getElementById('editCliNombre').value = clienteActivo.nombre;
    document.getElementById('editCliCedula').value = clienteActivo.cedula;
    document.getElementById('editCliTel').value = clienteActivo.telefono;
    document.getElementById('editCliDireccion').value = clienteActivo.direccion;
    document.getElementById('editCliFechaPago').value = clienteActivo.fechaPagoRaw || '';
    
    cerrarKardex(); 
    document.getElementById('modalEditarCliente').classList.remove('hidden');
}

function cerrarModalEditar() {
    document.getElementById('modalEditarCliente').classList.add('hidden');
    abrirKardex(clienteActivo.id); 
}

function guardarEdicionCliente(e) {
    e.preventDefault();
    const nombre = document.getElementById('editCliNombre').value.trim();
    const cedula = document.getElementById('editCliCedula').value.trim();
    const tel = document.getElementById('editCliTel').value.trim();
    const dir = document.getElementById('editCliDireccion').value.trim();
    const fechaPagoRaw = document.getElementById('editCliFechaPago').value;
    
    let updateData = { nombre: nombre, cedula: cedula, telefono: tel, direccion: dir };

    if (fechaPagoRaw) {
        const [y, m, d] = fechaPagoRaw.split('-');
        updateData.fecha2 = `Próx. pago: ${d}/${m}/${y}`;
        updateData.fechaPagoRaw = fechaPagoRaw;
    }

    db.collection("clientes").doc(clienteActivo.id).update(updateData).then(() => {
        mostrarAlerta('Perfil actualizado correctamente.', 'success');
        document.getElementById('modalEditarCliente').classList.add('hidden');
    }).catch(err => mostrarAlerta('Error: ' + err, 'error'));
}

function abrirModalNuevoCargo() {
    document.getElementById('ncClienteNombre').innerText = clienteActivo.nombre;
    document.getElementById('ncSaldoActual').innerText = `C$ ${clienteActivo.saldo.toFixed(2)}`;
    document.getElementById('ncMonto').value = '';
    document.getElementById('ncFechaPago').value = clienteActivo.fechaPagoRaw || '';
    
    calcularNuevoCargo();
    cerrarKardex(); 
    document.getElementById('modalNuevoCargo').classList.remove('hidden');
}

function cerrarModalNuevoCargo() {
    document.getElementById('modalNuevoCargo').classList.add('hidden');
    abrirKardex(clienteActivo.id); 
}

function calcularNuevoCargo() {
    let montoAdicional = parseFloat(document.getElementById('ncMonto').value) || 0;
    let interesDecimal = parseFloat(document.getElementById('ncInteres').value) / 100 || 0.30;
    let plazo = parseInt(document.getElementById('ncPlazo').value) || 40;

    let comision = 0;
    if (montoAdicional > 0) {
        comision = 200;
        if (montoAdicional >= 10000 && montoAdicional < 15000) comision = 400;
        else if (montoAdicional >= 15000 && montoAdicional < 25000) comision = 600;
        else if (montoAdicional >= 25000 && montoAdicional < 50000) comision = 800;
        else if (montoAdicional >= 50000) comision = 1200;
    }

    let financiado = montoAdicional + comision;
    let totalAdicionalPagar = financiado * (1 + interesDecimal);
    
    let nuevoSaldoGlobal = clienteActivo.saldo + totalAdicionalPagar;
    let nuevaCuota = nuevoSaldoGlobal / plazo;

    document.getElementById('ncNuevoSaldo').innerText = `C$ ${nuevoSaldoGlobal.toLocaleString('es-NI', {minimumFractionDigits:2})}`;
    document.getElementById('ncNuevaCuota').innerText = `C$ ${nuevaCuota.toLocaleString('es-NI', {minimumFractionDigits:2})}`;
    
    return { nuevoSaldoGlobal, nuevaCuota };
}

function guardarNuevoCargo(e) {
    e.preventDefault();
    let montoAdicional = parseFloat(document.getElementById('ncMonto').value);
    if (!montoAdicional || montoAdicional <= 0) return mostrarAlerta('Ingrese un monto válido mayor a 0', 'error');

    let calcs = calcularNuevoCargo();
    const fechaPagoRaw = document.getElementById('ncFechaPago').value;
    const concepto = document.getElementById('ncConcepto').value.trim();
    const [y, m, d] = fechaPagoRaw.split('-');

    let nuevoHistorial = [...(clienteActivo.historial || [])];
    nuevoHistorial.unshift({ fecha: new Date().toLocaleDateString('es-NI'), monto: -montoAdicional, nota: concepto });

    db.collection("clientes").doc(clienteActivo.id).update({
        saldo: calcs.nuevoSaldoGlobal,
        cuota: calcs.nuevaCuota,
        fecha2: `Próx. pago: ${d}/${m}/${y}`,
        fechaPagoRaw: fechaPagoRaw,
        historial: nuevoHistorial,
        pagado: false
    }).then(() => {
        mostrarAlerta('Cargo adicional aplicado y cuota recalculada exitosamente.', 'success');
        document.getElementById('modalNuevoCargo').classList.add('hidden');
        
        clienteActivo.saldo = calcs.nuevoSaldoGlobal;
        clienteActivo.cuota = calcs.nuevaCuota;
        clienteActivo.historial = nuevoHistorial;
        if(fechaPagoRaw) clienteActivo.fechaPagoRaw = fechaPagoRaw;
        
    }).catch(err => mostrarAlerta('Error: ' + err, 'error'));
}

// 10. UTILIDADES GLOBALES
function filtrarClientes() { renderClientes(); }
function abrirModalNuevoCliente() { document.getElementById('modalNuevoCliente').classList.remove('hidden'); }
function cerrarModalNuevoCliente() { document.getElementById('modalNuevoCliente').classList.add('hidden'); }
function cerrarKardex() { document.getElementById('modalKardex').classList.add('hidden'); }
function imprimirReciboBT() {
    if (!clienteActivo) return mostrarAlerta('Seleccione un cliente primero.', 'error');
    mostrarAlerta(`Enviando ticket de ${clienteActivo.nombre} a la impresora Bluetooth PT210...`, 'info');
}

window.onload = () => {
    calcularSimulacion();
};
