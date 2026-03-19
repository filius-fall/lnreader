import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { Appbar, Button, List, SafeAreaView } from '@components';
import { useAiSettings, useTheme } from '@hooks/persisted';
import { AiSettingsScreenProps } from '@navigators/types';
import { getString } from '@strings/translations';
import { showToast } from '@utils/showToast';

const SettingsAIScreen = ({ navigation }: AiSettingsScreenProps) => {
  const theme = useTheme();
  const {
    enabled,
    baseUrl,
    apiKey,
    timeoutMs,
    embeddingModel,
    rerankerModel,
    answerModel,
    setAiSettings,
  } = useAiSettings();

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title={getString('ai.settings.title')}
        handleGoBack={navigation.goBack}
        theme={theme}
      />
      <ScrollView style={{ backgroundColor: theme.background }}>
        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('ai.settings.backend')}
          </List.SubHeader>
          <View style={styles.inputGroup}>
            <TextInput
              label={getString('ai.settings.baseUrl')}
              mode="outlined"
              value={baseUrl}
              onChangeText={text => setAiSettings({ baseUrl: text.trim() })}
              autoCapitalize="none"
              autoCorrect={false}
              theme={{ colors: { ...theme } }}
            />
          </View>
          <View style={styles.inputGroup}>
            <TextInput
              label={getString('ai.settings.apiKey')}
              mode="outlined"
              value={apiKey}
              onChangeText={text => setAiSettings({ apiKey: text.trim() })}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              theme={{ colors: { ...theme } }}
            />
          </View>
          <View style={styles.inputGroup}>
            <TextInput
              label={getString('ai.settings.timeout')}
              mode="outlined"
              value={String(timeoutMs)}
              keyboardType="numeric"
              onChangeText={text =>
                setAiSettings({
                  timeoutMs: Number(text.replace(/[^0-9]/g, '')) || 30000,
                })
              }
              theme={{ colors: { ...theme } }}
            />
          </View>
        </List.Section>
        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('ai.settings.models')}
          </List.SubHeader>
          <List.Item
            title={getString('ai.settings.embeddingModel')}
            description={embeddingModel}
            icon="vector-combine"
            theme={theme}
          />
          <List.Item
            title={getString('ai.settings.rerankerModel')}
            description={rerankerModel}
            icon="sort"
            theme={theme}
          />
          <List.Item
            title={getString('ai.settings.answerModel')}
            description={answerModel}
            icon="robot-outline"
            theme={theme}
          />
          <List.InfoItem
            title={getString('ai.settings.modelInfo')}
            theme={theme}
          />
        </List.Section>
        <View style={styles.actions}>
          <Button
            title={
              enabled
                ? getString('ai.settings.disable')
                : getString('ai.settings.enable')
            }
            onPress={() => {
              setAiSettings({ enabled: !enabled });
              showToast(
                enabled
                  ? getString('ai.settings.disabledToast')
                  : getString('ai.settings.enabledToast'),
              );
            }}
          />
          <Text style={[styles.caption, { color: theme.onSurfaceVariant }]}>
            {getString('ai.settings.footer')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    padding: 16,
  },
  caption: {
    fontSize: 12,
    lineHeight: 18,
  },
  inputGroup: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});

export default SettingsAIScreen;
