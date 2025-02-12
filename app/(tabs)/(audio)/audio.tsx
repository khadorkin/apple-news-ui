import React from 'react';
import { Text, Image, View, StyleSheet, Pressable, TouchableOpacity, Alert, RefreshControl, ActivityIndicator, Platform, FlatList } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { SwipeListView } from 'react-native-swipe-list-view';
import { useState, useRef } from 'react';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import SlidingBanner from '@/components/SlidingBanner';
import { MotiView } from 'moti';
import Head from 'expo-router/head';

import { news } from '@/data/news.json';
import { useColorScheme } from '@/hooks/useColorScheme';
import { NewsLogo } from '@/components/NewsLogo';
import { styles } from '@/styles/screens/audio';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NewsItem, NewsItemType } from '@/components/NewsItem';
import { SwipeableNewsItem } from '@/components/SwipeableNewsItem';
import { NewsHeaderLeftItem } from '@/components/NewsHeaderLeftItem';
import { TabMenu } from '@/components/TabMenu';
import { Colors } from '@/constants/Colors';
import { PodcastItem } from '@/components/PodcastItem';
import { PodcastEpisode, PodcastEpisodeData } from '@/types/podcast';
import podcasts from '@/data/podcasts.json';
import { useAudio } from '@/contexts/AudioContext';
import { AudioVisualizer } from '@/components/AudioVisualizer';
import { PodcastEditorsPickItem } from '@/components/PodcastEditorsPickItem';
import { useScrollToTop } from '@react-navigation/native';
import { isWebSafari } from '@/helper/iswebsafari';

interface Source {
  id: string;
  name: string;
  logo_transparent_light: string;
  logo_transparent_dark: string;
}

interface Topic {
  id: string;
  name: string;
}

interface Author {
  name: string;
}

interface NewsItem {
  id: string;
  title: string;
  source: Source;
  created_at: string;
  topic: Topic;
  show_topic: boolean;
  author: Author;
  featured_image: string;
  card_type: 'full' | 'medium';
}

const TABS = [
  { id: 'best', label: 'Best of News+', icon: 'heart' },
  { id: 'magazines', label: 'My Magazines', icon: 'book' },
  { id: 'downloaded', label: 'Downloaded', icon: 'download' },
  { id: 'newspapers', label: 'Newspapers', icon: 'newspaper' },
  { id: 'catalog', label: 'Catalog', icon: 'list' },
];

const DiscoverNewsButton = () => {
  return (
    <SlidingBanner
      onPress={() => Alert.alert('Take to Apple Podcasts')}
      icon={{
        name: 'headset',
        size: 24,
      }}
      title="Discover News+ Narrated"
      subtitle="More audio stories in Apple Podcasts"
      backgroundColor="#2196A5"
    />
  );
};

type AnimatedFlatListType = Animated.FlatList<PodcastEpisodeData>;

export default function AudioScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const segments = useSegments();

  // Get the current group (tab) from segments
  const currentGroup = segments[1]; // Should return 'index', 'news+', 'sports', etc.

  // const iconColor = colorScheme === 'light' ? '#000' : '#fff';
  const iconColor = '#fff';

  const backgroundColor = '#F2F2F6';
  const insets = useSafeAreaInsets();

  const AnimatedSwipeListView = Animated.createAnimatedComponent(SwipeListView);

  const scrollRef = useRef<AnimatedFlatListType>(null);

  useScrollToTop(
    useRef({
      scrollToTop: () => {
        if (scrollRef.current) {
          scrollRef.current.scrollToOffset({ offset: -100, animated: true });
          onRefresh();
        }
      }
    })
  );

  const [activeTab, setActiveTab] = useState('best');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [episodes, setEpisodes] = useState((podcasts.results['podcast-episodes'][0].data || []) as PodcastEpisodeData[]);
  const { commands, sharedValues } = useAudio();
  const { playEpisode, togglePlayPause, closePlayer } = commands;
  const { isPlaying, isLoading: audioLoading } = sharedValues;
  const [isPlayingState, setIsPlayingState] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useAnimatedReaction(
    () => isPlaying.value,
    (playing) => {
      runOnJS(setIsPlayingState)(playing);
    }
  );

  const handleTabPress = (tabId: string) => {
    setActiveTab(tabId);
  };

  const { currentEpisode } = useAudio();

  const handlePlayAll = async () => {
    const firstEpisode = podcasts.results['podcast-episodes'][0].data[0] as PodcastEpisodeData;

    if (firstEpisode) {
      setIsLoading(true);
      const imageUrl = firstEpisode.attributes.artwork?.url?.replace('{w}', '300').replace('{h}', '300').replace('{f}', 'jpg') || 'https://via.placeholder.com/300';

      const podcast: PodcastEpisode = {
        id: firstEpisode.id,
        title: firstEpisode.attributes.name,
        streamUrl: firstEpisode.attributes.assetUrl,
        artwork: { url: imageUrl },
        showTitle: firstEpisode.relationships?.podcast?.data[0]?.attributes?.name || firstEpisode.attributes.artistName,
        duration: firstEpisode.attributes.durationInMilliseconds,
        releaseDate: firstEpisode.attributes.releaseDateTime,
        summary: firstEpisode.attributes.description.standard
      };

      try {
        await closePlayer();
        await playEpisode(podcast);
        router.push(`/audio/${firstEpisode.id}`);
      } catch (error) {
        console.error('Error playing episode:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const shuffleArray = (array: PodcastEpisodeData[]) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const shuffledEpisodes = shuffleArray(episodes);
    setEpisodes(shuffledEpisodes);
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsRefreshing(false);
  };

  const renderPodcastItem = ({ item, index }: { item: PodcastEpisodeData; index: number }) => (
    <PodcastItem
      episode={item}
      index={index}
    />
  );

  const remainingEpisodes = episodes.slice(5);

  return (
    <>
      {Platform.OS === 'web' && (
        <Head>
          <title>Apple News Audio - News Stories & Podcasts</title>
          <meta name="description" content="Listen to your favorite news stories and podcasts, professionally narrated and curated for the best audio experience." />
          <meta name="keywords" content="apple news audio, news podcasts, audio stories, news narration" />
        </Head>
      )}

      <SafeAreaView className="flex-1">
        <Animated.FlatList
          ref={scrollRef}
          data={remainingEpisodes}
          renderItem={renderPodcastItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor='#000'
              progressViewOffset={insets.top}
            />
          }
          style={
            Platform.OS === 'web' ? {
              height: undefined,
              overflow: 'visible'
            } : undefined}
          scrollEnabled={Platform.OS !== 'web' || isWebSafari()}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: Platform.OS === 'web' ?  10 : 0,
            paddingBottom: insets.bottom + 60,
            backgroundColor: Platform.OS !== 'web' ? '#F2F2F7' : 'white',
            ...(Platform.OS === 'web' ? {
              height: undefined
            } : {})
          }}
          ListHeaderComponent={
            <View style={styles.headerContainer}>
              <View style={styles.header}>
                <NewsHeaderLeftItem size="lg" secondaryTitle="Audio" />
                <View style={styles.headerRight}>
                  <TouchableOpacity
                    style={[
                      styles.headerRightButton,
                      {
                        backgroundColor: !isPlayingState  ? '#86858D' : Colors.light.tint,
                        opacity: isLoading || audioLoading.value ? 0.7 : 1
                      }
                    ]}
                    onPress={currentEpisode ? togglePlayPause : handlePlayAll}
                    disabled={isLoading || audioLoading.value}
                  >
                    {isLoading || audioLoading.value ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : currentEpisode && isPlayingState ? (
                      <AudioVisualizer isPlaying={true} />
                    ) : (
                      <Ionicons name="headset" size={14} color={'#fff'} />
                    )}
                    <Text style={styles.headerRightText}>
                      {isLoading || audioLoading.value ? 'Loading...' : 
                        currentEpisode ? 
                          (isPlayingState ? 'Playing' : 'Paused') : 
                          'Play All'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {isRefreshing && (
                <MotiView
                  from={{ 
                    opacity: 0,
                    translateY: -20 
                  }}
                  animate={{ 
                    opacity: 1,
                    translateY: 0 
                  }}
                  transition={{
                    type: 'spring',
                    damping: 20,
                    stiffness: 200
                  }}
                >
                  <Text style={{ fontSize: 22, marginTop: 10, color: '#FD325A' }}>
                    Checking new podcasts...
                  </Text>
                </MotiView>
              )}

              <PodcastEditorsPickItem episodes={episodes} />
              <DiscoverNewsButton />
              <Text style={styles.sectionTitle}>For You</Text>
            </View>
          }
        />
      </SafeAreaView>
    </>
  );
}

