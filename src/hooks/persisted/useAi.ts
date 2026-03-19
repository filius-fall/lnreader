import ServiceManager, {
  BackgroundTaskMetadata,
  IndexNovelAiTask,
  QueuedBackgroundTask,
} from '@services/ServiceManager';
import { useMemo } from 'react';
import { useMMKVObject } from 'react-native-mmkv';

export default function useAi() {
  const [queue] = useMMKVObject<QueuedBackgroundTask[]>(
    ServiceManager.manager.STORE_KEY,
  );

  const aiQueue = useMemo(
    () => queue?.filter(t => t.task?.name === 'INDEX_NOVEL_AI') || [],
    [queue],
  ) as { task: IndexNovelAiTask; meta: BackgroundTaskMetadata }[];

  const indexNovel = (novelId: number, novelName: string) =>
    ServiceManager.manager.addTask({
      name: 'INDEX_NOVEL_AI',
      data: { novelId, novelName },
    });

  return {
    aiQueue,
    indexNovel,
  };
}
