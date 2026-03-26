import React from 'react';
import '../../styles/components.css';

interface SearchBarProps {
  onSearch: (term: string) => void;
  placeholder?: string;
  debounceMs?: number;
  showFilters?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = 'Buscar...',
  debounceMs = 300,
  showFilters = false,
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      onSearch(value);
    }, debounceMs);
  };

  const handleClear = () => {
    setSearchTerm('');
    onSearch('');
  };

  return (
    <div className="search-bar-container">
      <div className="search-bar">
        <input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="search-input"
        />
        {searchTerm && (
          <button className="search-clear" onClick={handleClear}>
            ✕
          </button>
        )}
        <span className="search-icon">🔍</span>
      </div>
      {showFilters && (
        <button className="search-filter-btn">
          Filtros
        </button>
      )}
    </div>
  );
};

export default SearchBar;
