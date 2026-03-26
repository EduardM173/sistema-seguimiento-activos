import React, { useState, useEffect } from 'react';
import { DataTable, SearchBar, Button, Badge, Alert } from '../../components/common';
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

  const getEstadoColor = (estado: string): any => {
    const colores: Record<string, any> = {
      'activo': 'success',
      'inactivo': 'secondary',
      'bloqueado': 'danger',
      'pendiente': 'warning',
    };
    return colores[estado] || 'secondary';
  };

  const columns = [
    {
      header: 'Nombre',
      accessor: (row: Usuario) => `${row.nombres} ${row.apellidos}`,
    },
    { header: 'Correo', accessor: 'correo' },
    { header: 'Usuario', accessor: 'nombreUsuario' },
    {
      header: 'Rol',
      accessor: (row: Usuario) => row.rol?.nombre || 'N/A',
    },
    {
      header: 'Estado',
      accessor: 'estado',
      render: (value: string) => (
        <Badge label={value.toUpperCase()} variant={getEstadoColor(value)} size="sm" />
      ),
    },
    { header: 'Área', accessor: (row: Usuario) => row.area?.nombre || 'N/A' },
    {
      header: 'Acciones',
      accessor: 'id',
      render: (id: string) => (
        <div className="actions-group">
          <button className="btn-action btn-view" title="Ver detalles">👁️</button>
          <button className="btn-action btn-edit" title="Editar">✏️</button>
        </div>
      ),
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
        <DataTable<Usuario>
          columns={columns}
          data={usuarios}
          loading={loading}
          emptyMessage="No hay usuarios registrados"
          striped
          hover
        />
      </div>
    </div>
  );
};

export default UsuariosPage;
