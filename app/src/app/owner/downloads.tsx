import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import { today } from '@/lib/dates';
import { openUrl } from '@/lib/share';
import { useApi } from '@/lib/useApi';
import type { Project } from '@/lib/types';
import { BigButton, Card, ChipPicker, ErrorText, Muted, Screen, SectionTitle } from '@/ui/components';

/** Indian financial years (April–March): the current one and the two before it. */
function recentYears(): string[] {
  const [y, m] = today().split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return [0, 1, 2].map((k) => `${start - k}-${String((start - k + 1) % 100).padStart(2, '0')}`);
}

export default function Downloads() {
  const { t } = useTranslation();
  const projects = useApi<Project[]>('/projects');
  const years = recentYears();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [fy, setFy] = useState<string>(years[0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(key: string, body: Record<string, unknown>) {
    setBusy(key);
    setError(null);
    try {
      const { url } = await api<{ url: string }>('/exports/link', { method: 'POST', body });
      openUrl(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const ps = projects.data ?? [];
  return (
    <Screen>
      <Muted>{t('downloads.note')}</Muted>

      <SectionTitle icon="business">{t('downloads.project')}</SectionTitle>
      <Card>
        <Muted>{t('downloads.pickProject')}</Muted>
        <ChipPicker options={ps.map((p) => p.id)} value={projectId} onChange={setProjectId} labelOf={(id) => ps.find((p) => p.id === id)?.name ?? ''} />
        <BigButton
          label={t('downloads.projectStatement')}
          icon="document-text"
          disabled={!projectId}
          busy={busy === 'ps'}
          onPress={() => download('ps', { kind: 'project', project_id: projectId })}
        />
        <BigButton
          label={t('downloads.projectBills')}
          icon="images"
          variant="secondary"
          disabled={!projectId}
          busy={busy === 'pb'}
          onPress={() => download('pb', { kind: 'bills', project_id: projectId })}
        />
      </Card>

      <SectionTitle icon="calendar">{t('downloads.year')}</SectionTitle>
      <Card>
        <Muted>{t('downloads.pickYear')}</Muted>
        <ChipPicker options={years} value={fy} onChange={setFy} labelOf={(y) => `FY ${y}`} />
        <BigButton label={t('downloads.yearStatement')} icon="document-text" busy={busy === 'ys'} onPress={() => download('ys', { kind: 'year', fy })} />
        <BigButton label={t('downloads.yearBills')} icon="images" variant="secondary" busy={busy === 'yb'} onPress={() => download('yb', { kind: 'bills', fy })} />
      </Card>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
