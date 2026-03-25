import { useEffect, useState } from 'react';

import { getAssets, type AssetItem } from '../services/assets.service';

import '../styles/assets.css';

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAssets = async () => {
      try {
        setLoading(true);
        setError('');

        const data = await getAssets();
        setAssets(data);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'No se pudo cargar la lista de activos';

        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadAssets();
  }, []);

  return (
    <section className="assetsPage">
      <header className="assetsPage__header">
        <div>
          <h1 className="assetsPage__title">Gestión de Activos</h1>
          <p className="assetsPage__subtitle">
            Consulta la lista de activos registrados para tener una visión
            general del inventario disponible.
          </p>
        </div>
      </header>

      <div className="assetsCard">
        {loading ? (
          <div className="assetsState">
            <p className="assetsState__text">Cargando activos registrados...</p>
          </div>
        ) : error ? (
          <div className="assetsState assetsState--error">
            <p className="assetsState__text">{error}</p>
          </div>
        ) : assets.length === 0 ? (
          <div className="assetsState">
            <p className="assetsState__text">
              No existen activos registrados.
            </p>
          </div>
        ) : (
          <>
            <div className="assetsTableWrapper">
              <table className="assetsTable">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Activo</th>
                    <th>Estado</th>
                    <th>Ubicación</th>
                  </tr>
                </thead>

                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id}>
                      <td className="assetsTable__code">{asset.codigo}</td>
                      <td>{asset.nombre}</td>
                      <td>
                        <span className="statusBadge">
                          {asset.estado}
                        </span>
                      </td>
                      <td>{asset.ubicacion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="assetsFooter">
              <span>
                Mostrando {assets.length} activo{assets.length !== 1 ? 's' : ''}{' '}
                registrado{assets.length !== 1 ? 's' : ''}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}