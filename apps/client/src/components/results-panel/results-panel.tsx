import { CheckCircleOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';
import {
    App as AntApp,
    Button,
    Card,
    Col,
    Flex,
    Input,
    Modal,
    Progress,
    Row,
    Space,
    Statistic,
    Tag,
    Typography,
} from 'antd';
import React, { useState } from 'react';

import { useSocket } from '../../context/socket-context/use-socket';
import { DeckChipPicker } from '../deck-chip-picker/deck-chip-picker';
import { useEstimationStats } from './results-panel.hooks';

/** Distinguishes a numeric estimate from a symbolic one such as "XL" or "?". */
const toFinalEstimate = (value: number | string): number | string => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
};

/**
 * Renders a statistic verbatim.
 *
 * Without this, Ant Design splits `5.0` into separate integer and decimal spans
 * and groups thousands, which is wrong for poker estimates.
 */
const renderVerbatim = (value: number | string): string => String(value);

/**
 * Revealed votes for the active story, with the actions the host can take next.
 *
 * The statistic grid uses real grid columns so the four figures never overlap
 * when the panel narrows.
 */
export const ResultsPanel: React.FC = () => {
    const { isAdmin, roomState, setCurrentStory, updateStoryEstimate } = useSocket();
    const { message } = AntApp.useApp();

    const [isManualEditOpen, setIsManualEditOpen] = useState(false);
    const [manualScore, setManualScore] = useState('');
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [pendingEstimate, setPendingEstimate] = useState<number | string | undefined>(undefined);

    const {
        average,
        consensusPercentage,
        hasNumeric,
        isFullConsensus,
        modeVote,
        totalVotes,
        voteCounts,
        votedParticipants,
    } = useEstimationStats(roomState);

    const currentStory = roomState?.stories[roomState.currentStoryIndex ?? 0];

    if (!roomState?.votesRevealed) {
        return null;
    }

    if (votedParticipants.length === 0) {
        return (
            <Card>
                <Typography.Text type="secondary">
                    No votes were cast for this story yet.
                </Typography.Text>
            </Card>
        );
    }

    const suggestedEstimate = hasNumeric ? Number(average) : modeVote;

    const promptSaveEstimate = (customEstimate?: number | string) => {
        setPendingEstimate(customEstimate);
        setIsConfirmOpen(true);
    };

    const confirmSaveEstimate = () => {
        if (!currentStory || !isAdmin) {
            return;
        }

        const finalEstimate =
            pendingEstimate === undefined || pendingEstimate === ''
                ? suggestedEstimate
                : toFinalEstimate(pendingEstimate);

        updateStoryEstimate(currentStory.id, finalEstimate);

        const nextIndex = roomState.currentStoryIndex + 1;
        if (nextIndex < roomState.stories.length) {
            setCurrentStory(nextIndex);
        } else {
            void message.success('All stories in the backlog have been estimated!');
        }

        setIsConfirmOpen(false);
        setIsManualEditOpen(false);
    };

    const resetManualScore = () => {
        if (currentStory) {
            updateStoryEstimate(currentStory.id, null);
        }
        setIsManualEditOpen(false);
    };

    return (
        <>
            <Card
                className="results-panel"
                extra={
                    isFullConsensus ? (
                        <Tag color="success" icon={<CheckCircleOutlined />}>
                            100% Consensus
                        </Tag>
                    ) : undefined
                }
                title="Estimation Results"
            >
                <Flex gap={16} vertical>
                    {isAdmin && (
                        <Flex gap={8} justify="end" wrap>
                            <Button
                                icon={<EditOutlined />}
                                onClick={() => {
                                    setManualScore(String(suggestedEstimate));
                                    setIsManualEditOpen(true);
                                }}
                            >
                                Custom Score
                            </Button>
                            <Button
                                icon={<SaveOutlined />}
                                onClick={() => promptSaveEstimate()}
                                type="primary"
                            >
                                {`Accept ${hasNumeric ? 'Avg' : 'Mode'} (${suggestedEstimate})`}
                            </Button>
                        </Flex>
                    )}

                    <Row gutter={[16, 16]}>
                        <Col xs={12} md={6}>
                            <Statistic formatter={renderVerbatim} title="Average" value={average} />
                        </Col>
                        <Col xs={12} md={6}>
                            <Statistic
                                formatter={renderVerbatim}
                                suffix="%"
                                title="Consensus"
                                value={consensusPercentage}
                            />
                        </Col>
                        <Col xs={12} md={6}>
                            <Statistic
                                formatter={renderVerbatim}
                                title="Top Vote"
                                value={modeVote}
                            />
                        </Col>
                        <Col xs={12} md={6}>
                            <Statistic
                                formatter={renderVerbatim}
                                title="Voters"
                                value={totalVotes}
                            />
                        </Col>
                    </Row>

                    <Typography.Title level={5} style={{ margin: 0 }}>
                        Vote Distribution Breakdown
                    </Typography.Title>

                    <Flex gap={8} vertical>
                        {Object.entries(voteCounts).map(([vote, count]) => {
                            const percent = Math.round((count / totalVotes) * 100);

                            return (
                                <Row align="middle" gutter={[8, 8]} key={vote} wrap>
                                    <Col flex="64px">
                                        <Tag>{vote}</Tag>
                                    </Col>
                                    <Col flex="auto">
                                        <Flex gap={8} vertical>
                                            <Flex gap={8} justify="space-between" wrap>
                                                <Typography.Text>
                                                    {`${count} ${count === 1 ? 'vote' : 'votes'}`}
                                                </Typography.Text>
                                                <Typography.Text type="secondary">
                                                    {`${percent}%`}
                                                </Typography.Text>
                                            </Flex>
                                            <Progress
                                                aria-label={`Share of votes for ${vote}`}
                                                percent={percent}
                                                showInfo={false}
                                                size="small"
                                            />
                                        </Flex>
                                    </Col>
                                </Row>
                            );
                        })}
                    </Flex>
                </Flex>
            </Card>

            <Modal
                footer={
                    <Flex gap={8} justify="space-between" wrap>
                        <Button danger onClick={resetManualScore}>
                            Reset Score
                        </Button>
                        <Space>
                            <Button onClick={() => setIsManualEditOpen(false)}>Cancel</Button>
                            <Button
                                disabled={!manualScore.trim()}
                                onClick={() => promptSaveEstimate(manualScore.trim())}
                                type="primary"
                            >
                                Save &amp; Next
                            </Button>
                        </Space>
                    </Flex>
                }
                onCancel={() => setIsManualEditOpen(false)}
                open={isManualEditOpen}
                title="Set Custom Story Score"
            >
                <Flex gap={12} vertical>
                    <Typography.Text type="secondary">
                        {`Enter a custom estimate for "${currentStory?.title ?? ''}" or pick one from the room deck.`}
                    </Typography.Text>

                    <div>
                        <label htmlFor="results-custom-score">Estimate / Story Points</label>
                        <Input
                            id="results-custom-score"
                            onChange={(event) => setManualScore(event.target.value)}
                            placeholder="e.g. 3, 5, 8, M"
                            value={manualScore}
                        />
                    </div>

                    <DeckChipPicker
                        activeValue={manualScore}
                        deck={roomState.activeDeck}
                        onSelect={(value) => setManualScore(String(value))}
                    />
                </Flex>
            </Modal>

            <Modal
                okText="Save & Advance"
                onCancel={() => setIsConfirmOpen(false)}
                onOk={confirmSaveEstimate}
                open={isConfirmOpen}
                title="Confirm Story Change"
            >
                <Typography.Paragraph>
                    Are you sure you want to save this estimate and advance to the next story? This
                    will affect all participants and reset the timer.
                </Typography.Paragraph>
            </Modal>
        </>
    );
};
