import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ExplainExpense } from '@/features/bank/ExplainExpense';
import { api } from '@/lib/api';
import { showDate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import type { BankTxn, Project } from '@/lib/types';
import { BigButton, Card, ChipPicker, ErrorText, Loading, Muted, Screen, StatusChip, Title } from '@/ui/components';
import { Text } from '@/ui/Text';
import { colors, font } from '@/ui/theme';

type Candidate = { kind: 'expense' | 'payment'; id: string; date: string; label: string };

/** Explain one bank line: already recorded, business payment / customer payment, cash, or personal. */
export default function ExplainBankLine() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const txn = useApi<BankTxn>(`/bank/txns/${id}`);
  const cands = useApi<Candidate[]>(`/bank/txns/${id}/candidates`);
  const projects = useApi<Project[]>('/projects');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(key: string, path: string, body?: object) {
    setBusy(key);
    setError(null);
    try {
      await api(`/bank/txns/${id}/${path}`, { method: 'POST', body });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const x = txn.data;
  if (!x) return <Loading />;
  const out = x.direction === 'debit';
  const s = x.suggestion;
  const site = projectId ?? s?.project_id ?? null;
  const ps = projects.data ?? [];

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: font.big, fontWeight: '800', color: out ? colors.text : colors.good }}>
          {out ? '−' : '+'}
          {formatINR(x.amount_paise)}
        </Text>
        <Muted>{`${showDate(x.txn_date)} · ${out ? t('bank.paidOut') : t('bank.received')}`}</Muted>
        {x.counterparty && <Text style={{ fontSize: font.body, fontWeight: '700' }}>{x.counterparty}</Text>}
        <Muted>{x.narration}</Muted>
        {x.ref && <Muted>{`${t('books.txnId')}: ${x.ref}`}</Muted>}
        {x.status !== 'to_explain' && (
          <StatusChip tone={x.status === 'done' ? 'good' : 'neutral'} label={x.linked?.label ?? t(`bank.tab_${x.status}`)} />
        )}
      </Card>

      {x.status !== 'to_explain' ? (
        (x.status === 'personal' || x.auto_matched) && (
          <BigButton label={t('bank.reopen')} icon="refresh" variant="secondary" busy={busy === 'reopen'} onPress={() => act('reopen', 'reopen')} />
        )
      ) : (
        <>
          {(cands.data ?? []).length > 0 && (
            <Card>
              <Title>{t('bank.alreadyRecorded')}</Title>
              {cands.data!.map((c) => (
                <BigButton
                  key={c.id}
                  label={`${c.label} · ${showDate(c.date)}`}
                  icon="link"
                  variant="secondary"
                  busy={busy === c.id}
                  onPress={() => act(c.id, 'link', c.kind === 'expense' ? { expense_id: c.id } : { payment_id: c.id })}
                />
              ))}
            </Card>
          )}

          {s?.kind === 'cash' && (
            <BigButton
              label={out ? t('bank.cashWithdrawal') : t('bank.cashDeposit')}
              icon="wallet"
              busy={busy === 'cash'}
              onPress={() => act('cash', 'cash')}
            />
          )}

          {out ? (
            <ExplainExpense txn={x} onDone={() => router.back()} />
          ) : (
            <Card>
              <Title>{t('bank.customerPayment')}</Title>
              <Muted>{t('bank.whichProject')}</Muted>
              <ChipPicker options={ps.map((p) => p.id)} value={site} onChange={setProjectId} labelOf={(pid) => ps.find((p) => p.id === pid)?.name ?? ''} />
              <BigButton
                label={t('books.save')}
                icon="checkmark"
                disabled={!site}
                busy={busy === 'receipt'}
                onPress={() => act('receipt', 'receipt', { project_id: site, milestone_id: site === s?.project_id ? s?.milestone_id : null })}
              />
            </Card>
          )}

          {s?.kind !== 'cash' && (
            <BigButton
              label={out ? t('bank.cashWithdrawal') : t('bank.cashDeposit')}
              icon="wallet"
              variant="secondary"
              busy={busy === 'cash'}
              onPress={() => act('cash', 'cash')}
            />
          )}
          <BigButton label={t('bank.personal')} icon="home" variant="secondary" busy={busy === 'personal'} onPress={() => act('personal', 'personal')} />
          <Muted>{t('bank.personalHelp')}</Muted>
        </>
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
