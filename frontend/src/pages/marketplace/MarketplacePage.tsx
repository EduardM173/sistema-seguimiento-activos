import { useEffect, useMemo, useState } from 'react';
import {
  IconClipboard,
  IconDollarSign,
  IconRefresh,
  IconSearch,
  IconUpload,
} from '../../components/common/Icon';
import {
  createPurchaseRequest,
  getMyPurchaseRequests,
  MarketplaceItem,
  PurchaseRequest,
  searchMarketplaceItems,
} from '../../services/marketplace.service';
import '../../styles/marketplace.css';

export default function MarketplacePage() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedRequests = useMemo(
    () => requests.filter((request) => request.tipo === 'MATERIAL').slice(0, 4),
    [requests],
  );

  useEffect(() => {
    void loadCatalog();
    void loadRequests();
  }, []);

  async function loadCatalog() {
    setLoading(true);
    setError(null);
    try {
      const data = await searchMarketplaceItems('MATERIAL', query);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo');
    } finally {
      setLoading(false);
    }
  }

  async function loadRequests() {
    try {
      setRequests(await getMyPurchaseRequests());
    } catch {
      setRequests([]);
    }
  }

  function openPurchase(item: MarketplaceItem) {
    setSelectedItem(item);
    setCantidad(1);
    setNota('');
    setSuccess(null);
  }

  async function submitPurchase() {
    if (!selectedItem) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await createPurchaseRequest(selectedItem, cantidad, nota);
      setSuccess('Solicitud enviada para revisión');
      setSelectedItem(null);
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la solicitud');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="marketplacePage">
      <header className="marketplaceHeader">
        <div>
          <p className="marketplaceHeader__eyebrow">Compras</p>
          <h1>Catálogo de materiales</h1>
          <p>
            Busca materiales requeridos por la universidad y registra solicitudes para compra externa.
          </p>
        </div>
        <button className="marketplaceButton marketplaceButton--ghost" onClick={() => void loadCatalog()}>
          <IconRefresh size={16} />
          Actualizar
        </button>
      </header>

      <section className="marketplaceToolbar marketplaceToolbar--materials" aria-label="Búsqueda de catálogo">
        <div className="marketplaceScope">
          <IconClipboard size={16} />
          Materiales
        </div>

        <form
          className="marketplaceSearch"
          onSubmit={(event) => {
            event.preventDefault();
            void loadCatalog();
          }}
        >
          <IconSearch size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por necesidad, nombre, código o descripción"
          />
          <button type="submit" className="marketplaceButton marketplaceButton--primary">
            Buscar
          </button>
        </form>

        <label className="marketplaceImageSearch">
          <IconUpload size={16} />
          <span>Imagen</span>
          <input type="file" accept="image/*" disabled />
        </label>
      </section>

      {error ? <div className="marketplaceAlert marketplaceAlert--error">{error}</div> : null}
      {success ? <div className="marketplaceAlert marketplaceAlert--success">{success}</div> : null}

      <div className="marketplaceLayout">
        <section className="marketplaceCatalog" aria-label="Materiales disponibles">
          <div className="marketplaceSectionTitle">
            <h2>Materiales disponibles</h2>
            <span>{loading ? 'Cargando...' : `${items.length} resultados`}</span>
          </div>

          <div className="marketplaceGrid">
            {items.map((item) => (
              <article className="marketplaceCard" key={`${item.kind}-${item.id}`}>
                <div className="marketplaceCard__media">
                  {item.imagenUrl ? (
                    <img src={item.imagenUrl} alt={item.nombre} />
                  ) : (
                    <IconClipboard size={42} />
                  )}
                </div>
                <div className="marketplaceCard__body">
                  <span className="marketplaceCard__code">{item.codigo}</span>
                  <h3>{item.nombre}</h3>
                  <p>{item.descripcion || 'Sin descripción registrada.'}</p>
                  <div className="marketplaceCard__meta">
                    <span>{item.categoria || 'Sin categoría'}</span>
                    <span>{item.detalle || item.estado || 'Disponible'}</span>
                  </div>
                </div>
                <button
                  className="marketplaceButton marketplaceButton--primary marketplaceCard__action"
                  onClick={() => openPurchase(item)}
                >
                  <IconDollarSign size={16} />
                  Comprar
                </button>
              </article>
            ))}
          </div>

          {!loading && items.length === 0 ? (
            <div className="marketplaceEmpty">No hay resultados para la búsqueda actual.</div>
          ) : null}
        </section>

        <aside className="marketplaceRequests" aria-label="Mis solicitudes">
          <div className="marketplaceSectionTitle">
            <h2>Mis solicitudes</h2>
            <span>{selectedRequests.length}</span>
          </div>
          {selectedRequests.map((request) => (
            <div className="marketplaceRequest" key={request.id}>
              <strong>{request.item?.nombre ?? 'Ítem no disponible'}</strong>
              <span>{request.estado}</span>
              <small>
                {request.cantidad} unidad(es) · {new Date(request.creadoEn).toLocaleDateString()}
              </small>
            </div>
          ))}
          {selectedRequests.length === 0 ? (
            <div className="marketplaceEmpty marketplaceEmpty--compact">
              Todavía no tienes solicitudes de este tipo.
            </div>
          ) : null}
        </aside>
      </div>

      {selectedItem ? (
        <div className="marketplaceModal" role="dialog" aria-modal="true">
          <div className="marketplaceModal__panel">
            <h2>Solicitar compra</h2>
            <p>
              {selectedItem.codigo} · {selectedItem.nombre}
            </p>
            <label>
              Cantidad
              <input
                type="number"
                min={1}
                max={9999}
                value={cantidad}
                onChange={(event) => setCantidad(Number(event.target.value))}
              />
            </label>
            <label>
              Nota
              <textarea
                value={nota}
                onChange={(event) => setNota(event.target.value)}
                placeholder="Motivo, uso esperado o especificación adicional"
              />
            </label>
            <div className="marketplaceModal__actions">
              <button className="marketplaceButton marketplaceButton--ghost" onClick={() => setSelectedItem(null)}>
                Cancelar
              </button>
              <button className="marketplaceButton marketplaceButton--primary" onClick={() => void submitPurchase()} disabled={submitting}>
                {submitting ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
