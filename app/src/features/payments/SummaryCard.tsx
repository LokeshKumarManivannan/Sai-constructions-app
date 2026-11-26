import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { showDate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import type { Project, Summary } from '@/lib/types';
import { BuildingProgress } from '@/ui/BuildingProgress';
import { HeroCard, Muted, SpeakButton } from '@/ui/components';
import { Text } from '@/ui/Text';
import { colors, font, radius, space } from '@/ui/theme';

/**
 * Money hero: the house (stages done), total, paid and balance, with a paid bar.
 * Below it, the next payment as its own amber card.
 */
export function SummaryCard({ s, project, showCash = false }: { s: Summary; project?: Project; showCash?: boolean }) {
  const { t } = useTranslation();
  const nd = s.next_due;
  const paidShare = s.total_due_paise > 0 ? Math.min(s.paid_paise / s.total_due_paise, 1) : 0;
  const spoken = [
    `${t('payments.total')} ${formatINR(s.total_due_paise)}`,
    `${t('payments.paid')} ${formatINR(s.paid_paise)}`,
    `${t('payments.outstanding')} ${formatINR(s.outstanding_paise)}`,
    nd ? `${t('payments.nextPayment')} ${formatINR(nd.amount_paise)} ${t('payments.for')} ${nd.name}` : t('payments.noneDue'),
  ].join('. ');

  return (
    <>
      <HeroCard>
        <View style={{ flexDirection: 'row', gap: space.m, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            {project && (
              <Text style={{ color: colors.brandText, fontSize: font.title, fontWeight: '700' }} numberOfLines={2}>
                {project.name}
              </Text>
            )}
            {project && project.milestones_total > 0 && (
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: font.small }}>
                {t('owner.stagesDone', { done: project.milestones_done, total: project.milestones_total })}
              </Text>
            )}
          </View>
          {project && project.milestones_total > 0 && (
            <BuildingProgress total={project.milestones_total} done={project.milestones_done} onDark />
          )}
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: font.small, marginTop: space.s }}>{t('payments.total')}</Text>
        <Text style={{ color: colors.brandText, fontSize: font.big + 4, fontWeight: '800' }} numberOfLines={1}>
          {formatINR(s.total_due_paise)}
        </Text>
        {s.approved_extras_paise > 0 && (
          <Text style={{ color: colors.accent, fontSize: font.small }}>
            {t('payments.extras')}: {formatINR(s.approved_extras_paise)}
          </Text>
        )}

        {/* paid bar */}
        <View style={{ height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden', marginTop: space.s }}>
          <View style={{ width: `${paidShare * 100}%`, height: '100%', backgroundColor: colors.accent }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.m }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="checkmark-circle" size={16} color="#7FD3A6" />
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: font.small }}>{t('payments.paid')}</Text>
            </View>
            <Text style={{ color: '#7FD3A6', fontSize: font.title + 1, fontWeight: '800' }}>{formatINR(s.paid_paise)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="hourglass" size={15} color={colors.accent} />
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: font.small }}>{t('payments.outstanding')}</Text>
            </View>
            <Text style={{ color: colors.brandText, fontSize: font.title + 1, fontWeight: '800' }}>{formatINR(s.outstanding_paise)}</Text>
          </View>
        </View>
        <SpeakButton text={spoken} onDark />
      </HeroCard>

      {showCash && (
        <Muted>
          {t('payments.cashReceived')}: {formatINR(s.cash_received_paise)} / {formatINR(s.cash_limit_paise)}
        </Muted>
      )}

      {nd ? (
        <View style={{ backgroundColor: colors.accentSoft, borderRadius: radius.card, borderWidth: 1.5, borderColor: colors.accent, padding: space.m, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="calendar" size={19} color={colors.brandDeep} />
            </View>
            <Text style={{ fontSize: font.body, fontWeight: '700', color: colors.text }}>{t('payments.nextPayment')}</Text>
          </View>
          <Text style={{ fontSize: font.big, fontWeight: '800', color: colors.text, marginTop: space.xs }}>{formatINR(nd.amount_paise)}</Text>
          <Text style={{ fontSize: font.body, color: colors.text }}>
            {t('payments.for')}: {nd.name}
          </Text>
          {nd.due_date && (
            <Text style={{ fontSize: font.body, color: colors.bad, fontWeight: '600' }}>
              {t('payments.dueBy')}: {showDate(nd.due_date)}
            </Text>
          )}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: colors.goodBg, borderRadius: radius.card, padding: space.m }}>
          <Ionicons name="happy" size={24} color={colors.good} />
          <Text style={{ fontSize: font.body, fontWeight: '700', color: colors.good }}>{t('payments.noneDue')}</Text>
        </View>
      )}
    </>
  );
}
