import { AlertTriangle, Check } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  type?: 'warning' | 'info' | 'danger';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  type = 'warning',
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" style={{ maxWidth: '320px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ border: 'none', paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {type === 'danger' && <AlertTriangle size={20} style={{ color: 'var(--rose)' }} />}
            {type === 'info' && <Check size={20} style={{ color: 'var(--sage)' }} />}
            {type === 'warning' && <AlertTriangle size={20} style={{ color: 'var(--amber)' }} />}
            <h3>{title || '提示'}</h3>
          </div>
          <button onClick={onCancel} className="modal-close-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>
        <div className="modal-body" style={{ paddingTop: '10px' }}>
          <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{message}</p>
        </div>
        <div className="modal-footer">
          {cancelText && (
            <button className="btn-secondary" onClick={onCancel}>
              {cancelText}
            </button>
          )}
          <button 
            className="btn-primary" 
            onClick={onConfirm}
            style={type === 'danger' ? { background: 'var(--rose)' } : {}}
          >
            <Check size={16} /> {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
