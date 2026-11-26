import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { parseDate, showDate, toDMY } from '@/lib/dates';
import { Field, Muted } from './components';

/**
 * Date typed as DD/MM/YYYY. Reports YYYY-MM-DD (or '' when empty, null when not a valid date).
 * Shows the date in words under the box so a wrong day/month swap is easy to spot.
 */
export function DateField({
  label,
  initial,
  onChange,
}: {
  label: string;
  initial?: string | null; // YYYY-MM-DD
  onChange: (iso: string | null | '') => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(toDMY(initial));
  const iso = text.trim() ? parseDate(text) : '';

  return (
    <>
      <Field
        label={label}
        value={text}
        placeholder="DD/MM/YYYY"
        keyboardType="numbers-and-punctuation"
        onChangeText={(v) => {
          setText(v);
          onChange(v.trim() ? parseDate(v) : '');
        }}
      />
      {iso ? <Muted>{showDate(iso)}</Muted> : iso === null ? <Muted>{t('common.badDate')}</Muted> : null}
    </>
  );
}
