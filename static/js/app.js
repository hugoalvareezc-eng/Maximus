// Variable global para la corrección de Safari/Chrome al sumar/restar stock
let ultimaAccionStock = null;
// Variable para recordar la contraseña del historial temporalmente
let passwordAprobada = ""; 

// --- Ejecutar cuando el DOM esté listo ---
document.addEventListener('DOMContentLoaded', () => {

    console.log("Sistema Maximus Gym Cargado Exitosamente.");

    // --- Funcionalidad General ---
    actualizarReloj();
    setInterval(actualizarReloj, 1000); 

    // --- Lógica del Ojo Bancario (Ocultar Saldos) ---
    const btnToggleSaldos = document.getElementById('btn-toggle-saldos');
    const cifrasBancarias = document.querySelectorAll('.cifra-bancaria');
    const iconoAbierto = document.getElementById('icono-ojo-abierto');
    const iconoCerrado = document.getElementById('icono-ojo-cerrado');

    if (btnToggleSaldos && cifrasBancarias.length > 0) {
        const aplicarEstadoSaldos = (ocultar) => {
            cifrasBancarias.forEach(el => {
                if (ocultar) el.classList.add('censurado');
                else el.classList.remove('censurado');
            });
            if (ocultar) {
                iconoAbierto.style.display = 'none';
                iconoCerrado.style.display = 'block';
            } else {
                iconoAbierto.style.display = 'block';
                iconoCerrado.style.display = 'none';
            }
        };

        // Revisar la memoria (localStorage) al cargar la página
        const saldosOcultos = localStorage.getItem('saldosOcultos') === 'true';
        aplicarEstadoSaldos(saldosOcultos);

        // Al hacer clic, cambiar el estado y guardar en memoria
        btnToggleSaldos.addEventListener('click', () => {
            const estadoActual = localStorage.getItem('saldosOcultos') === 'true';
            const nuevoEstado = !estadoActual;
            localStorage.setItem('saldosOcultos', nuevoEstado);
            aplicarEstadoSaldos(nuevoEstado);
        });
    }

    // --- Configuración del Modal Global (Legacy) ---
    const backdrop = document.getElementById('modal-backdrop');
    const btnCancelarModal = document.getElementById('modal-boton-cancelar');
    if (backdrop && btnCancelarModal) {
        backdrop.addEventListener('click', () => ocultarModal());
        btnCancelarModal.addEventListener('click', () => ocultarModal());
    }

    // --- Página de Registro (index.html) ---
    if (document.querySelector('.pagina-registro')) {
        document.querySelectorAll('.btn-ingreso[data-tipo]').forEach(boton => {
            boton.addEventListener('click', manejarClicIngresoEstandar);
        });
        document.getElementById('btn-otros-pagos')?.addEventListener('click', manejarOtrosPagos);
        document.getElementById('btn-gasto-rapido')?.addEventListener('click', manejarGastoRapido);
        document.getElementById('btn-cierre-dia')?.addEventListener('click', manejarCierreDia);
    }

    // --- Página de Vencidos (vencidos.html) ---
    if (document.querySelector('.btn-procesar-pago')) { 
        document.querySelectorAll('.btn-eliminar').forEach(boton => {
            boton.addEventListener('click', manejarEliminarCliente);
        });
        document.querySelectorAll('.btn-procesar-pago').forEach(boton => {
            boton.addEventListener('click', mostrarModalPagoVencido);
        });
    }

    // --- Página de Agenda (agenda.html) ---
    const formRegistroManual = document.getElementById('form-registro-manual');
    if (formRegistroManual) {
        formRegistroManual.addEventListener('submit', manejarRegistroManual);
    }

    // Buscador en Vivo de la Agenda
    const buscadorAgenda = document.getElementById('buscador-agenda');
    if (buscadorAgenda) {
        buscadorAgenda.addEventListener('keyup', function() {
            const filtro = this.value.toLowerCase();
            const filas = document.querySelectorAll('.fila-cliente');
            
            filas.forEach(fila => {
                const nombre = fila.querySelector('.nombre-cliente').textContent.toLowerCase();
                if (nombre.includes(filtro)) {
                    fila.style.display = '';
                } else {
                    fila.style.display = 'none';
                }
            });

            document.querySelectorAll('.mes-contenedor').forEach(mes => {
                const filasVisibles = mes.querySelectorAll('.fila-cliente:not([style*="display: none"])');
                if (filasVisibles.length === 0) {
                    mes.style.display = 'none';
                } else {
                    mes.style.display = '';
                }
            });
        });
    }

    // Delegación de Eventos para el Botón de Editar en la Agenda
    document.body.addEventListener('click', async function(e) {
        if (e.target.classList.contains('btn-editar-agenda')) {
            const id = e.target.getAttribute('data-id');
            const nombreActual = e.target.getAttribute('data-nombre');
            const fechaActual = e.target.getAttribute('data-fecha');
            const telActual = e.target.getAttribute('data-telefono') || '';

            const { value: formValues } = await Swal.fire({
                title: 'Editar Cliente',
                html: `
                    <div style="text-align: left; margin-top: 15px; display: flex; flex-direction: column; gap: 15px;">
                        <div>
                            <label style="color: var(--color-texto-secundario); font-weight: bold; font-size: 0.9em;">Nombre Completo:</label>
                            <input id="swal-edit-nombre" class="swal2-input" value="${nombreActual}" style="width: 90%; margin: 5px auto 0; display: block;">
                        </div>
                        <div>
                            <label style="color: var(--color-texto-secundario); font-weight: bold; font-size: 0.9em;">Fecha de Vencimiento:</label>
                            <input id="swal-edit-fecha" type="date" class="swal2-input" value="${fechaActual}" style="width: 90%; margin: 5px auto 0; display: block;">
                        </div>
                        <div>
                            <label style="color: var(--color-texto-secundario); font-weight: bold; font-size: 0.9em;">WhatsApp (10 dígitos):</label>
                            <input id="swal-edit-telefono" type="tel" class="swal2-input" value="${telActual}" placeholder="Ej: 7721234567" 
                                maxlength="10" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10);" 
                                style="width: 90%; margin: 5px auto 0; display: block; border-color: #2980b9;">
                        </div>
                    </div>
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Guardar Cambios',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#2980b9',
                preConfirm: () => {
                    const n = document.getElementById('swal-edit-nombre').value.trim();
                    const f = document.getElementById('swal-edit-fecha').value;
                    const t = document.getElementById('swal-edit-telefono').value.trim();
                    
                    if (!n || !f) {
                        Swal.showValidationMessage('El nombre y la fecha son obligatorios');
                        return false;
                    }
                    if (t.length > 0 && t.length !== 10) {
                        Swal.showValidationMessage('El número de teléfono debe tener exactamente 10 dígitos numéricos');
                        return false;
                    }
                    return { id: id, nombre: n, fecha: f, telefono: t };
                }
            });

            if (formValues) {
                const respuesta = await postData('/api/editar_cliente', formValues);
                if (respuesta.exito) {
                    await Swal.fire({ 
                        title: '¡Actualizado!', 
                        text: respuesta.mensaje, 
                        icon: 'success', 
                        timer: 1500, 
                        showConfirmButton: false,
                        background: 'var(--color-fondo-secundario)',
                        color: 'var(--color-texto-principal)'
                    });
                    location.reload();
                } else {
                    msjError(respuesta.error || 'Hubo un problema al actualizar.');
                }
            }
        }
    });

    // --- Página de Inventario (inventario.html) ---
    if (document.querySelector('.pagina-inventario')) {
        const btnDesbloquearInv = document.getElementById('btn-desbloquear-inv');
        const panelBloqueadoInv = document.getElementById('panel-bloqueado-inv');
        const panelInventario = document.getElementById('panel-inventario');

        if (btnDesbloquearInv) {
            btnDesbloquearInv.addEventListener('click', async () => {
                const { value: pass } = await Swal.fire({
                    title: 'Acceso Restringido',
                    input: 'password',
                    inputLabel: 'Contraseña de administrador:',
                    inputPlaceholder: 'Contraseña',
                    showCancelButton: true,
                    confirmButtonText: 'Entrar',
                    confirmButtonColor: '#2980b9'
                });

                if (pass) {
                    const respuesta = await postData('/api/verificar_password', { password: pass });
                    if (respuesta.exito) {
                        panelBloqueadoInv.style.display = 'none';
                        panelInventario.style.display = 'block';
                        msjExito("Acceso concedido");
                    } else {
                        msjError(respuesta.error);
                    }
                }
            });
        }

        if (document.getElementById('form-ajustar-stock')) {
            document.getElementById('form-ajustar-stock').addEventListener('submit', manejarAjusteStock);
            document.querySelectorAll('#form-ajustar-stock button[type="submit"]').forEach(button => {
                button.addEventListener('click', (e) => {
                    ultimaAccionStock = e.currentTarget.dataset.accion;
                });
            });
        }
    }
        
    // --- Página de Deudores (deudores.html) ---
    if (document.querySelector('.pagina-deudores')) {
        document.getElementById('btn-mostrar-modal-deuda')?.addEventListener('click', () => {
            mostrarModalAgregarDeuda(''); 
        });
        document.querySelectorAll('.btn-anadir-deuda').forEach(boton => {
            boton.addEventListener('click', (e) => {
                const nombre = e.currentTarget.dataset.nombre;
                mostrarModalAgregarDeuda(nombre);
            });
        });
        document.querySelectorAll('.btn-pagar-deuda').forEach(boton => {
            boton.addEventListener('click', mostrarModalPagarDeuda);
        });
        document.querySelectorAll('.btn-pagar-deuda-total').forEach(boton => {
            boton.addEventListener('click', mostrarModalPagarDeudaTotal);
        });
    }

    // --- Página de Historial (historial.html) ---
    const btnDesbloquear = document.getElementById('btn-desbloquear');
    const panelBloqueado = document.getElementById('panel-bloqueado');
    const panelHistorial = document.getElementById('panel-historial');
    
    if (btnDesbloquear) {
        btnDesbloquear.addEventListener('click', async () => {
            const { value: pass } = await Swal.fire({
                title: 'Acceso Restringido',
                input: 'password',
                inputLabel: 'Ingrese la contraseña de administrador:',
                inputPlaceholder: 'Contraseña',
                showCancelButton: true,
                confirmButtonText: 'Entrar',
                confirmButtonColor: '#2980b9'
            });

            if (pass) {
                const hoy = new Date().toISOString().split('T')[0];
                const respuesta = await postData('/api/obtener_historial', { 
                    password: pass, fecha_inicio: hoy, fecha_fin: hoy 
                });

                if (respuesta.exito) {
                    passwordAprobada = pass; 
                    panelBloqueado.style.display = 'none';
                    panelHistorial.style.display = 'block';
                    msjExito("Acceso concedido");
                    document.getElementById('btn-filtro-mes').click();
                } else {
                    msjError(respuesta.error);
                }
            }
        });

        document.getElementById('btn-buscar-fechas')?.addEventListener('click', () => {
            cargarHistorial(document.getElementById('fecha-inicio').value, document.getElementById('fecha-fin').value);
        });

        document.getElementById('btn-filtro-semana')?.addEventListener('click', () => {
            const hoy = new Date();
            const diaDeLaSemana = hoy.getDay() || 7; 
            const lunes = new Date(hoy);
            lunes.setDate(hoy.getDate() - diaDeLaSemana + 1);
            
            document.getElementById('fecha-inicio').value = lunes.toISOString().split('T')[0];
            document.getElementById('fecha-fin').value = hoy.toISOString().split('T')[0];
            cargarHistorial(lunes.toISOString().split('T')[0], hoy.toISOString().split('T')[0]);
        });

        document.getElementById('btn-filtro-mes')?.addEventListener('click', () => {
            const hoy = new Date();
            const primerDiaDelMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            
            document.getElementById('fecha-inicio').value = primerDiaDelMes.toISOString().split('T')[0];
            document.getElementById('fecha-fin').value = hoy.toISOString().split('T')[0];
            cargarHistorial(primerDiaDelMes.toISOString().split('T')[0], hoy.toISOString().split('T')[0]);
        });

        async function cargarHistorial(inicio, fin) {
            if (!inicio || !fin) { msjError("Por favor seleccione ambas fechas."); return; }
            
            const respuesta = await postData('/api/obtener_historial', {
                password: passwordAprobada, fecha_inicio: inicio, fecha_fin: fin
            });

            if (respuesta.exito) {
                document.getElementById('txt-ingresos').textContent = "$" + respuesta.total_ingresos.toFixed(2);
                document.getElementById('txt-gastos').textContent = "$" + respuesta.total_gastos.toFixed(2);
                document.getElementById('txt-neto').textContent = "$" + respuesta.neto.toFixed(2);

                const tbody = document.getElementById('tabla-historial-body');
                tbody.innerHTML = ""; 
                
                if (respuesta.registros.length === 0) {
                    tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>No hay registros en estas fechas</td></tr>";
                    return;
                }

                respuesta.registros.forEach(reg => {
                    const fila = document.createElement('tr');
                    const colorMonto = reg.es_gasto ? 'color: var(--color-rojo);' : 'color: var(--color-verde);';
                    const tipoTexto = reg.es_gasto ? 'Gasto' : 'Ingreso';
                    
                    fila.innerHTML = `
                        <td>${reg.fecha}</td>
                        <td>${reg.concepto}</td>
                        <td style="font-weight:bold; ${colorMonto}">$${reg.monto.toFixed(2)}</td>
                        <td>${tipoTexto}</td>
                    `;
                    tbody.appendChild(fila);
                });
            } else {
                msjError(respuesta.error);
            }
        }
    }
});


// --- Función para el Reloj ---
function actualizarReloj() {
    const el = document.getElementById('fecha-hora-actual');
    if (!el) return;
    const now = new Date();
    const fecha = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    el.textContent = `📅 ${fecha} | ⏰ ${hora}`;
}

// --- Función de Comunicación con el API ---
async function postData(url = '', data = {}) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const responseData = await response.json();
        if (!response.ok) {
            console.error("Error en respuesta del servidor:", response.status, responseData);
            return { exito: false, error: responseData.error || `Error del servidor (${response.status})` };
        }
        return responseData;
    } catch (error) {
        console.error('Error de red:', error);
        return { exito: false, error: 'Error de conexión con el servidor.' };
    }
}

// --- Funciones del MODAL PROPIO (Legacy) ---
function mostrarModal(titulo, contenidoHtml, callbackConfirmacion) {
    const modalTitulo = document.getElementById('modal-titulo');
    const modalContenido = document.getElementById('modal-contenido');
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalPrincipal = document.getElementById('modal-principal');
    const btnConfirmarOriginal = document.getElementById('modal-boton-confirmar');

    if (!modalTitulo || !modalContenido || !modalBackdrop || !modalPrincipal || !btnConfirmarOriginal) return;

    btnConfirmarOriginal.style.display = 'inline-block'; 

    modalTitulo.textContent = titulo;
    modalContenido.innerHTML = contenidoHtml;

    const nuevoBtnConfirmar = btnConfirmarOriginal.cloneNode(true);
    btnConfirmarOriginal.parentNode.replaceChild(nuevoBtnConfirmar, btnConfirmarOriginal);

    if (callbackConfirmacion && typeof callbackConfirmacion === 'function') {
        nuevoBtnConfirmar.addEventListener('click', callbackConfirmacion);
    }

    modalBackdrop.style.display = 'block';
    modalPrincipal.style.display = 'block';
}

function ocultarModal() {
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalPrincipal = document.getElementById('modal-principal');
    const modalContenido = document.getElementById('modal-contenido');
    if (!modalBackdrop || !modalPrincipal || !modalContenido) return;
    modalBackdrop.style.display = 'none';
    modalPrincipal.style.display = 'none';
    modalContenido.innerHTML = ''; 
}

function capitalizarNombre(nombre) {
    if (!nombre || typeof nombre !== 'string') return '';
    return nombre.trim().replace(/\s+/g, ' ') 
           .split(' ') 
           .map(n => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()) 
           .join(' '); 
}

// --- Helpers de SweetAlert ---
function msjExito(mensaje) {
    Swal.fire({
        title: 'Éxito',
        text: mensaje,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        background: 'var(--color-fondo-secundario)',
        color: 'var(--color-texto-principal)'
    });
}
function msjError(mensaje) {
    Swal.fire({
        title: 'Error',
        text: mensaje,
        icon: 'error',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#e74c3c',
        background: 'var(--color-fondo-secundario)',
        color: 'var(--color-texto-principal)'
    });
}


// --- Manejadores de Eventos (INDEX) ---
async function manejarClicIngresoEstandar(evento) {
    const boton = evento.currentTarget;
    const tipo = boton.dataset.tipo;
    const monto = parseFloat(boton.dataset.monto);
    const requiereNombre = boton.dataset.requiereNombre === 'true';
    let nombre = null;

    try {
        if (requiereNombre) {
            const { value: nombreIngresado } = await Swal.fire({
                title: `Registro de ${tipo}`,
                text: "Ingrese el nombre del cliente:",
                input: 'text',
                inputPlaceholder: 'Nombre completo',
                showCancelButton: true,
                confirmButtonText: 'Registrar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#2980b9',
                inputValidator: (value) => {
                    if (!value) { return 'El nombre es obligatorio'; }
                }
            });
            
            if (!nombreIngresado) return; 
            nombre = capitalizarNombre(nombreIngresado);
        }

        const payload = { tipo: tipo, monto_pagado: monto, monto_total: monto, nombre: nombre };
        const respuesta = await postData('/api/registrar_ingreso', payload);
        
        if (respuesta.exito) {
            msjExito(respuesta.mensaje);
            setTimeout(() => location.reload(), 1000); 
        } else {
            msjError(respuesta.error);
        }
    } catch (error) {
        console.error('Error:', error);
        msjError('Ocurrió un error inesperado.');
    }
}

async function manejarOtrosPagos() {
    const { value: nombreIngresado } = await Swal.fire({
        title: 'Pago Especial',
        text: "Ingrese el nombre del cliente:",
        input: 'text',
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#2980b9',
        inputValidator: (value) => {
            if (!value) { return 'El nombre es obligatorio.'; }
        }
    });

    if (!nombreIngresado) return;
    const nombre = capitalizarNombre(nombreIngresado);

    const titulo = `Pago Especial para ${nombre}`;
    const contenido = `
        <p>Seleccione el tipo de membresía especial:</p>
        <div class="modal-grid-botones" id="modal-botones-otros" style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
            <button class="btn-selector-modal" data-tipo="Anualidad" data-meses="12">📅 Anualidad<br><small style="font-weight:400;opacity:0.8;">12 meses</small></button>
            <button class="btn-selector-modal" data-tipo="Semestre" data-meses="6">📆 Semestre<br><small style="font-weight:400;opacity:0.8;">6 meses</small></button>
            <button class="btn-selector-modal" data-tipo="Otro (Meses)">✏️ Otro<br><small style="font-weight:400;opacity:0.8;">(Meses)</small></button>
        </div>
        <div id="campos-otros-meses" style="display: none;">
            <div class="control-formulario">
                <label for="modal-input-meses">Cantidad de Meses:</label>
                <input type="number" id="modal-input-meses" placeholder="Ej: 3" min="1">
            </div>
        </div>
        <div class="control-formulario">
            <label for="modal-input-monto">Monto Total Pagado:</label>
            <input type="number" id="modal-input-monto" step="0.01" placeholder="Ej: 1000.00" min="0.01">
        </div>`;

    mostrarModal(titulo, contenido, async () => {
        const tipoSeleccionado = document.querySelector('#modal-botones-otros .tipo-seleccionado');
        if (!tipoSeleccionado) { msjError("Seleccione un tipo de pago."); return; }
        const tipo = tipoSeleccionado.dataset.tipo;
        let meses = parseInt(tipoSeleccionado.dataset.meses || '0');
        const montoTotalInput = document.getElementById('modal-input-monto');
        if (!montoTotalInput) return;
        const montoTotal = parseFloat(montoTotalInput.value);

        if (tipo === "Otro (Meses)") {
            const mesesInput = document.getElementById('modal-input-meses');
            meses = parseInt(mesesInput.value);
            if (isNaN(meses) || meses <= 0) { msjError("Ingrese un número de meses válido."); return; }
        }
        if (isNaN(montoTotal) || montoTotal <= 0) { msjError("Ingrese un monto total válido."); return; }

        const payload = { tipo: tipo, nombre: nombre, monto_pagado: montoTotal, monto_total: montoTotal, meses: meses };
        const respuesta = await postData('/api/registrar_ingreso', payload);
        if (respuesta.exito) { 
            ocultarModal(); 
            msjExito(respuesta.mensaje);
            setTimeout(() => location.reload(), 1000); 
        }
        else { msjError(respuesta.error); }
    });

    document.querySelectorAll('#modal-botones-otros button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#modal-botones-otros button').forEach(b => b.classList.remove('tipo-seleccionado'));
            e.currentTarget.classList.add('tipo-seleccionado');
            const camposMeses = document.getElementById('campos-otros-meses');
            if (camposMeses) {
                camposMeses.style.display = (e.currentTarget.dataset.tipo === "Otro (Meses)") ? 'block' : 'none';
            }
        });
    });
}

async function manejarGastoRapido() {
    const { value: formValues } = await Swal.fire({
        title: 'Registrar Gasto',
        html:
            '<label style="color: var(--color-texto-secundario);">Monto:</label>' +
            '<input id="swal-input-monto" class="swal2-input" type="number" placeholder="Ej: 50">' +
            '<label style="color: var(--color-texto-secundario); margin-top: 15px; display:block;">Concepto (Opcional):</label>' +
            '<input id="swal-input-concepto" class="swal2-input" placeholder="Ej: Limpieza">',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Registrar',
        confirmButtonColor: '#e74c3c', // Rojo
        preConfirm: () => {
            return [
                document.getElementById('swal-input-monto').value,
                document.getElementById('swal-input-concepto').value
            ]
        }
    });

    if (!formValues) return;
    const [montoStr, conceptoStr] = formValues;
    
    const monto = parseFloat(montoStr);
    if (isNaN(monto) || monto <= 0) { msjError("El monto debe ser un número positivo."); return; }
    const concepto = conceptoStr.trim() || "Gasto Rápido/Varios";

    const respuesta = await postData('/api/registrar_gasto', { monto: monto, concepto: concepto });
    if (respuesta.exito) { 
        msjExito(respuesta.mensaje);
        setTimeout(() => location.reload(), 1000); 
    } else { msjError(respuesta.error); }
}

async function manejarCierreDia() {
    const ingresosEl = document.getElementById('resumen-ingresos');
    const gastosEl = document.getElementById('resumen-gastos');
    const netoEl = document.getElementById('resumen-neto');
    if (!ingresosEl) return;

    // Quita clases "censurado" solo para capturar los valores reales si estaba el ojo activo
    let vIngresos = ingresosEl.textContent;
    let vGastos = gastosEl.textContent;
    let vNeto = netoEl.textContent;

    const htmlResumen = `
        <div style="text-align: left; background: var(--color-fondo-terciario); padding: 15px; border-radius: 8px; color: var(--color-texto-principal); border: 1px solid var(--color-borde);">
            <p style="margin:5px 0;"><strong>Ingresos:</strong> ${vIngresos}</p>
            <p style="margin:5px 0;"><strong>Gastos:</strong> ${vGastos}</p>
            <p style="color: var(--color-verde); font-size: 1.2em; margin-top: 10px; border-top: 1px solid var(--color-borde); padding-top: 10px;"><strong>NETO:</strong> ${vNeto}</p>
        </div>
        <p style="margin-top: 15px; font-size: 0.9em; color: var(--color-texto-secundario);">Si hubo gastos adicionales no registrados, ingrésalos abajo:</p>
    `;

    const { value: gastoStr } = await Swal.fire({
        title: 'Corte De Caja',
        html: htmlResumen,
        input: 'number',
        inputValue: 0,
        inputLabel: 'Gastos Adicionales (Opcional)',
        showCancelButton: true,
        confirmButtonText: 'Ver Resumen Final',
        confirmButtonColor: '#2980b9',
        cancelButtonText: 'Cancelar'
    });

    if (gastoStr === undefined) return;

    const gastoAdicional = parseFloat(gastoStr);
    if (isNaN(gastoAdicional) || gastoAdicional < 0) { msjError("Monto inválido."); return; }

    const respuesta = await postData('/api/cerrar_dia', { gasto_adicional: gastoAdicional });
    
    if (respuesta.resumen_final) {
         const r = respuesta.resumen_final;
         await Swal.fire({
             title: 'Ticket de Corte',
             html: `
                <hr style="border-color: var(--color-borde);">
                <p>Ingresos: <strong style="color: var(--color-primario);">$${r.ingresos.toFixed(2)}</strong></p>
                <p>Gastos: <strong style="color: var(--color-rojo);">$${r.gastos.toFixed(2)}</strong></p>
                <p>Neto Final: <strong style="color: var(--color-verde); font-size: 1.2em;">$${r.neto.toFixed(2)}</strong></p>
                <hr style="border-color: var(--color-borde);">
             `,
             icon: 'info',
             confirmButtonText: 'Entendido',
             confirmButtonColor: '#2980b9'
         });
    }

    if (respuesta.exito) {
        location.reload();
    } else {
        msjError(respuesta.error);
        location.reload();
    }
}

// --- Manejadores de Eventos (VENCIDOS) ---
function mostrarModalPagoVencido(evento) {
    const boton = evento.currentTarget;
    const nombre = boton.dataset.nombre;
    const pNormal = parseFloat(boton.dataset.precioNormal);
    const pEstudiante = parseFloat(boton.dataset.precioEstudiante);
    const pSemana = parseFloat(boton.dataset.precioSemana);

    const titulo = `Renovar a ${nombre}`;
    const contenido = `
        <p style="font-size:0.88em; text-transform:uppercase; letter-spacing:0.6px; color:var(--color-texto-muted); margin-bottom:10px; font-weight:600;">Tipo de Membresía</p>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px;" id="modal-botones-pago">
            <button class="btn-selector-modal" data-tipo="Mes Normal" data-precio-total="${pNormal}"
                style="flex:1; min-width:90px; padding:12px 8px; border-radius:10px; border:2px solid var(--color-borde); background:var(--color-fondo-terciario); color:var(--color-texto-secundario); cursor:pointer; font-weight:700; font-size:0.95em; transition:all 0.2s;">
                📅 Mes Normal<br><small style="font-weight:400; opacity:0.8;">$${pNormal.toFixed(2)}</small>
            </button>
            <button class="btn-selector-modal" data-tipo="Mes Estudiante" data-precio-total="${pEstudiante}"
                style="flex:1; min-width:90px; padding:12px 8px; border-radius:10px; border:2px solid var(--color-borde); background:var(--color-fondo-terciario); color:var(--color-texto-secundario); cursor:pointer; font-weight:700; font-size:0.95em; transition:all 0.2s;">
                🎓 Estudiante<br><small style="font-weight:400; opacity:0.8;">$${pEstudiante.toFixed(2)}</small>
            </button>
            <button class="btn-selector-modal" data-tipo="Semana" data-precio-total="${pSemana}"
                style="flex:1; min-width:90px; padding:12px 8px; border-radius:10px; border:2px solid var(--color-borde); background:var(--color-fondo-terciario); color:var(--color-texto-secundario); cursor:pointer; font-weight:700; font-size:0.95em; transition:all 0.2s;">
                📆 Semana<br><small style="font-weight:400; opacity:0.8;">$${pSemana.toFixed(2)}</small>
            </button>
        </div>
        <div class="control-formulario">
            <label for="modal-input-pago">Monto a Pagar Ahora (Abono o Completo):</label>
            <input type="number" id="modal-input-pago" step="0.01" placeholder="Ej: 100.00" min="0.01">
        </div>`;

    mostrarModal(titulo, contenido, async () => {
        const tipoSeleccionado = document.querySelector('#modal-botones-pago .tipo-seleccionado');
        if (!tipoSeleccionado) { msjError("Seleccione un tipo de membresía."); return; }
        const tipo = tipoSeleccionado.dataset.tipo;
        const montoTotal = parseFloat(tipoSeleccionado.dataset.precioTotal);
        const montoPagadoInput = document.getElementById('modal-input-pago');
        const montoPagado = parseFloat(montoPagadoInput.value);

        if (isNaN(montoPagado) || montoPagado <= 0) { msjError("Ingrese un monto válido a pagar."); return; }
        if (montoPagado > montoTotal + 0.001) { msjError(`El pago ($${montoPagado.toFixed(2)}) no puede ser mayor al costo total ($${montoTotal.toFixed(2)}).`); return; }

        const payload = { tipo: tipo, nombre: nombre, monto_pagado: montoPagado, monto_total: montoTotal };
        const respuesta = await postData('/api/registrar_ingreso', payload);
        if (respuesta.exito) { 
            ocultarModal(); 
            msjExito(respuesta.mensaje);
            setTimeout(() => location.reload(), 1000); 
        }
        else { msjError(respuesta.error); }
    });

    document.querySelectorAll('#modal-botones-pago button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Resetear todos
            document.querySelectorAll('#modal-botones-pago button').forEach(b => {
                b.style.borderColor = 'var(--color-borde)';
                b.style.background  = 'var(--color-fondo-terciario)';
                b.style.color       = 'var(--color-texto-secundario)';
            });
            // Marcar el seleccionado
            const btnActual = e.currentTarget;
            btnActual.style.borderColor = 'var(--color-primario)';
            btnActual.style.background  = 'rgba(45, 140, 219, 0.18)';
            btnActual.style.color       = '#fff';
            // Autorellenar monto
            const inputPago = document.getElementById('modal-input-pago');
            if(inputPago) inputPago.value = btnActual.dataset.precioTotal; 
            if(inputPago) inputPago.max   = btnActual.dataset.precioTotal; 
        });
    });
}

async function manejarEliminarCliente(evento) {
    const nombre = evento.currentTarget.dataset.nombre;
    const result = await Swal.fire({
        title: `¿Eliminar a ${nombre}?`,
        text: "Esta acción es permanente y podría borrar sus deudas si existen.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        cancelButtonColor: '#343a40',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    const respuesta = await postData('/api/eliminar_cliente', { nombre: nombre });
    if (respuesta.exito) { 
        msjExito(respuesta.mensaje);
        setTimeout(() => location.reload(), 1000); 
    } else { msjError(respuesta.error); }
}

// --- Manejadores de Eventos (AGENDA - REGISTRO MANUAL) ---
async function manejarRegistroManual(evento) {
    evento.preventDefault();
    const nombreInput = document.getElementById('manual-nombre');
    const fechaInput = document.getElementById('manual-fecha');
    if (!nombreInput || !fechaInput) return;
    
    const nombre = capitalizarNombre(nombreInput.value); 
    const fecha = fechaInput.value;
    
    if (!nombre || !fecha) { msjError("Nombre y fecha son obligatorios."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) { msjError("Formato de fecha inválido. Use AAAA-MM-DD."); return; }

    const respuesta = await postData('/api/registrar_vencimiento_manual', { nombre: nombre, fecha: fecha });
    if (respuesta.exito) { 
        msjExito(respuesta.mensaje);
        setTimeout(() => location.reload(), 1000); 
    } else { msjError(respuesta.error); }
}

// --- Manejadores de Eventos (INVENTARIO) ---
async function manejarAjusteStock(evento) {
    evento.preventDefault(); 
    const accion = ultimaAccionStock;
    ultimaAccionStock = null; 

    if (!accion) { msjError("Error interno: No se pudo determinar la acción."); return; }

    const form = evento.currentTarget;
    const productoSelect = form.elements['producto'];
    const cantidadInput = form.elements['cantidad'];
    const producto = productoSelect.value;
    let cantidad = parseInt(cantidadInput.value);

    if (isNaN(cantidad) || cantidad <= 0) { msjError("Cantidad debe ser positiva."); return; }
    if (accion === 'restar') { cantidad = -cantidad; }

    const respuesta = await postData('/api/ajustar_stock', { producto: producto, cantidad: cantidad });
    if (respuesta.exito) { 
        msjExito(respuesta.mensaje);
        setTimeout(() => location.reload(), 1000);
    } else { msjError(respuesta.error); }
}

// --- Manejadores de Eventos (DEUDORES) ---
function mostrarModalAgregarDeuda(nombreCliente = '') {
    const titulo = nombreCliente ? `Añadir Deuda a ${nombreCliente.trim()}` : 'Registrar Nueva Deuda';
    const nombreCapitalizado = capitalizarNombre(nombreCliente);
    const nombreInputHtml = nombreCliente
        ? `<div class="control-formulario"><label>Cliente:</label><input type="text" id="modal-deuda-nombre" value="${nombreCapitalizado}" disabled></div>`
        : `<div class="control-formulario"><label for="modal-deuda-nombre">Nombre Cliente:</label><input type="text" id="modal-deuda-nombre" placeholder="Nombre completo" required></div>`;
    
    const contenido = `
        <form id="form-modal-agregar-deuda">
            ${nombreInputHtml}
            <div class="control-formulario-radio" style="margin-top:10px;"> 
                <input type="radio" id="modal-radio-producto" name="modal-tipo-deuda" value="producto" checked> 
                <label for="modal-radio-producto">Producto de Inventario</label> 
            </div>
            <div class="control-formulario-radio"> 
                <input type="radio" id="modal-radio-manual" name="modal-tipo-deuda" value="manual"> 
                <label for="modal-radio-manual">Cargo Manual</label> 
            </div>
            
            <div id="modal-campos-producto" class="campos-condicionales">
                <div class="control-formulario">
                    <label for="modal-producto-select">Producto:</label>
                    <select id="modal-producto-select">
                        <option value="Agua">Agua</option>
                        <option value="Amper">Amper</option>
                        <option value="Barra">Barra</option>
                        <option value="Cafe">Cafe</option>
                        <option value="Proteina">Proteina</option>
                        <option value="Creatina">Creatina</option>
                        <option value="Preentreno">Preentreno</option>       
                    </select>
                </div>
                <div class="control-formulario">
                    <label for="modal-producto-cantidad">Cantidad:</label>
                    <input type="number" id="modal-producto-cantidad" min="1" value="1" required>
                </div>
            </div>
            
            <div id="modal-campos-manual" class="campos-condicionales" style="display: none;"> 
                <div class="control-formulario"><label for="modal-manual-concepto">Concepto:</label><input type="text" id="modal-manual-concepto"></div> 
                <div class="control-formulario"><label for="modal-manual-monto">Monto:</label><input type="number" id="modal-manual-monto" step="0.01" min="0.01"></div> 
            </div>
        </form>
    `;

    mostrarModal(titulo, contenido, async () => { 
        const nombreInput = document.getElementById('modal-deuda-nombre');
        const tipoDeudaRadio = document.querySelector('input[name="modal-tipo-deuda"]:checked');
        if (!nombreInput || !tipoDeudaRadio) return;
        
        const nombre = capitalizarNombre(nombreInput.value); 
        if (!nombre) { msjError("El nombre es obligatorio."); return; }
        
        const tipoDeuda = tipoDeudaRadio.value;
        let payload = { nombre: nombre, tipo_deuda: tipoDeuda };

        if (tipoDeuda === 'producto') {
            const productoSelect = document.getElementById('modal-producto-select');
            const cantidadInput = document.getElementById('modal-producto-cantidad');
            const cantidad = parseInt(cantidadInput.value);
            if (isNaN(cantidad) || cantidad <= 0) { msjError("Cantidad inválida."); return; }
            payload.producto = productoSelect.value; 
            payload.cantidad = cantidad;
        } else { 
            const conceptoInput = document.getElementById('modal-manual-concepto');
            const montoInput = document.getElementById('modal-manual-monto');
            const concepto = conceptoInput.value;
            const monto = parseFloat(montoInput.value);
            if (!concepto || concepto.trim() === '') { msjError("Concepto obligatorio."); return; }
            if (isNaN(monto) || monto <= 0) { msjError("Monto inválido."); return; }
            payload.concepto = concepto.trim(); 
            payload.monto = monto;
        }

        const respuesta = await postData('/api/deudores/agregar', payload);
        if (respuesta.exito) { 
            ocultarModal(); 
            msjExito(respuesta.mensaje);
            setTimeout(() => location.reload(), 1000); 
        }
        else { msjError(respuesta.error); }
    });

    document.querySelectorAll('input[name="modal-tipo-deuda"]').forEach(radio => radio.addEventListener('change', (e) => {
        const esProducto = e.currentTarget.value === 'producto';
        const camposProd = document.getElementById('modal-campos-producto');
        const camposMan = document.getElementById('modal-campos-manual');
        const cantInput = document.getElementById('modal-producto-cantidad');
        const concInput = document.getElementById('modal-manual-concepto');
        const montInput = document.getElementById('modal-manual-monto');

        if (camposProd) camposProd.style.display = esProducto ? 'flex' : 'none';
        if (camposMan) camposMan.style.display = esProducto ? 'none' : 'flex';
        if (cantInput) cantInput.required = esProducto;
        if (concInput) concInput.required = !esProducto;
        if (montInput) montInput.required = !esProducto;
    }));
    const radioInicial = document.querySelector('input[name="modal-tipo-deuda"]:checked');
    if (radioInicial) radioInicial.dispatchEvent(new Event('change'));
}

function mostrarModalPagarDeuda(evento) {
    const boton = evento.currentTarget;
    const deuda_id = boton.dataset.deudaId;
    const nombre = boton.dataset.nombre;
    const concepto = boton.dataset.concepto;
    const montoMaximo = parseFloat(boton.dataset.montoMaximo);

    const titulo = `Pagar Deuda de ${nombre}`;
    const contenido = `
        <p style="color:var(--color-texto-secundario);"><strong>Concepto:</strong> ${concepto}</p>
        <p style="color:var(--color-texto-secundario);"><strong>Deuda Actual:</strong> $${montoMaximo.toFixed(2)}</p>
        <div class="control-formulario" style="margin-top: 15px;">
            <label for="modal-input-abono">Monto a Pagar:</label>
            <input type="number" id="modal-input-abono" step="0.01" max="${montoMaximo.toFixed(2)}" value="${montoMaximo.toFixed(2)}" required>
        </div>
        <div class="modal-acciones-especiales" style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
            <button class="btn-tabla" style="background-color: var(--color-fondo-terciario); color: var(--color-texto-secundario);" id="btn-pagar-sin-caja">
                Borrar (No en Caja)
            </button>
            <button class="btn-tabla btn-pagar" id="btn-pagar-con-caja">
                Cobrar y Sumar a Caja
            </button>
        </div>
    `;

    mostrarModal(titulo, contenido, null); 

    const btnConfirmarDefault = document.getElementById('modal-boton-confirmar');
    if(btnConfirmarDefault) btnConfirmarDefault.style.display = 'none';

    const procesarPago = async (registrarCaja) => {
        const montoInput = document.getElementById('modal-input-abono');
        const montoAbono = parseFloat(montoInput.value);
        if (isNaN(montoAbono) || montoAbono <= 0) { msjError("Monto inválido."); return; }
        if (montoAbono > montoMaximo + 0.001) { msjError("El pago no puede ser mayor a la deuda actual."); return; }

        const payload = { deuda_id: parseInt(deuda_id), monto: montoAbono, registrar_caja: registrarCaja };
        const respuesta = await postData('/api/deudores/pagar', payload);
        if (respuesta.exito) { 
            ocultarModal(); 
            msjExito(respuesta.mensaje);
            setTimeout(() => location.reload(), 1000); 
        }
        else { msjError(respuesta.error); }
    };

    setTimeout(() => { 
        document.getElementById('btn-pagar-con-caja').addEventListener('click', () => procesarPago(true));
        document.getElementById('btn-pagar-sin-caja').addEventListener('click', async () => {
            const result = await Swal.fire({
                title: '¿Solo borrar?',
                text: "Esto borrará la deuda SIN recibir dinero en caja.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#e74c3c',
                confirmButtonText: 'Sí, borrar deuda'
            });
            if (result.isConfirmed) {
                procesarPago(false);
            }
        });
    }, 100);
}

function mostrarModalPagarDeudaTotal(evento) {
    const boton = evento.currentTarget;
    const nombre = boton.dataset.nombre;
    const totalDeuda = parseFloat(boton.dataset.totalDeuda);

    const titulo = `Liquidar Total de ${nombre}`;
    const contenido = `
        <p style="color:var(--color-texto-secundario);"><strong>Deuda Total:</strong> $${totalDeuda.toFixed(2)}</p>
        <div class="control-formulario" style="margin-top: 15px;">
            <label for="modal-input-pago-total">Monto a Pagar:</label>
            <input type="number" id="modal-input-pago-total" step="0.01" max="${totalDeuda.toFixed(2)}" value="${totalDeuda.toFixed(2)}" required>
        </div>
        <div class="modal-acciones-especiales" style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
            <button class="btn-tabla" style="background-color: var(--color-fondo-terciario); color: var(--color-texto-secundario);" id="btn-total-sin-caja">
                Borrar (No en Caja)
            </button>
            <button class="btn-tabla btn-pagar" id="btn-total-con-caja">
                Cobrar y Sumar a Caja
            </button>
        </div>`;

    mostrarModal(titulo, contenido, null);
    const btnConfirmarDefault = document.getElementById('modal-boton-confirmar');
    if(btnConfirmarDefault) btnConfirmarDefault.style.display = 'none';

    const procesarPagoTotal = async (registrarCaja) => {
        const montoInput = document.getElementById('modal-input-pago-total');
        const montoAPagar = parseFloat(montoInput.value);
        if (isNaN(montoAPagar) || montoAPagar <= 0) { msjError("Monto inválido."); return; }
        if (montoAPagar > totalDeuda + 0.001) { msjError("El pago no puede ser mayor a la deuda total."); return; }

        const payload = { nombre: nombre, monto: montoAPagar, registrar_caja: registrarCaja };
        const respuesta = await postData('/api/deudores/pagar_total', payload);
        if (respuesta.exito) { 
            ocultarModal(); 
            msjExito(respuesta.mensaje);
            setTimeout(() => location.reload(), 1000); 
        }
        else { msjError(respuesta.error); }
    };

    setTimeout(() => {
        document.getElementById('btn-total-con-caja').addEventListener('click', () => procesarPagoTotal(true));
        document.getElementById('btn-total-sin-caja').addEventListener('click', async () => {
             const result = await Swal.fire({
                title: '¿Solo borrar?',
                text: "Esto borrará la deuda total SIN registrar dinero en caja.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#e74c3c',
                confirmButtonText: 'Sí, borrar todo'
            });
            if (result.isConfirmed) {
                procesarPagoTotal(false);
            }
        });
    }, 100);
}
