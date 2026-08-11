import { useState } from 'react';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';
import type { ConfirmModalProps } from '../../types';

export const ConfirmModal = ({
  isOpen,
  title = 'Confirmação',
  message = 'Tem certeza que deseja prosseguir com esta ação?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmVariant = 'danger',
  isPrompt = false,
  promptPlaceholder = '',
  promptValue = '',
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  const [inputValue, setInputValue] = useState(promptValue || '');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (isPrompt) {
      onConfirm(inputValue);
    } else {
      onConfirm();
    }
  };

  const getButtonBg = () => {
    if (confirmVariant === 'danger') return '#EF4444';
    if (confirmVariant === 'success') return '#10B981';
    return 'var(--primary)';
  };

  return (
    <div className="modal-overlay" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      <div className="modal-card" style={{
        maxWidth: 440,
        borderRadius: 16,
        padding: '1.75rem',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        animation: 'modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', marginBottom: '1rem' }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: confirmVariant === 'danger' ? '#FEE2E2' : '#E0F2FE',
            color: confirmVariant === 'danger' ? '#EF4444' : 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {confirmVariant === 'danger' ? <AlertTriangle size={24} /> : <HelpCircle size={24} />}
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.15rem', fontWeight: 700 }}>
              {title}
            </h3>
            <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.45 }}>
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2 }}
          >
            <X size={20} />
          </button>
        </div>

        {isPrompt && (
          <div style={{ marginBottom: '1.25rem' }}>
            <input
              type="text"
              autoFocus
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={promptPlaceholder}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: 8,
                border: '1.5px solid var(--border-color)',
                fontSize: '0.95rem',
                outline: 'none',
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              background: '#F8FAFC',
              color: '#475569',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: 8,
              border: 'none',
              background: getButtonBg(),
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};