import {
  ActionIcon,
  Button,
  Center,
  Group,
  Loader,
  LoadingOverlay,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconArrowsCross, IconCloudOff, IconPlus, IconStar } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { createContext, useContext, useMemo, useState } from 'react';

import { ButtonTooltip } from '~/components/CivitaiWrapped/ButtonTooltip';
import { useContainerSmallerThan } from '~/components/ContainerProvider/useContainerSmallerThan';
import { PeriodFilter, SortFilter } from '~/components/Filters';
import { ImagesAsPostsCard } from '~/components/Image/AsPosts/ImagesAsPostsCard';
import { useImageFilters } from '~/components/Image/image.utils';
import { InViewLoader } from '~/components/InView/InViewLoader';
import { LoginRedirect } from '~/components/LoginRedirect/LoginRedirect';
import { MasonryColumns } from '~/components/MasonryColumns/MasonryColumns';
import { MasonryContainer } from '~/components/MasonryColumns/MasonryContainer';
import { MasonryProvider } from '~/components/MasonryColumns/MasonryProvider';
import { ModelGenerationCard } from '~/components/Model/Generation/ModelGenerationCard';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { useSetFilters } from '~/providers/FiltersProvider';
import { removeEmpty } from '~/utils/object-helpers';
import { trpc } from '~/utils/trpc';

type ModelVersionsProps = { id: number; name: string };
type ImagesAsPostsInfiniteState = {
  modelVersions?: ModelVersionsProps[];
  filters: {
    modelId?: number;
    username?: string;
  } & Record<string, unknown>;
};
const ImagesAsPostsInfiniteContext = createContext<ImagesAsPostsInfiniteState | null>(null);
export const useImagesAsPostsInfiniteContext = () => {
  const context = useContext(ImagesAsPostsInfiniteContext);
  if (!context) throw new Error('ImagesInfiniteContext not in tree');
  return context;
};

type ImagesAsPostsInfiniteProps = {
  selectedVersionId?: number;
  modelId: number;
  username?: string;
  modelVersions?: ModelVersionsProps[];
  generationOptions?: { generationModelId?: number; includeEditingActions?: boolean };
};

const LIMIT = 50;
export default function ImagesAsPostsInfinite({
  modelId,
  username,
  modelVersions,
  selectedVersionId,
  generationOptions,
}: ImagesAsPostsInfiniteProps) {
  const currentUser = useCurrentUser();
  const router = useRouter();
  const isMobile = useContainerSmallerThan('sm');
  // const globalFilters = useImageFilters();
  const [limit] = useState(isMobile ? LIMIT / 2 : LIMIT);

  const imageFilters = useImageFilters('modelImages');
  const setFilters = useSetFilters('modelImages');
  const filters = removeEmpty({
    ...imageFilters,
    modelVersionId: selectedVersionId,
    modelId,
    username,
  });

  const { data, isLoading, fetchNextPage, hasNextPage, isRefetching } =
    trpc.image.getImagesAsPostsInfinite.useInfiniteQuery(
      { ...filters, limit },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        trpc: { context: { skipBatch: true } },
        keepPreviousData: true,
        // enabled: inView,
      }
    );

  const items = useMemo(() => data?.pages.flatMap((x) => x.items) ?? [], [data]);

  const isMuted = currentUser?.muted ?? false;
  const addPostLink = `/posts/create?modelId=${modelId}${
    selectedVersionId ? `&modelVersionId=${selectedVersionId}` : ''
  }&returnUrl=${router.asPath}`;
  const { excludeCrossPosts } = imageFilters;

  return (
    <ImagesAsPostsInfiniteContext.Provider value={{ filters, modelVersions }}>
      <MasonryProvider columnWidth={310} maxColumnCount={6} maxSingleColumnWidth={450}>
        <MasonryContainer
          fluid
          pt="xl"
          pb={61}
          mb={-61}
          sx={(theme) => ({
            background: theme.colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[1],
          })}
        >
          <Stack spacing="md">
            <Group spacing="xs" align="flex-end">
              <Title order={2}>Gallery</Title>
              {!isMuted && (
                <Group>
                  <LoginRedirect reason="create-review">
                    <Link href={addPostLink}>
                      <Button variant="outline" size="xs" leftIcon={<IconPlus size={16} />}>
                        Add Post
                      </Button>
                    </Link>
                  </LoginRedirect>
                  <LoginRedirect reason="create-review">
                    <Link href={addPostLink + '&reviewing=true'}>
                      <Button leftIcon={<IconStar size={16} />} variant="outline" size="xs">
                        Add Review
                      </Button>
                    </Link>
                  </LoginRedirect>
                </Group>
              )}
            </Group>
            {/* IMAGES */}
            <Group position="apart" spacing={0}>
              <SortFilter type="modelImages" />
              <Group spacing={4}>
                <PeriodFilter type="modelImages" />
                <ButtonTooltip label={`${excludeCrossPosts ? 'Show' : 'Hide'} Cross-posts`}>
                  <ActionIcon
                    variant={excludeCrossPosts ? 'light' : 'transparent'}
                    color={excludeCrossPosts ? 'red' : undefined}
                    onClick={() => setFilters({ excludeCrossPosts: !excludeCrossPosts })}
                  >
                    <IconArrowsCross size={20} />
                  </ActionIcon>
                </ButtonTooltip>
                {/* <ImageFiltersDropdown /> */}
              </Group>
            </Group>
            {/* <ImageCategories /> */}
            {isLoading ? (
              <Paper style={{ minHeight: 200, position: 'relative' }}>
                <LoadingOverlay visible zIndex={10} />
              </Paper>
            ) : !!items.length ? (
              <div style={{ position: 'relative' }}>
                <LoadingOverlay visible={isRefetching ?? false} zIndex={9} />
                <MasonryColumns
                  data={items}
                  staticItem={
                    !!generationOptions?.generationModelId && selectedVersionId
                      ? (props) => (
                          <ModelGenerationCard
                            {...props}
                            versionId={selectedVersionId}
                            modelId={generationOptions.generationModelId}
                            withEditingActions={generationOptions?.includeEditingActions}
                          />
                        )
                      : undefined
                  }
                  imageDimensions={(data) => {
                    const tallestImage = data.images.sort((a, b) => {
                      const aHeight = a.height ?? 0;
                      const bHeight = b.height ?? 0;
                      const aAspectRatio = aHeight > 0 ? (a.width ?? 0) / aHeight : 0;
                      const bAspectRatio = bHeight > 0 ? (b.width ?? 0) / bHeight : 0;
                      if (aAspectRatio < 1 && bAspectRatio >= 1) return -1;
                      if (bAspectRatio < 1 && aAspectRatio <= 1) return 1;
                      if (aHeight === bHeight) return 0;
                      return aHeight > bHeight ? -1 : 1;
                    })[0];

                    const width = tallestImage?.width ?? 450;
                    const height = tallestImage?.height ?? 450;
                    return { width, height };
                  }}
                  adjustHeight={({ height }, data) => {
                    const imageHeight = Math.min(height, 600);
                    return imageHeight + 57 + (data.images.length > 1 ? 8 : 0);
                  }}
                  maxItemHeight={600}
                  render={ImagesAsPostsCard}
                  itemId={(data) => data.images.map((x) => x.id).join('_')}
                />
                {hasNextPage && (
                  <InViewLoader
                    loadFn={fetchNextPage}
                    loadCondition={!isRefetching}
                    style={{ gridColumn: '1/-1' }}
                  >
                    <Center p="xl" sx={{ height: 36 }} mt="md">
                      <Loader />
                    </Center>
                  </InViewLoader>
                )}
              </div>
            ) : (
              <Stack align="center" py="lg">
                <ThemeIcon size={128} radius={100}>
                  <IconCloudOff size={80} />
                </ThemeIcon>
                <Text size={32} align="center">
                  No results found
                </Text>
                <Text align="center">
                  {"Try adjusting your search or filters to find what you're looking for"}
                </Text>
              </Stack>
            )}
          </Stack>
        </MasonryContainer>
      </MasonryProvider>

      {/* {isLoading && (
        <Paper style={{ minHeight: 200, position: 'relative' }}>
          <LoadingOverlay visible zIndex={10} />
        </Paper>
      )}
      {!isLoading && !items.length && (
        <Paper p="xl" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Stack>
            <Text size="xl">There are no images for this model yet.</Text>
            <Text color="dimmed">
              Add a post to showcase your images generated from this model.
            </Text>
          </Stack>
        </Paper>
      )} */}
    </ImagesAsPostsInfiniteContext.Provider>
  );
}
