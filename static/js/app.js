// Variable global para la corrección de Safari
let ultimaAccionStock = null;

// --- Ejecutar cuando el DOM esté listo ---
document.addEventListener('DOMContentLoaded', () => {

    console.log("Asistente de Gimnasio Web Cargado (SweetAlert2 activado).");

    // --- Funcionalidad General ---
    actualizarReloj();
    setInterval(actualizarReloj, 1000); 

    // --- Configuración del Modal Global ---
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

        // --- Lógica del Ojo Bancario ---
        const btnToggleSaldos = document.getElementById('btn-toggle-saldos');
        const cifrasBancarias = document.querySelectorAll('.cifra-bancaria');
        const iconoAbierto = document.getElementById('icono-ojo-abierto');
        const iconoCerrado = document.getElementById('icono-ojo-cerrado');

        if (btnToggleSaldos && cifrasBancarias.length > 0) {
            // Función para difuminar o mostrar
            const aplicarEstadoSaldos = (ocultar) => {
                cifrasBancarias.forEach(el => {
                    if (ocultar) el.classList.add('censurado');
                    else el.classList.remove('censurado');
                });
                
                // Cambiar el icono
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

            // Al hacer clic en el ojo, cambiar el estado y guardar en memoria
            btnToggleSaldos.addEventListener('click', () => {
                const estadoActual = localStorage.getItem('saldosOcultos') === 'true';
                const nuevoEstado = !estadoActual;
                localStorage.setItem('saldosOcultos', nuevoEstado); // Guarda en el navegador
                aplicarEstadoSaldos(nuevoEstado);
            });
        }
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
    if (document.getElementById('form-registro-manual')) {
        document.getElementById('form-registro-manual').addEventListener('submit', manejarRegistroManual);
        
        // Activar los botones de editar
        document.querySelectorAll('.btn-editar-agenda').forEach(boton => {
            boton.addEventListener('click', manejarEditarDesdeAgenda);
        });
    }

    // --- NUEVO: Buscador para la página de Agenda ---
    const buscadorAgenda = document.getElementById('buscador-agenda');
    if (buscadorAgenda) {
        buscadorAgenda.addEventListener('input', (e) => {
            const termino = e.target.value.toLowerCase();
            const tablas = document.querySelectorAll('.pagina-lista .tabla-datos');
            tablas.forEach(tabla => {
                let hayCoincidenciasEnMes = false;
                const filas = tabla.querySelectorAll('tbody tr');
                filas.forEach(fila => {
                    const celdaNombre = fila.querySelector('td');
                    if (celdaNombre) {
                        const nombre = celdaNombre.textContent.toLowerCase();
                        if (nombre.includes(termino)) {
                            fila.style.display = ''; 
                            hayCoincidenciasEnMes = true;
                        } else {
                            fila.style.display = 'none';
                        }
                    }
                });
                const tituloMes = tabla.previousElementSibling; 
                if (tituloMes && tituloMes.classList.contains('grupo-mes')) {
                    if (hayCoincidenciasEnMes) {
                        tabla.style.display = '';
                        tituloMes.style.display = '';
                    } else {
                        tabla.style.display = 'none';
                        tituloMes.style.display = 'none';
                    }
                }
            });
        });
    }

    // --- Página de Inventario (inventario.html) ---
    // --- Página de Inventario (inventario.html) ---
    if (document.querySelector('.pagina-inventario')) {
        const btnDesbloquearInv = document.getElementById('btn-desbloquear-inv');
        const panelBloqueadoInv = document.getElementById('panel-bloqueado-inv');
        const panelInventario = document.getElementById('panel-inventario');

        // Lógica de la contraseña
        if (btnDesbloquearInv) {
            btnDesbloquearInv.addEventListener('click', async () => {
                const { value: pass } = await Swal.fire({
                    title: 'Acceso Restringido',
                    input: 'password',
                    inputLabel: 'Contraseña de administrador:',
                    inputPlaceholder: 'Contraseña',
                    showCancelButton: true,
                    confirmButtonText: 'Entrar'
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

        // Lógica que ya tenías para sumar/restar stock
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

// --- Funciones del MODAL PROPIO (Pop-up complejo) ---
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

// --- Helpers de SweetAlert (Atajos) ---
function msjExito(mensaje) {
    Swal.fire({
        title: '¡Éxito!',
        text: mensaje,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
    });
}
function msjError(mensaje) {
    Swal.fire({
        title: 'Error',
        text: mensaje,
        icon: 'error',
        confirmButtonText: 'Entendido'
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
            // Reemplazo de PROMPT por SweetAlert Input
            const { value: nombreIngresado } = await Swal.fire({
                title: `Registro de ${tipo}`,
                text: "Ingrese el nombre del cliente:",
                input: 'text',
                inputPlaceholder: 'Nombre completo',
                showCancelButton: true,
                confirmButtonText: 'Registrar',
                cancelButtonText: 'Cancelar',
                inputValidator: (value) => {
                    if (!value) { return '¡Debes escribir un nombre!'; }
                }
            });
            
            if (!nombreIngresado) return; 
            nombre = capitalizarNombre(nombreIngresado);
        }

        const payload = {
            tipo: tipo,
            monto_pagado: monto, 
            monto_total: monto,
            nombre: nombre
        };

        const respuesta = await postData('/api/registrar_ingreso', payload);
        if (respuesta.exito) {
            await Swal.fire({
                title: '¡Registrado!',
                text: respuesta.mensaje,
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
            location.reload(); 
        } else {
            msjError(respuesta.error);
        }
    } catch (error) {
        console.error('Error:', error);
        msjError('Ocurrió un error inesperado.');
    }
}

async function manejarOtrosPagos() {
    // 1. Pedir nombre con SweetAlert
    const { value: nombreIngresado } = await Swal.fire({
        title: 'Nuevo Pago Especial',
        text: "Ingrese el nombre del cliente:",
        input: 'text',
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
            if (!value) { return 'El nombre es obligatorio.'; }
        }
    });

    if (!nombreIngresado) return;
    const nombre = capitalizarNombre(nombreIngresado);

    // 2. Mostrar TU modal personalizado para las opciones complejas
    const titulo = `Pago Especial para ${nombre}`;
    const contenido = `
        <p>Seleccione el tipo de membresía especial:</p>
        <div class="modal-grid-botones" id="modal-botones-otros">
            <button data-tipo="Anualidad" data-meses="12">Anualidad (12 Meses)</button>
            <button data-tipo="Semestre" data-meses="6">Semestre (6 Meses)</button>
            <button data-tipo="Otro (Meses)">Otro (Meses Específicos)</button>
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
            await Swal.fire({ title: 'Éxito', text: respuesta.mensaje, icon: 'success', timer: 1500, showConfirmButton: false });
            location.reload(); 
        }
        else { msjError(respuesta.error); }
    });

    // Lógica visual del modal interno
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
    // SweetAlert con formulario HTML (2 inputs)
    const { value: formValues } = await Swal.fire({
        title: 'Registrar Gasto',
        html:
            '<label>Monto:</label>' +
            '<input id="swal-input-monto" class="swal2-input" type="number" placeholder="Ej: 50">' +
            '<label>Concepto (Opcional):</label>' +
            '<input id="swal-input-concepto" class="swal2-input" placeholder="Ej: Limpieza">',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Registrar',
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
        await Swal.fire({ title: 'Gasto Registrado', text: respuesta.mensaje, icon: 'success', timer: 1500, showConfirmButton: false });
        location.reload(); 
    } else { msjError(respuesta.error); }
}

async function manejarCierreDia() {
    const ingresosEl = document.getElementById('resumen-ingresos');
    const gastosEl = document.getElementById('resumen-gastos');
    const netoEl = document.getElementById('resumen-neto');
    if (!ingresosEl) return;

    // Resumen en HTML para el SweetAlert
    const htmlResumen = `
        <div style="text-align: left; background: #333; padding: 10px; border-radius: 5px; color: #fff;">
            <p><strong>Ingresos:</strong> ${ingresosEl.textContent}</p>
            <p><strong>Gastos:</strong> ${gastosEl.textContent}</p>
            <p style="color: lightgreen; font-size: 1.2em;"><strong>NETO:</strong> ${netoEl.textContent}</p>
        </div>
        <p style="margin-top: 15px;">Si hubo gastos adicionales no registrados, ingrésalos abajo:</p>
    `;

    const { value: gastoStr } = await Swal.fire({
        title: 'Corte De Caja',
        html: htmlResumen,
        input: 'number',
        inputValue: 0,
        inputLabel: 'Gastos Adicionales (Opcional)',
        showCancelButton: true,
        confirmButtonText: 'Ver Resumen Final',
        confirmButtonColor: '#1C70A0', // Rojo para acción peligrosa
        cancelButtonText: 'Cancelar'
    });

    if (gastoStr === undefined) return; // Cancelado

    const gastoAdicional = parseFloat(gastoStr);
    if (isNaN(gastoAdicional) || gastoAdicional < 0) { msjError("Monto inválido."); return; }

    const respuesta = await postData('/api/cerrar_dia', { gasto_adicional: gastoAdicional });
    
    if (respuesta.resumen_final) {
         const r = respuesta.resumen_final;
         await Swal.fire({
             title: '¡CORTE DE CAJA!',
             html: `
                <p style="font-size: 1.1em;">Este es tu ticket de resumen del día.</p>
                <hr style="border-color: #444;">
                <p>Ingresos: <strong style="color: #1C70A0;">$${r.ingresos.toFixed(2)}</strong></p>
                <p>Gastos: <strong style="color: #CC0000;">$${r.gastos.toFixed(2)}</strong></p>
                <p>Neto Final: <strong style="color: #00CC00; font-size: 1.2em;">$${r.neto.toFixed(2)}</strong></p>
                <hr style="border-color: #444;">
                <p><small style="color: #888;">* Los contadores se pondrán en $0.00 automáticamente a las 12:00 AM.</small></p>
             `,
             icon: 'info',
             confirmButtonText: 'Entendido'
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

    const titulo = `Procesar Pago para ${nombre}`;
    const contenido = `
        <p>1. Seleccione el tipo de membresía:</p>
        <div class="modal-grid-botones" id="modal-botones-pago">
            <button data-tipo="Mes Normal" data-precio-total="${pNormal}">Mes Normal ($${pNormal.toFixed(2)})</button>
            <button data-tipo="Mes Estudiante" data-precio-total="${pEstudiante}">Mes Estudiante ($${pEstudiante.toFixed(2)})</button>
            <button data-tipo="Semana" data-precio-total="${pSemana}">Semana ($${pSemana.toFixed(2)})</button>
        </div>
        <div class="control-formulario">
            <label for="modal-input-pago">2. Monto a Pagar Ahora (Abono o Completo):</label>
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
            await Swal.fire({ title: 'Pago Registrado', text: respuesta.mensaje, icon: 'success', timer: 1500, showConfirmButton: false });
            location.reload(); 
        }
        else { msjError(respuesta.error); }
    });

    document.querySelectorAll('#modal-botones-pago button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#modal-botones-pago button').forEach(b => b.classList.remove('tipo-seleccionado'));
            const btnActual = e.currentTarget;
            btnActual.classList.add('tipo-seleccionado');
            const inputPago = document.getElementById('modal-input-pago');
            if(inputPago) inputPago.value = btnActual.dataset.precioTotal; 
            if(inputPago) inputPago.max = btnActual.dataset.precioTotal; 
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
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    const respuesta = await postData('/api/eliminar_cliente', { nombre: nombre });
    if (respuesta.exito) { 
        await Swal.fire('Eliminado', respuesta.mensaje, 'success');
        location.reload(); 
    } else { msjError(respuesta.error); }
}

// --- Manejadores de Eventos (AGENDA) ---
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
        setTimeout(() => location.reload(), 1500); 
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

    if (isNaN(cantidad)) { msjError("Cantidad inválida. Use solo números enteros."); return; }
    if (cantidad <= 0) { msjError("La cantidad debe ser positiva."); return; }

    if (accion === 'restar') { cantidad = -cantidad; }

    const respuesta = await postData('/api/ajustar_stock', { producto: producto, cantidad: cantidad });
    if (respuesta.exito) { 
        msjExito(respuesta.mensaje);
        setTimeout(() => location.reload(), 1500);
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
            <div class="control-formulario-radio"> <input type="radio" id="modal-radio-producto" name="modal-tipo-deuda" value="producto" checked> <label for="modal-radio-producto">Producto (Inventario)</label> </div>
            <div class="control-formulario-radio"> <input type="radio" id="modal-radio-manual" name="modal-tipo-deuda" value="manual"> <label for="modal-radio-manual">Manual (Otro)</label> </div>
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
            <div id="modal-campos-manual" class="campos-condicionales" style="display: none;"> <div class="control-formulario"><label for="modal-manual-concepto">Concepto:</label><input type="text" id="modal-manual-concepto"></div> <div class="control-formulario"><label for="modal-manual-monto">Monto:</label><input type="number" id="modal-manual-monto" step="0.01" min="0.01"></div> </div>
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
            const producto = productoSelect.value;
            const cantidad = parseInt(cantidadInput.value);
            if (isNaN(cantidad) || cantidad <= 0) { msjError("Cantidad inválida."); return; }
            payload.producto = producto; payload.cantidad = cantidad;
        } else { 
            const conceptoInput = document.getElementById('modal-manual-concepto');
            const montoInput = document.getElementById('modal-manual-monto');
            const concepto = conceptoInput.value;
            const monto = parseFloat(montoInput.value);
            if (!concepto || concepto.trim() === '') { msjError("Concepto obligatorio."); return; }
            if (isNaN(monto) || monto <= 0) { msjError("Monto inválido."); return; }
            payload.concepto = concepto.trim(); payload.monto = monto;
        }

        const respuesta = await postData('/api/deudores/agregar', payload);
        if (respuesta.exito) { 
            ocultarModal(); 
            await Swal.fire({ title: 'Deuda Registrada', text: respuesta.mensaje, icon: 'success', timer: 1500, showConfirmButton: false });
            location.reload(); 
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
        <p><strong>Concepto:</strong> ${concepto}</p>
        <p><strong>Deuda Actual:</strong> $${montoMaximo.toFixed(2)}</p>
        <div class="control-formulario">
            <label for="modal-input-abono">Monto a Pagar (Abono o Liquidación):</label>
            <input type="number" id="modal-input-abono" step="0.01" max="${montoMaximo.toFixed(2)}" value="${montoMaximo.toFixed(2)}" required>
        </div>
        <div class="modal-acciones-especiales" style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
            <button class="btn-tabla" style="background-color: #555;" id="btn-pagar-sin-caja">
                Solo Borrar Deuda (No Caja)
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
            await Swal.fire({ title: 'Pago Procesado', text: respuesta.mensaje, icon: 'success', timer: 1500, showConfirmButton: false });
            location.reload(); 
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
        <p><strong>Deuda Total Actual:</strong> $${totalDeuda.toFixed(2)}</p>
        <div class="control-formulario">
            <label for="modal-input-pago-total">Monto a Pagar:</label>
            <input type="number" id="modal-input-pago-total" step="0.01" max="${totalDeuda.toFixed(2)}" value="${totalDeuda.toFixed(2)}" required>
        </div>
        <div class="modal-acciones-especiales" style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
            <button class="btn-tabla" style="background-color: #555;" id="btn-total-sin-caja">
                Solo Borrar (No Caja)
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
            await Swal.fire({ title: 'Pago Total Procesado', text: respuesta.mensaje, icon: 'success', timer: 1500, showConfirmButton: false });
            location.reload(); 
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
                confirmButtonText: 'Sí, borrar todo'
            });
            if (result.isConfirmed) {
                procesarPagoTotal(false);
            }
        });
    }, 100);
}

// --- LÓGICA DE LA PÁGINA DE HISTORIAL ---
document.addEventListener('DOMContentLoaded', () => {
    const btnDesbloquear = document.getElementById('btn-desbloquear');
    const panelBloqueado = document.getElementById('panel-bloqueado');
    const panelHistorial = document.getElementById('panel-historial');
    let passwordAprobada = ""; // Se guarda temporalmente en la memoria mientras la pestaña esté abierta

    if (btnDesbloquear) {
        btnDesbloquear.addEventListener('click', async () => {
            const { value: pass } = await Swal.fire({
                title: 'Acceso Restringido',
                input: 'password',
                inputLabel: 'Ingrese la contraseña de administrador:',
                inputPlaceholder: 'Contraseña',
                showCancelButton: true,
                confirmButtonText: 'Entrar'
            });

            if (pass) {
                // Hacemos una prueba rápida para ver si es correcta, pidiendo el día de hoy
                const hoy = new Date().toISOString().split('T')[0];
                const respuesta = await postData('/api/obtener_historial', { 
                    password: pass, fecha_inicio: hoy, fecha_fin: hoy 
                });

                if (respuesta.exito) {
                    passwordAprobada = pass; // Guardar contraseña correcta
                    panelBloqueado.style.display = 'none';
                    panelHistorial.style.display = 'block';
                    msjExito("Acceso concedido");
                    // Cargar los datos de este mes por defecto
                    document.getElementById('btn-filtro-mes').click();
                } else {
                    msjError(respuesta.error);
                }
            }
        });

        // Configurar botones de filtro
        document.getElementById('btn-buscar-fechas').addEventListener('click', () => {
            cargarHistorial(document.getElementById('fecha-inicio').value, document.getElementById('fecha-fin').value);
        });

        document.getElementById('btn-filtro-semana').addEventListener('click', () => {
            const hoy = new Date();
            const diaDeLaSemana = hoy.getDay() || 7; // Hacer que Lunes sea 1 y Domingo 7
            const lunes = new Date(hoy);
            lunes.setDate(hoy.getDate() - diaDeLaSemana + 1);
            
            document.getElementById('fecha-inicio').value = lunes.toISOString().split('T')[0];
            document.getElementById('fecha-fin').value = hoy.toISOString().split('T')[0];
            cargarHistorial(lunes.toISOString().split('T')[0], hoy.toISOString().split('T')[0]);
        });

        document.getElementById('btn-filtro-mes').addEventListener('click', () => {
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
                // Actualizar números
                document.getElementById('txt-ingresos').textContent = "$" + respuesta.total_ingresos.toFixed(2);
                document.getElementById('txt-gastos').textContent = "$" + respuesta.total_gastos.toFixed(2);
                document.getElementById('txt-neto').textContent = "$" + respuesta.neto.toFixed(2);

                // Llenar tabla
                const tbody = document.getElementById('tabla-historial-body');
                tbody.innerHTML = ""; // Limpiar tabla
                
                if (respuesta.registros.length === 0) {
                    tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>No hay registros en estas fechas</td></tr>";
                    return;
                }

                respuesta.registros.forEach(reg => {
                    const fila = document.createElement('tr');
                    const colorMonto = reg.es_gasto ? 'color: #CC0000;' : 'color: #00CC00;';
                    const tipoTexto = reg.es_gasto ? 'Gasto 📉' : 'Ingreso 📈';
                    
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
