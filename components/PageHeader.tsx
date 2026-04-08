import type { ReactNode } from 'react';

export const PAGE_MAIN_CLASSES = 'px-4 md:px-5 lg:px-6 py-5 md:py-6 w-full min-w-0';

type StickyVariant = 'default' | 'muted' | 'blur';

export type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  /** Breadcrumb / back link above the title */
  lead?: ReactNode;
  /** Right-side actions (toolbar buttons, links) */
  actions?: ReactNode;
  /** Full-width block below the title row (e.g. exam countdown) */
  children?: ReactNode;
  sticky?: StickyVariant;
  className?: string;
};

/**
 * Shared sticky page header: consistent padding, title scale, and sticky z-index with the rest of the app.
 */
export default function PageHeader({
  title,
  subtitle,
  lead,
  actions,
  children,
  sticky = 'default',
  className = '',
}: PageHeaderProps) {
  const stickyClass = sticky === 'muted' ? 'app-page-header-muted' : 'app-page-header';
  const surface = sticky === 'blur' ? 'app-header-surface-blur backdrop-blur-md' : 'app-header-surface';

  return (
    <header className={`${surface} border-b border-[var(--border-default)] ${stickyClass} ${className ?? ''}`.trim()}>
      <div className="px-4 md:px-5 lg:px-6 py-4 md:py-5 w-full min-w-0">
        {lead ? <div className="mb-2">{lead}</div> : null}
        <div className="flex flex-col gap-3 min-w-0 xl:flex-row xl:items-start xl:justify-between xl:gap-6">
          <div className="min-w-0">
            <h1 className="font-heading font-bold text-2xl md:text-[1.65rem] text-[var(--foreground)] tracking-tight">{title}</h1>
            {subtitle != null && subtitle !== '' ? (
              <div className="text-sm text-[var(--text-muted)] mt-1 font-body leading-relaxed">{subtitle}</div>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2 min-w-0 xl:shrink-0 xl:justify-end">{actions}</div>
          ) : null}
        </div>
        {children ? <div className="mt-4 w-full min-w-0">{children}</div> : null}
      </div>
    </header>
  );
}
