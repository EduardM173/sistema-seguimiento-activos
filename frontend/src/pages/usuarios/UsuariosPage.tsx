import React, { useState, useEffect } from 'react';
import { SearchBar, Button, Badge, Alert } from '../../components/common';
import { SmartTable } from '../../components/common/SmartTable';
import type { ColumnDef, ActionDef } from '../../components/common/SmartTable';
import type { Usuario } from '../../types/usuarios.types';
import { usuariosService } from '../../services/usuarios.service';
import '../../styles/modules.css';

export const UsuariosPage: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const resultado = await usuariosService.obtenerTodos();
      setUsuarios(resultado.data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al cargar usuarios' });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getEstadoColor = (estado: string): 'success' | 'secondary' | 'danger' | 'warning' => {
    const colores: Record<string, 'success' | 'secondary' | 'danger' | 'warning'> = {
      activo: 'success',
      inactivo: 'secondary',
      bloqueado: 'danger',
      pendiente: 'warning',
    };
    return colores[estado] ?? 'secondary';
  };

  const columns: ColumnDef<Usuario>[] = [
    {
      id: 'nombre',
      header: 'Nombre',
      accessor: (row) => `${row.nombres} ${row.apellidos}`,
      primary: true,
      width: 200,
    },
    { id: 'correo',        header: 'Correo',   accessor: 'correo',        width: 200 },
    { id: 'nombreUsuario', header: 'Usuario',  accessor: 'nombreUsuario', width: 140 },
    {
      id: 'rol',
      header: 'Rol',
      accessor: (row) => row.rol?.nombre ?? 'N/A',
      width: 140,
    },
    {
      id: 'estado',
      header: 'Estado',
      accessor: 'estado',
      width: 110,
      render: (value) => (
        <Badge
          label={String(value).toUpperCase()}
          variant={getEstadoColor(String(value))}
          size="sm"
        />
      ),
    },
    {
      id: 'area',
      header: 'Área',
      accessor: (row) => row.area?.nombre ?? 'N/A',
      width: 150,
    },
  ];

  const actions: ActionDef<Usuario>[] = [
    {
      label: 'Ver detalles',
      icon: '👁️',
      onClick: (_usuario) => {
        // TODO: abrir panel de detalle
      },
    },
    {
      label: 'Editar',
      icon: '✏️',
      onClick: (_usuario) => {
        // TODO: abrir formulario de edición
      },
    },
  ];

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Gestión de Usuarios</h1>
        <Button label="+ Nuevo Usuario" variant="primary" />
      </div>

      {message && (
        <Alert
          type={message.type}
          message={message.text}
          dismissible
          onClose={() => setMessage(null)}
        />
      )}

      <div className="module-list">
        <div className="list-header">
          <SearchBar
            onSearch={() => {}}
            placeholder="Buscar usuarios por nombre o correo..."
            showFilters
          />
        </div>
        <div className="assetsTable__wrap">
          <SmartTable<Usuario>
            columns={columns}
            data={usuarios}
            loading={loading}
            keyExtractor={(u) => u.id}
            emptyMessage="No hay usuarios registrados"
            actions={actions}
          />
        </div>
      </div>
    </div>
  );
};

export default UsuariosPage;
