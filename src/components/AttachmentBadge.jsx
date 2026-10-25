import React from 'react';
import { Paperclip } from 'lucide-react';
import { attachmentsOf } from '../utils/attachments.js';

/** A paperclip with the count, on a card whose task has attachments (utils/attachments.js). */
const AttachmentBadge = ({ task, size = 12, className = '' }) => {
  const count = attachmentsOf(task).length;
  if (!count) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 align-middle text-[11px] leading-none ${className}`} data-attachment-badge>
      <Paperclip size={size} />{count}
    </span>
  );
};

export default AttachmentBadge;
