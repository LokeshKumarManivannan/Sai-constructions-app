import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';

import { BankRow } from '@/features/bank/BankRow';
import { ApiError, postFile } from '@/lib/api';
import { showDate } from '@/lib/dates';
import { useApi } from '@/lib/useApi';
import type { BankImport, BankStatus, BankSummary, BankTxn } from '@/lib/types';
import { BigButton, Card, ChipPicker, Empty, ErrorText, Field, Loading, Muted, Screen, Title } from '@/ui/components';
import { Text } from '@/ui/Text';
import { colors, font, radius, space } from '@/ui/theme';

/** Bank inbox: upload the monthly statement, then explain each line the books don't already have. */
export default function BankInbox() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<BankStatus>('to_explain');
  const summary = useApi<BankSummary>('/bank/summary');
  const list = useApi<BankTxn[]>(`/bank/txns?state=${tab}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BankImport | null>(null);
  // A locked PDF: keep the picked file and ask for its password.
  const [locked, setLocked] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [password, setPassword] = useState('');

  async function send(a: DocumentPicker.DocumentPickerAsset, pw?: string) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await postFile<BankImport>(
        '/bank/import',
        { uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream', webFile: a.file ?? undefined },
        pw ? { password: pw } : {},
      );
      setResult(res);
      setLocked(null);
      setPassword('');
      setTab('to_explain');
      summary.reload();
      list.reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) {
        setLocked(a);
        if (pw) setError(t('bank.wrongPassword'));
      } else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function upload() {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (r.canceled) return;
    setLocked(null);
    await send(r.assets[0]);
  }

  const s = summary.data;
  return (
    <Screen>
      <Card>
        <Title>{t('bank.title')}</Title>
        {s && (
          <>
            <Text style={{ fontSize: font.big, fontWeight: '800', color: s.to_explain || !s.last_statement_date ? colors.warn : colors.good }}>
              {s.to_explain ? t('bank.toExplainN', { count: s.to_explain }) : s.last_statement_date ? t('bank.allExplained') : t('bank.firstUpload')}
            </Text>
            {s.month_total > 0 && <Muted>{t('bank.monthScore', { done: s.month_explained, total: s.month_total })}</Muted>}
            <Muted>{s.last_statement_date ? t('bank.lastStatement', { date: showDate(s.last_statement_date) }) : t('bank.noStatement')}</Muted>
          </>
        )}
        <BigButton label={t('bank.upload')} icon="cloud-upload" onPress={upload} busy={busy && !locked} />
        <Muted>{t('bank.uploadHelp')}</Muted>
        {locked && (
          <View style={{ gap: space.s }}>
            <Muted>{t('bank.locked', { name: locked.name })}</Muted>
            <Field label={t('bank.pdfPassword')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
            <BigButton label={t('bank.unlock')} icon="lock-open" disabled={!password} busy={busy} onPress={() => send(locked, password)} />
          </View>
        )}
        {result && (
          <View style={{ backgroundColor: colors.goodBg, borderRadius: radius.control, padding: space.m, gap: 2 }}>
            <Text style={{ fontWeight: '700', color: colors.good }}>{t('bank.imported', { added: result.added, rows: result.rows })}</Text>
            <Muted>{t('bank.importDetail', { matched: result.matched, todo: result.to_explain, dup: result.duplicates })}</Muted>
          </View>
        )}
        <ErrorText>{error}</ErrorText>
      </Card>

      <ChipPicker
        options={['to_explain', 'done', 'personal'] as BankStatus[]}
        value={tab}
        onChange={setTab}
        labelOf={(x) => t(`bank.tab_${x}`)}
      />
      {list.loading && !list.data ? (
        <Loading />
      ) : (list.data ?? []).length === 0 ? (
        <Empty icon={tab === 'to_explain' ? 'checkmark-done-circle' : 'file-tray-outline'}>{t(`bank.empty_${tab}`)}</Empty>
      ) : (
        (list.data ?? []).map((x) => <BankRow key={x.id} t={x} onPress={() => router.push(`/owner/bank/${x.id}`)} />)
      )}
    </Screen>
  );
}
