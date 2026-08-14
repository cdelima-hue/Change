# 📘 Manual de Usuario Paso a Paso: Gestión de Changes y Capacidad

Este manual describe en detalle cada uno de los campos que componen el **Portal de Control de Changes y Capacidad**, quién debe llenarlos, cómo se calculan las reglas de negocio y las mejores prácticas para su registro.

---

## 🎯 Reglas Fundamentales del Equipo

1. **Capacidad Mensual (160 Horas / Mes)**: Bolsa fija de 160 horas por mes compartida entre todos los productos de negocio para mejoras continuas.
2. **Límite Estricto de 30 Horas ($\le 30$h)**:
   - Toda Change debe ser de **máximo 30 horas** (30 horas es aceptable).
   - Requerimientos que superen las 30 horas son considerados proyectos y quedan fuera del alcance de este equipo (se derivan al área de proyectos/desarrollo mayor).

---

## 📑 Índice de Secciones

1. [Datos Generales y de Negocio (Solicitante y Servicio)](#1-datos-generales-y-de-negocio)
2. [Identificación y Producto](#2-identificación-y-producto)
3. [Pasos de Implementación Estructurados por Fase](#3-pasos-de-implementación-por-fase)
4. [Análisis Técnico y Estimación de Horas (Regla de $\le$ 30h)](#4-análisis-técnico-y-estimación)
5. [Aprobación del Negocio (PO / Aprobador)](#5-aprobación-del-negocio)
6. [Cronograma de las 8 Fases](#6-cronograma-de-las-8-fases)
7. [Filtros y Búsquedas en el Portal](#7-filtros-y-búsquedas)

---

## 1. Datos Generales y de Negocio

| Campo | Tipo | ¿Obligatorio? | ¿Quién lo llena? | Descripción y Ejemplo |
| :--- | :--- | :--- | :--- | :--- |
| **Solicitante** | Texto | **Sí** | Negocio / Solicitante | Nombre y apellido de quien solicita la mejora.<br>*Ejemplo:* `Andrés Delgado`. |
| **Business Service** | Texto | **Sí** | Negocio / Solicitante | Servicio o dominio de negocio correspondiente.<br>*Ejemplo:* `E-Commerce & Sales`, `Supply Chain`, `CRM`, `Facturación`. |

---

## 2. Identificación y Producto

| Campo | Tipo | ¿Obligatorio? | ¿Quién lo llena? | Descripción y Ejemplo |
| :--- | :--- | :--- | :--- | :--- |
| **Número de Change** | Texto | **Sí** | IT / Gestión de Cambio | Código único oficial de la Change (ServiceNow / Remedy).<br>*Ejemplo:* `CHG0089201`. |
| **RITM / Requerimiento** | Texto | Opcional | Solicitante / IT | Código del ítem del catálogo de servicios asociado.<br>*Ejemplo:* `RITM0145220`. |
| **Producto / Línea** | Texto | **Sí** | Negocio / IT | Producto o plataforma que sufrirá la modificación.<br>*Ejemplo:* `Nescafé E-Commerce`, `Purina Pro Plan`, `KitKat Club Digital`. |
| **Descripción / Resumen** | Texto largo | **Sí** | Solicitante | Resumen ejecutivo del objetivo de negocio.<br>*Ejemplo:* `Optimización del checkout B2B y cálculo automático de impuestos por región`. |

---

## 3. Pasos de Implementación por Fase

Permite estructurar las tareas con sus tiempos y fechas tentativas:
- **Fase**: Etapa técnica (ej. *1. Análisis Técnico, 3. Desarrollo Backend, 6. Pruebas QA, 8. Despliegue*).
- **¿Cuál acción?**: Tarea técnica o funcional a ejecutar.
- **Tiempo en Horas**: Horas estimadas para esa fase.
- **Fecha Tentativa**: Fecha proyectada de entrega.

> 💡 **Cálculo Automático**: Al ingresar o modificar horas en la tabla de pasos, el sistema suma automáticamente el valor y actualiza el campo **Total Horas Estimadas** y la validación del límite de $\le 30$h.

---

## 4. Análisis Técnico y Estimación

| Campo | Tipo | ¿Obligatorio? | ¿Quién lo llena? | Descripción y Regla de Negocio |
| :--- | :--- | :--- | :--- | :--- |
| **Ingeniero Asignado** | Texto | Recomendado | Líder Técnico | Desarrollador o analista responsable.<br>*Ejemplo:* `Carlos Mendoza`. |
| **Total Horas Estimadas** | Número | **Sí** | Ingeniero | Suma del esfuerzo técnico.<br>• **$\le$ 30 horas**: Válido para el equipo (Small Enhancement).<br>• **> 30 horas**: Fuera de alcance (se alerta que excede el límite). |
| **Horas Aprobadas por Comité** | Número | **Sí (en fase 4/6)** | Comité de Change | Horas autorizadas descontadas de la bolsa mensual de 160h. |
| **Entendimiento Técnico** | Texto largo | Opcional | Ingeniero | Detalles de arquitectura o endpoints. |
| **Plan de Rollback** | Texto largo | **Sí** | Ingeniero | Plan de reversión en caso de contingencia durante el pase a producción. |

---

## 5. Aprobación del Negocio

| Campo | Tipo | ¿Obligatorio? | ¿Quién lo llena? | Descripción y Ejemplo |
| :--- | :--- | :--- | :--- | :--- |
| **Nombre Aprobador** | Texto | Recomendado | Product Owner / Negocio | Responsable de negocio que valida la entrega.<br>*Ejemplo:* `Mariana Silva`. |
| **Email Aprobador** | Email | Recomendado | Negocio | Correo corporativo del aprobador.<br>*Ejemplo:* `mariana.silva@nestle.com`. |
| **Estado de Aprobación** | Selección | **Sí** | PO / Comité | `Pendente`, `Aprovado` o `Rejeitado`. |

---

## 6. Cronograma de las 8 Fases

Se registran las fechas efectivas de conclusión de cada etapa:
1. `1. Abertura` $\rightarrow$ 2. `2. Reunião` $\rightarrow$ 3. `3. Análise` $\rightarrow$ 4. `4. Comitê` $\rightarrow$ 5. `5. Apresentação` $\rightarrow$ 6. `6. Aprovação` $\rightarrow$ 7. `7. Execução` $\rightarrow$ 8. `8. Concluída`.

---

## 7. Filtros y Búsquedas en el Portal

En la barra superior en una sola fila puedes filtrar por:
- **Periodo (Mes/Año)**: Consulta la capacidad mensual de 160h de cualquier mes.
- **Solicitante**: Visualiza solo las solicitudes de una persona.
- **Business Service**: Filtra por área o servicio (ej. *E-Commerce, Supply Chain*).
- **Producto**: Consulta el consumo de una marca específica.
- **Estado**: Filtra por solicitudes *Aprobadas*, *Pendientes* o *Rechazadas*.
