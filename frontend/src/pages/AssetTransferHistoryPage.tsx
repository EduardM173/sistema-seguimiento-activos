import { Navigate, useNavigate, useParams } from 'react-router-dom';

import AssetTransferHistoryModal from '../components/assets/AssetTransferHistoryModal';

export default function AssetTransferHistoryPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <Navigate to="/activos" replace />;
  }

  return (
    <AssetTransferHistoryModal
      assetId={id}
      open
      onClose={() => navigate('/activos')}
    />
  );
}
