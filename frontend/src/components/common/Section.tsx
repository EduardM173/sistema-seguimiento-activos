import React from 'react';
import './Section.css';

interface SectionProps {
  /** Small uppercase eyebrow label. */
  title?: string;
  /** Right-aligned slot. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Drop the divider between title and content. */
  noDivider?: boolean;
}

/**
 * Haptic floating section. Eyebrow title (cyan, uppercase, hairline divider),
 * no card box. Use as the standard page-content wrapper.
 */
export const Section: React.FC<SectionProps> = ({
  title,
  actions,
  children,
  className = '',
  noDivider = false,
}) => {
  return (
    <section className={`hp-section ${className}`.trim()}>
      {(title || actions) && (
        <header className={`hp-section__header ${noDivider ? '' : 'hp-section__header--divider'}`.trim()}>
          {title && <h2 className="hp-section__title">{title}</h2>}
          {actions && <div className="hp-section__actions">{actions}</div>}
        </header>
      )}
      <div className="hp-section__body">{children}</div>
    </section>
  );
};

export default Section;
