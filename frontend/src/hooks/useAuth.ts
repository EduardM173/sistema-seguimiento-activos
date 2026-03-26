// Re-export useAuth from the single canonical AuthContext so all consumers
// (whether they import from '../../context/AuthContext' or '../../hooks')
// share the same React Context state.
import { useAuth } from '../context/AuthContext';

export { useAuth };
export default useAuth;
