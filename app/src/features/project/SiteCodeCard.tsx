import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import type { Project } from '@/lib/types';
import { BigButton, Card, ErrorText, Field, Muted, Title } from '@/ui/components';
import { Text } from '@/ui/Text';
import { colors, font } from '@/ui/theme';

/** The short code to type in UPI remarks ("TAM cement") so bank lines file themselves under this site. */
export function SiteCodeCard({ project: p, onChanged }: { project: Project; onChanged: () => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(p.site_code ?? '');
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    try {
      await api(`/projects/${p.id}`, { method: 'PATCH', body: { site_code: code.trim() } });
      setEditing(false);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Card>
      <Title>{t('bank.siteCode')}</Title>
      {editing ? (
        <>
          <Field label={t('bank.siteCode')} value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" maxLength={8} />
          <ErrorText>{error}</ErrorText>
          <BigButton label={t('books.save')} icon="checkmark" onPress={save} disabled={!/^[A-Z0-9]{2,8}$/.test(code.trim())} />
        </>
      ) : (
        <>
          <Text style={{ fontSize: font.big, fontWeight: '800', color: colors.brand, letterSpacing: 2 }}>{p.site_code ?? '—'}</Text>
          <Muted>{t('bank.siteCodeHelp', { code: p.site_code ?? 'TAM' })}</Muted>
          <BigButton label={t('bank.changeCode')} icon="create" variant="secondary" onPress={() => setEditing(true)} />
        </>
      )}
    </Card>
  );
}
