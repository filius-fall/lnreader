import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Appbar, IconButton, List } from 'react-native-paper';
import {
  deleteBookmark,
  getBookmarksForNovel,
} from '@database/queries/BookmarkQueries';
import { getChapter } from '@database/queries/ChapterQueries';
import { Bookmark } from '@database/types';
import { useRoute } from '@react-navigation/native';

const BookmarksScreen = ({ navigation }: any) => {
  const route = useRoute();
  const { novel }: any = route.params;
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  const fetchBookmarks = () => {
    setBookmarks(getBookmarksForNovel(novel.id));
  };

  useEffect(() => {
    fetchBookmarks();
  }, [novel.id]);

  const handleDelete = (id: number) => {
    deleteBookmark(id);
    fetchBookmarks();
  };

  const handleItemPress = async (item: Bookmark) => {
    const chapter = await getChapter(item.chapterId);
    if (chapter) {
      navigation.navigate('Chapter', {
        novel,
        chapter,
        bookmark: item,
      });
    }
  };

  const renderItem = ({ item }: { item: Bookmark }) => (
    <List.Item
      title={item.text}
      description={`Chapter ${item.chapterId}`}
      onPress={() => handleItemPress(item)}
      right={() => (
        <IconButton icon="delete" onPress={() => handleDelete(item.id)} />
      )}
    />
  );

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Bookmarks" />
      </Appbar.Header>
      <FlatList
        data={bookmarks}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
      />
    </View>
  );
};

export default BookmarksScreen;
