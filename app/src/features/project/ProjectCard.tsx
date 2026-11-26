import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { Project } from '@/lib/types';
import { BuildingProgress } from '@/ui/BuildingProgress';
import { Card, StatusChip } from '@/ui/components';
import { projectTone } from '@/ui/status';
import { Text } from '@/ui/Text';
import { colors, font, space } from '@/ui/theme';

/** A project in a list: the house filling up on the left, who and where on the right. */
export function ProjectCard({ p }: { p: Project }) {
  const { t } = useTranslation();
  return (
    <Card onPress={() => router.push(`/owner/projects/${p.id}`)}>
      <View style={{ flexDirection: 'row', gap: space.m, alignItems: 'center' }}>
        <BuildingProgress total={p.milestones_total} done={p.milestones_done} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: font.body + 1, fontWeight: '700' }} numberOfLines={1}>
            {p.name}
          </Text>
          <Text style={{ color: colors.muted }} numberOfLines={1}>
            {p.customer_name}
            {p.site_address ? `, ${p.site_address}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, flexWrap: 'wrap' }}>
            <StatusChip label={t(`status.${p.status}`)} tone={projectTone[p.status]} />
            {p.milestones_total > 0 && (
              <Text style={{ color: colors.muted, fontSize: font.small - 1 }}>
                {t('owner.stagesDone', { done: p.milestones_done, total: p.milestones_total })}
              </Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={22} color={colors.muted} />
      </View>
    </Card>
  );
}
