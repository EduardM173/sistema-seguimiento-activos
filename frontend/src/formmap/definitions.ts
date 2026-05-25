/**
 * FormMap definitions — registers every wizard-capable form.
 *
 * Import this module as a side-effect to populate the registry:
 *   import './formmap/definitions';
 */

import { formMapRegistry } from './registry';

// ─── create-asset ─────────────────────────────────────────────────────────────

formMapRegistry.register({
  formId: 'create-asset',
  title: 'Crear activo',
  fields: [
    {
      name: 'nombre',
      label: 'Nombre del activo',
      type: 'text',
      required: true,
      prefillParam: 'prefill_nombre',
    },
    {
      name: 'categoriaId',
      label: 'Categoría',
      type: 'select',
      required: true,
      optionsSource: 'categorias',
      prefillParam: 'prefill_categoriaId',
    },
    {
      name: 'marca',
      label: 'Marca',
      type: 'text',
      required: false,
      prefillParam: 'prefill_marca',
    },
    {
      name: 'modelo',
      label: 'Modelo',
      type: 'text',
      required: false,
      prefillParam: 'prefill_modelo',
    },
    {
      name: 'numeroSerie',
      label: 'Número de serie',
      type: 'text',
      required: false,
      prefillParam: 'prefill_numeroSerie',
    },
    {
      name: 'ubicacionId',
      label: 'Ubicación física',
      type: 'select',
      required: false,
      optionsSource: 'ubicaciones',
      prefillParam: 'prefill_ubicacionId',
    },
    {
      name: 'estado',
      label: 'Estado inicial',
      type: 'select',
      required: false,
      options: [
        { value: 'OPERATIVO', label: 'Operativo' },
        { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
        { value: 'FUERA_DE_SERVICIO', label: 'Fuera de Servicio' },
      ],
      prefillParam: 'prefill_estado',
    },
    {
      name: 'descripcion',
      label: 'Descripción',
      type: 'textarea',
      required: false,
      prefillParam: 'prefill_descripcion',
    },
  ],
});
