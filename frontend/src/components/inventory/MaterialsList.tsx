import { useState, useEffect } from 'react';
import { getMaterials, type Material } from '../../services/inventory.service';
import '../../styles/inventory.css';

export default function MaterialsList() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadMaterials = async () => {
      try {
        setLoading(true);
        setError('');
        
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        if (!token) {
          throw new Error('No hay token de autenticación');
        }

        console.log('Cargando materiales desde:', import.meta.env.VITE_API_URL || 'http://localhost:10000');
        const data = await getMaterials(token);
        console.log('Materiales cargados:', data);
        setMaterials(data || []);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error al cargar materiales';
        console.error('Error completo:', errorMsg, err);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    loadMaterials();
  }, []);

  if (loading) {
    return (
      <div className="materials-list">
        <p className="loading">⏳ Cargando materiales...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="materials-list">
        <div className="error-message" style={{ 
          background: '#f8d7da', 
          color: '#721c24', 
          padding: '1rem', 
          borderRadius: '4px',
          border: '1px solid #f5c6cb'
        }}>
          <strong>❌ Error:</strong> {error}
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>
            Asegúrate de que el backend está corriendo en puerto 10000 y que hay datos en la tabla CategoriaMaterial.
          </p>
        </div>
      </div>
    );
  }

  if (!materials || materials.length === 0) {
    return (
      <div className="materials-list">
        <div className="empty-state" style={{ 
          textAlign: 'center', 
          padding: '2rem',
          color: '#666'
        }}>
          <p>📦 No hay materiales registrados aún</p>
        </div>
      </div>
    );
  }

  return (
    <div className="materials-list">
      <h3 style={{ marginTop: 0 }}>Listado de Materiales ({materials.length})</h3>
      <table className="materials-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Unidad</th>
            <th>Stock Actual</th>
            <th>Stock Mínimo</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((material) => {
            const stockActual = Number(material.stockActual);
            const stockMinimo = Number(material.stockMinimo);
            const isBelowMinimum = stockActual < stockMinimo;
            return (
              <tr key={material.id} className={isBelowMinimum ? 'row-warning' : ''}>
                <td className="code">{material.codigo}</td>
                <td>{material.nombre}</td>
                <td>{material.categoria?.nombre || '-'}</td>
                <td>{material.unidad}</td>
                <td className="number">{stockActual.toFixed(2)}</td>
                <td className="number">{stockMinimo.toFixed(2)}</td>
                <td>
                  <span className={`badge badge-${isBelowMinimum ? 'warning' : 'success'}`}>
                    {isBelowMinimum ? 'Bajo Stock' : 'Normal'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
