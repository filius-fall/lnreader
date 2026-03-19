import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { Button, Modal } from '@components';
import { useTheme } from '@hooks/persisted';
import { askReaderAiQuestion } from '@services/ai/askQuestion';
import { ChapterInfo, NovelInfo } from '@database/types';
import { getString } from '@strings/translations';
import { showToast } from '@utils/showToast';
import { AiAnswerCitation } from '@services/ai/types';

type Props = {
  chapter: ChapterInfo;
  novel: NovelInfo;
  progress: number;
  selectedText: string;
  visible: boolean;
  onDismiss: () => void;
};

const AskAiModal = ({
  chapter,
  novel,
  progress,
  selectedText,
  visible,
  onDismiss,
}: Props) => {
  const theme = useTheme();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<AiAnswerCitation[]>([]);

  const clearAndDismiss = () => {
    setQuestion('');
    setAnswer('');
    setCitations([]);
    onDismiss();
  };

  const canSubmit = useMemo(
    () => selectedText.trim().length > 0 && question.trim().length > 0 && !loading,
    [loading, question, selectedText],
  );

  return (
    <Modal visible={visible} onDismiss={clearAndDismiss}>
      <ScrollView>
        <Text style={[styles.title, { color: theme.onSurface }]}>
          {getString('ai.reader.askTitle')}
        </Text>
        <Text style={[styles.caption, { color: theme.onSurfaceVariant }]}>
          {getString('ai.reader.noSpoilers')}
        </Text>
        <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>
          {getString('ai.reader.selectedText')}
        </Text>
        <Text style={[styles.snippet, { color: theme.onSurfaceVariant }]}>
          {selectedText}
        </Text>
        <TextInput
          mode="outlined"
          multiline
          label={getString('ai.reader.question')}
          value={question}
          onChangeText={setQuestion}
          theme={{ colors: { ...theme } }}
          style={styles.input}
        />
        {answer ? (
          <View style={styles.answerGroup}>
            <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>
              {getString('ai.reader.answer')}
            </Text>
            <Text style={{ color: theme.onSurface }}>{answer}</Text>
            {citations.length ? (
              <>
                <Text
                  style={[
                    styles.sectionTitle,
                    styles.citationsTitle,
                    { color: theme.onSurface },
                  ]}
                >
                  {getString('ai.reader.citations')}
                </Text>
                {citations.map((citation, index) => (
                  <Text
                    key={`${citation.chapterId}-${citation.chunkIndex}-${index}`}
                    style={[styles.citation, { color: theme.onSurfaceVariant }]}
                  >
                    {`${citation.chapterName}: ${citation.excerpt}`}
                  </Text>
                ))}
              </>
            ) : null}
          </View>
        ) : null}
        <View style={styles.buttonRow}>
          <Button
            title={getString('common.cancel')}
            onPress={clearAndDismiss}
            style={styles.button}
          />
          <Button
            title={
              loading ? getString('common.loading') : getString('ai.reader.ask')
            }
            mode="contained"
            onPress={async () => {
              if (!canSubmit) {
                return;
              }
              try {
                setLoading(true);
                const response = await askReaderAiQuestion({
                  novelId: novel.id,
                  chapterId: chapter.id,
                  progress,
                  selectedText,
                  question,
                });
                setAnswer(response.answer);
                setCitations(response.citations || []);
              } catch (error: any) {
                showToast(error?.message || getString('common.retry'));
              } finally {
                setLoading(false);
              }
            }}
            style={styles.button}
          />
        </View>
      </ScrollView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  answerGroup: {
    gap: 8,
    marginTop: 16,
  },
  button: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  caption: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  citation: {
    fontSize: 12,
    lineHeight: 18,
  },
  citationsTitle: {
    marginTop: 8,
  },
  input: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  snippet: {
    borderRadius: 12,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
  },
});

export default AskAiModal;
