import { CloseOutlined } from '@ant-design/icons';
import { MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH } from '@planitpoker/shared';
import { Alert, Button, Card, Divider, Empty, Flex, Input, Typography } from 'antd';
import React from 'react';

import { useTranslation } from '../../i18n/use-translation';
import { DeckSelect } from '../deck-select/deck-select';
import { useRoomSetup } from './room-setup.hooks';

export interface RoomSetupProps {
    /** Opens the shared admin settings modal. */
    onOpenSettings: () => void;
}

/**
 * First-run screen for a room whose backlog is still empty.
 *
 * Admins pick the deck and stage the first stories; everyone else sees a
 * waiting card, because only an admin can create the opening story.
 */
export const RoomSetup: React.FC<RoomSetupProps> = ({ onOpenSettings }) => {
    const model = useRoomSetup();
    const { t } = useTranslation();

    if (!model.isAdmin) {
        return (
            <Card>
                <Empty
                    description={
                        <Flex gap={4} vertical>
                            <Typography.Text strong>{t('setup.waiting.title')}</Typography.Text>
                            <Typography.Text type="secondary">
                                {t('setup.waiting.desc')}
                            </Typography.Text>
                        </Flex>
                    }
                />
            </Card>
        );
    }

    return (
        <Card>
            <Flex gap={12} vertical>
                <div>
                    <Typography.Title level={4} style={{ margin: 0 }}>
                        {t('setup.title')}
                    </Typography.Title>
                    <Typography.Text type="secondary">{t('setup.subtitle')}</Typography.Text>
                </div>

                <div>
                    <label htmlFor="setup-room-title">{t('setup.room.title')}</label>
                    <Input
                        id="setup-room-title"
                        maxLength={MAX_TITLE_LENGTH}
                        onChange={(event) => model.setRoomTitle(event.target.value)}
                        placeholder={t('create.title.placeholder')}
                        value={model.roomTitle}
                    />
                </div>

                <DeckSelect
                    customDeck={model.customDeck}
                    customDeckError={model.customDeckError}
                    customDeckId="setup-custom-deck"
                    customLabel={t('setup.customDeck')}
                    deckId="setup-deck"
                    deckType={model.deckType}
                    label={t('setup.deck')}
                    onCustomDeckChange={model.setCustomDeck}
                    onDeckTypeChange={model.setDeckType}
                />

                <Divider style={{ margin: 0 }} />

                <div>
                    <label htmlFor="setup-story-title">{t('setup.story.title')}</label>
                    <Input
                        id="setup-story-title"
                        maxLength={MAX_TITLE_LENGTH}
                        onChange={(event) => model.setStoryTitle(event.target.value)}
                        placeholder={t('setup.story.title.placeholder')}
                        value={model.storyTitle}
                    />
                </div>

                <div>
                    <label htmlFor="setup-story-description">{t('setup.story.description')}</label>
                    <Input.TextArea
                        id="setup-story-description"
                        maxLength={MAX_DESCRIPTION_LENGTH}
                        onChange={(event) => model.setStoryDescription(event.target.value)}
                        placeholder={t('setup.story.description.placeholder')}
                        rows={2}
                        value={model.storyDescription}
                    />
                </div>

                <Button onClick={model.addStagedStory}>{t('setup.story.add')}</Button>

                <Divider style={{ margin: 0 }} />

                <div>
                    <label htmlFor="setup-bulk-stories">{t('setup.bulk.label')}</label>
                    <Input.TextArea
                        id="setup-bulk-stories"
                        onChange={(event) => model.setBulkText(event.target.value)}
                        placeholder={t('backlog.import.placeholder')}
                        rows={3}
                        value={model.bulkText}
                    />
                </div>

                <Button onClick={model.addStoriesFromBulk}>{t('setup.bulk.add')}</Button>

                <Divider style={{ margin: 0 }} />

                <div>
                    <Typography.Text strong>{t('setup.staged')}</Typography.Text>
                    {model.stagedStories.length === 0 ? (
                        <Typography.Paragraph type="secondary" style={{ marginBlockEnd: 0 }}>
                            {t('setup.staged.empty')}
                        </Typography.Paragraph>
                    ) : (
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                            {model.stagedStories.map((story, index) => (
                                <li key={story.key}>
                                    <Flex align="center" gap={8} justify="space-between">
                                        <div>
                                            <Typography.Text>{story.title}</Typography.Text>
                                            {story.description && (
                                                <Typography.Text
                                                    style={{ display: 'block' }}
                                                    type="secondary"
                                                >
                                                    {story.description}
                                                </Typography.Text>
                                            )}
                                        </div>
                                        <Button
                                            aria-label={t('setup.story.remove', {
                                                title: story.title,
                                            })}
                                            danger
                                            icon={<CloseOutlined />}
                                            onClick={() => model.removeStagedStory(index)}
                                            size="small"
                                            type="text"
                                        />
                                    </Flex>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {model.notice && (
                    <Alert showIcon title={model.notice.message} type={model.notice.kind} />
                )}

                <Flex gap={8} justify="space-between" wrap>
                    <Button onClick={onOpenSettings}>{t('setup.settings')}</Button>
                    <Button
                        disabled={model.stagedStories.length === 0}
                        onClick={model.startEstimating}
                        type="primary"
                    >
                        {t('setup.start')}
                    </Button>
                </Flex>
            </Flex>
        </Card>
    );
};
