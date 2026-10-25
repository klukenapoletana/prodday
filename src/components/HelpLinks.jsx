// Where to find help: the docs (the original's), and the project. Shared
// by the header's Help & Feedback dialog and Settings → About & Help (#2075),
// so the two cannot drift apart.
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function HelpLinks({ textSecondary }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5" data-help-links>
      {/* Docs */}
      <div>
        <p className={`text-xs font-semibold uppercase tracking-wide ${textSecondary} mb-2`}>{t('app.documentation')}</p>
        <a
          href="https://docs.dayglance.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-blue-500 hover:text-blue-400 transition-colors text-sm font-medium"
        >
          <ExternalLink size={14} />
          docs.dayglance.app
        </a>
      </div>

      {/* prodday's own repository, and the original it is built on. The
          original's support address, issue tracker and legal pages are not
          prodday's: problems with prodday are not reported there (README). */}
      <div>
        <p className={`text-xs font-semibold uppercase tracking-wide ${textSecondary} mb-2`}>{t('app.project')}</p>
        <a
          href="https://github.com/klukenapoletana/prodday"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-blue-500 hover:text-blue-400 transition-colors text-sm font-medium"
        >
          <ExternalLink size={14} />
          {t('app.projectOnGithub')}
        </a>
        <a
          href="https://github.com/krelltunez/dayGLANCE"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-blue-500 hover:text-blue-400 transition-colors text-sm font-medium mt-1.5"
        >
          <ExternalLink size={14} />
          {t('app.basedOn')}
        </a>
      </div>
    </div>
  );
}
