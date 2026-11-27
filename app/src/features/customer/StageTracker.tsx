import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import type { Project } from '@/lib/types';
import { Card, Muted, Title } from '@/ui/components';
import { Text } from '@/ui/Text';
import { colors, font, space } from '@/ui/theme';

const STAGES = ['quote', 'contract_signed', 'in_progress', 'handed_over'] as const;

/** Where the job stands: quote → contract signed → work in progress → handed over. */
export function StageTracker({ project }: { project: Project }) {
  const { t } = useTranslation();
  const current = project.status === 'closed' ? STAGES.length : STAGES.indexOf(project.status as (typeof STAGES)[number]);

  return (
    <Card>
      <Title>{t('stage.title')}</Title>
      {STAGES.map((s, i) => {
        const done = i < current;
        const now = i === current;
        const color = done ? colors.good : now ? colors.brand : colors.border;
        return (
          <View key={s} style={{ flexDirection: 'row', gap: space.m }}>
            <View style={{ alignItems: 'center', width: 28 }}>
              <Ionicons name={done ? 'checkmark-circle' : now ? 'radio-button-on' : 'ellipse-outline'} size={28} color={color} />
              {i < STAGES.length - 1 && <View style={{ width: 3, flex: 1, minHeight: 18, backgroundColor: done ? colors.good : colors.border }} />}
            </View>
            <View style={{ flex: 1, paddingBottom: space.m, gap: 2 }}>
              <Text style={{ fontSize: font.body + 1, fontWeight: now ? '800' : '600', color: done || now ? colors.text : colors.muted }}>
                {t(`stage.${s}`)}
              </Text>
              {now && <Muted>{t(`stage.${s}Now`)}</Muted>}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

/** Overall progress from stages finished. */
export function ProgressMeter({ project }: { project: Project }) {
  const { t } = useTranslation();
  const total = project.milestones_total || 0;
  const pct = total ? Math.round((project.milestones_done / total) * 100) : 0;
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Title>{t('stage.workDone')}</Title>
        <Text style={{ fontSize: font.big, fontWeight: '800', color: colors.brand }}>{pct}%</Text>
      </View>
      <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.border, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: colors.accent }} />
      </View>
      <Muted>{t('stage.stagesDone', { done: project.milestones_done, total })}</Muted>
    </Card>
  );
}
