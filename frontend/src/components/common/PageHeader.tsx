import React from 'react';
import './PageHeader.css';

interface PageHeaderProps {
  /** Massive bold display title. */
  title: string;
  /** Small secondary text below title. Optional. */
  subtitle?: string;
  /** Tiny uppercase eyebrow above title (cyan). Optional. */
  eyebrow?: string;
  /** Right-aligned slot — actions, primary CTA, etc. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Haptic-style page header. Floating typography, no box.
 * Usage:
 *   <PageHeader eyebrow="Inventario" title="Materiales" subtitle="..." actions={<Button .../>} />
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  eyebrow,
  actions,
  className = '',
}) => {
  return (
    <header className={`page-header ${className}`.trim()}>
      <div className="page-header__text">
        {eyebrow && <div className="page-header__eyebrow">{eyebrow}</div>}
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
};

export default PageHeader;
