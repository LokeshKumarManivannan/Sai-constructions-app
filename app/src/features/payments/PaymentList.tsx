import { useTranslation } from 'react-i18next';

import type { Payment, Role } from '@/lib/types';
import { Muted, Title } from '@/ui/components';
import { PaymentRow } from './PaymentRow';

/** Entries waiting for this viewer first, then the full history. */
export function PaymentList({ payments, viewer, onChanged }: { payments: Payment[]; viewer: Role; onChanged: () => void }) {
  const { t } = useTranslation();
  const mine = payments.filter((p) => p.can_confirm);
  const rest = payments.filter((p) => !p.can_confirm);
  return (
    <>
      {mine.length > 0 && <Title>{t('payments.needsYou')}</Title>}
      {mine.map((p) => (
        <PaymentRow key={p.id} p={p} viewer={viewer} onChanged={onChanged} />
      ))}
      <Title>{t('payments.history')}</Title>
      {rest.length === 0 && <Muted>{t('payments.noPayments')}</Muted>}
      {rest.map((p) => (
        <PaymentRow key={p.id} p={p} viewer={viewer} onChanged={onChanged} />
      ))}
    </>
  );
}
